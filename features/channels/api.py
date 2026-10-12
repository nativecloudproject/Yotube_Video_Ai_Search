"""채널 · 구독.   subscriptions 테이블 (id = "<구독자>_<채널>").
   GET  /api/channels/subscriptions       → 내가 구독한 채널 목록
   GET  /api/channels/<uid>               → {channel, videos}
   POST /api/channels/<uid>/subscribe     → 구독 토글 → {subscribed, subscribers}
구독하면 채널 주인에게 알림 → core.notify (9주차 Lambda+SNS)."""
from flask import Blueprint, jsonify, session

from core import db, notify
from core.auth import login_required
from features.videos.api import channel_of, view

bp = Blueprint('channels', __name__)


@bp.get('/subscriptions')
@login_required
def subscriptions():
    uid = session['user_id']
    return jsonify([channel_of(s['channel'], uid) for s in db.find('subscriptions', sub=uid)])


@bp.get('/<uid>')
def channel(uid):
    if not db.get('users', uid):
        return jsonify(error='없는 채널입니다.'), 404
    videos = [view(v, with_channel=False) for v in db.find('videos', uploader=uid)]
    return jsonify(channel=channel_of(uid, session.get('user_id')), videos=videos)


@bp.post('/<uid>/subscribe')
@login_required
def subscribe(uid):
    me = session['user_id']
    if uid == me:
        return jsonify(error='내 채널은 구독할 수 없습니다.'), 400
    if not db.get('users', uid):
        return jsonify(error='없는 채널입니다.'), 404
    key = f'{me}_{uid}'
    if db.get('subscriptions', key):
        db.delete('subscriptions', key)
    else:
        db.put('subscriptions', {'id': key, 'sub': me, 'channel': uid})
        my = db.get('users', me)
        notify.send(uid, '새 구독자', f'{my["name"]} 님이 채널을 구독했습니다.', link=f'/channel/{me}')
    ch = channel_of(uid, me)
    return jsonify(subscribed=ch['subscribed'], subscribers=ch['subscribers'])
