"""동영상.   videos 테이블 (+ history · trending).
   GET  /api/videos/?q=&sort=          → 목록 (홈·검색)   sort: latest | popular
   POST /api/videos/                   → 업로드 multipart: title, desc, video, thumb, duration
   GET  /api/videos/<id>               → {video, channel, comments, related}  (조회수 +1, 로그인 시 시청 기록)
   POST /api/videos/<id>/react         → {value: 'like'|'dislike'|null}  좋아요/싫어요 토글
   GET  /api/videos/history            → 내 시청 기록
   GET  /api/videos/liked              → 좋아요 표시한 동영상
   GET  /api/videos/mine               → 내 동영상
   GET  /api/videos/feed               → 구독 채널의 새 동영상
주기 작업: 매일 조회수·좋아요 기준 인기 영상 → trending (홈 '인기' 칩)."""
from flask import Blueprint, jsonify, request, session

from core import db, jobs, storage
from core.auth import login_required

bp = Blueprint('videos', __name__)


def channel_of(uid: str, viewer: str | None = None) -> dict:
    u = db.get('users', uid) or {'id': uid, 'name': uid, 'color': '#606060'}
    subs = db.find('subscriptions', channel=uid)
    return {'id': u['id'], 'name': u['name'], 'color': u.get('color', '#606060'), 'bio': u.get('bio', ''),
            'subscribers': len(subs), 'subscribed': bool(viewer) and any(s['sub'] == viewer for s in subs)}


def view(v, with_channel=True):
    uid = session.get('user_id')
    out = {**v,
           'file_url': storage.url(v.get('file', '')), 'thumb_url': storage.url(v.get('thumb', '')),
           'like_count': len(v.get('likes', [])), 'dislike_count': len(v.get('dislikes', [])),
           'my_reaction': 'like' if uid in v.get('likes', []) else 'dislike' if uid in v.get('dislikes', []) else None}
    out.pop('likes', None)
    out.pop('dislikes', None)
    if with_channel:
        u = db.get('users', v['uploader']) or {}
        out['channel'] = {'id': v['uploader'], 'name': u.get('name', v['uploader']), 'color': u.get('color', '#606060')}
    return out


def _sorted(videos, sort):
    if sort == 'popular':
        return sorted(videos, key=lambda v: v.get('views', 0) + 3 * len(v.get('likes', [])), reverse=True)
    return videos   # db.all 은 이미 최신순


@bp.get('/')
def index():
    q = (request.args.get('q') or '').strip().lower()
    sort = request.args.get('sort') or 'latest'
    videos = db.all('videos')
    if q:
        videos = [v for v in videos if q in (v['title'] + ' ' + v.get('desc', '') + ' ' + v.get('uploader_name', '')).lower()]
    if sort == 'trending':
        ids = (db.get('trending', 'today') or {'ids': []})['ids']
        videos = [t for t in (db.get('videos', i) for i in ids) if t]
    else:
        videos = _sorted(videos, sort)
    return jsonify([view(v) for v in videos])


@bp.post('/')
@login_required
def upload():
    f = request.files.get('video')
    if not f or not f.filename:
        return jsonify(error='동영상 파일을 선택하세요.'), 400
    title = (request.form.get('title') or '').strip()
    if not title:
        return jsonify(error='제목을 입력하세요.'), 400
    try:
        duration = max(0, int(float(request.form.get('duration') or 0)))
    except ValueError:
        duration = 0
    me = db.get('users', session['user_id'])
    v = db.put('videos', {
        'uploader': me['id'], 'uploader_name': me['name'], 'title': title,
        'desc': (request.form.get('desc') or '').strip(),
        'file': storage.save(f),                                # ← 동영상 파일 (6주차 S3)
        'thumb': storage.save(request.files.get('thumb')),      # ← 썸네일 (프론트가 영상에서 뽑아 보낸다)
        'duration': duration, 'views': 0, 'likes': [], 'dislikes': [],
    })
    return jsonify(view(v)), 201


@bp.get('/history')
@login_required
def history():
    uid = session['user_id']
    rows = sorted(db.find('history', uid=uid), key=lambda h: h['at'], reverse=True)
    vids = [db.get('videos', h['vid']) for h in rows]
    return jsonify([view(v) for v in vids if v])


@bp.get('/liked')
@login_required
def liked():
    uid = session['user_id']
    return jsonify([view(v) for v in db.all('videos') if uid in v.get('likes', [])])


@bp.get('/mine')
@login_required
def mine():
    return jsonify([view(v) for v in db.find('videos', uploader=session['user_id'])])


@bp.get('/feed')
@login_required
def feed():
    channels = {s['channel'] for s in db.find('subscriptions', sub=session['user_id'])}
    return jsonify([view(v) for v in db.all('videos') if v['uploader'] in channels])


@bp.get('/<id>')
def watch(id):
    v = db.get('videos', id)
    if not v:
        return jsonify(error='없는 동영상입니다.'), 404
    v = db.update('videos', id, views=v.get('views', 0) + 1)
    uid = session.get('user_id')
    if uid:   # 시청 기록 (같은 영상은 한 줄만, 시각만 갱신)
        db.put('history', {'id': f'{uid}_{id}', 'uid': uid, 'vid': id, 'at': db.now()})
    comments = sorted(db.find('comments', video_id=id), key=lambda c: c['created_at'], reverse=True)
    for c in comments:
        c['like_count'] = len(c.get('likes', []))
        c['liked'] = uid in c.get('likes', [])
        u = db.get('users', c['author']) or {}
        c['author_color'] = u.get('color', '#606060')
        c.pop('likes', None)
    related = [view(x, with_channel=True) for x in _sorted([x for x in db.all('videos') if x['id'] != id], 'popular')][:12]
    return jsonify(video=view(v), channel=channel_of(v['uploader'], uid), comments=comments, related=related)


@bp.post('/<id>/react')
@login_required
def react(id):
    v = db.get('videos', id)
    if not v:
        return jsonify(error='없는 동영상입니다.'), 404
    uid = session['user_id']
    value = (request.get_json(silent=True) or {}).get('value')
    likes, dislikes = set(v.get('likes', [])), set(v.get('dislikes', []))
    likes.discard(uid)
    dislikes.discard(uid)
    if value == 'like':
        likes.add(uid)
    elif value == 'dislike':
        dislikes.add(uid)
    v = db.update('videos', id, likes=sorted(likes), dislikes=sorted(dislikes))
    return jsonify(like_count=len(v['likes']), dislike_count=len(v['dislikes']),
                   my_reaction='like' if uid in v['likes'] else 'dislike' if uid in v['dislikes'] else None)


# ── 주기 작업: 인기 동영상 집계 ─────────────────────────────
# TODO(9주차): 이 함수가 Lambda 로 가고 EventBridge(매일 04:00)가 깨운다.
@jobs.every(hours=24, name='trending')
def compute_trending():
    vids = _sorted(db.all('videos'), 'popular')
    db.put('trending', {'id': 'today', 'ids': [v['id'] for v in vids[:12]]})
    print(f'[trending] 인기 동영상 {len(vids[:12])}개 집계')
