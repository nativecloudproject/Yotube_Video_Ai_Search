"""댓글.  comments 테이블.  댓글이 달리면 업로더에게 알림 → core.notify (9주차 Lambda+SNS).
   POST /api/comments/<video_id>        {text}
   POST /api/comments/<id>/like         좋아요 토글
"""
from flask import Blueprint, jsonify, request, session

from core import db, notify
from core.auth import login_required

bp = Blueprint('comments', __name__)


@bp.post('/<video_id>')
@login_required
def new(video_id):
    v = db.get('videos', video_id)
    if not v:
        return jsonify(error='없는 동영상입니다.'), 404
    text = ((request.get_json(silent=True) or {}).get('text') or '').strip()
    if not text:
        return jsonify(error='내용을 입력하세요.'), 400
    me = db.get('users', session['user_id'])
    c = db.put('comments', {'video_id': video_id, 'author': me['id'], 'author_name': me['name'], 'text': text, 'likes': []})
    if v['uploader'] != me['id']:
        notify.send(v['uploader'], '새 댓글', f'{me["name"]} 님이 "{v["title"]}"에 댓글을 남겼습니다: {text[:40]}',
                    link=f'/watch/{video_id}')
    return jsonify({**c, 'like_count': 0, 'liked': False, 'author_color': me.get('color', '#606060')}), 201


@bp.post('/<id>/like')
@login_required
def like(id):
    c = db.get('comments', id)
    if not c:
        return jsonify(error='없는 댓글입니다.'), 404
    uid = session['user_id']
    likes = set(c.get('likes', []))
    likes.symmetric_difference_update({uid})
    c = db.update('comments', id, likes=sorted(likes))
    return jsonify(like_count=len(c['likes']), liked=uid in c['likes'])
