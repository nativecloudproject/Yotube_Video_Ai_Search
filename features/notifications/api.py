"""내 알림.  core.notify 가 쌓아 둔 것.
   GET  /api/notifications/        → {items, unread}
   POST /api/notifications/read    → 전부 읽음
"""
from flask import Blueprint, jsonify, session

from core import db, notify
from core.auth import login_required

bp = Blueprint('notifications', __name__)


@bp.get('/')
@login_required
def index():
    uid = session['user_id']
    return jsonify(items=db.find('notifications', user_id=uid), unread=notify.unread_count(uid))


@bp.post('/read')
@login_required
def read():
    notify.mark_all_read(session['user_id'])
    return jsonify(ok=True)
