"""로그인 상태 도우미.  세션(서명된 쿠키)에 user_id 만 둔다.
(서버가 2대가 되면 SECRET_KEY 를 맞춰야 하는 '상태'다. 마무리 강의 소재.)"""
from functools import wraps

from flask import jsonify, session

from core import db


def public(u: dict) -> dict:
    """비밀번호 해시는 절대 밖으로 내보내지 않는다."""
    return {k: v for k, v in u.items() if k != 'pw'}


def current_user():
    uid = session.get('user_id')
    u = db.get('users', uid) if uid else None
    return public(u) if u else None


def login_required(fn):
    @wraps(fn)
    def wrapper(*a, **kw):
        if not session.get('user_id'):
            return jsonify(error='로그인이 필요합니다.'), 401
        return fn(*a, **kw)
    return wrapper
