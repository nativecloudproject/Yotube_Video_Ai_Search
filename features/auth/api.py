"""가입 · 로그인 · 로그아웃 · 내 정보.   users 테이블 (id = 아이디 = 채널 핸들).
   POST /api/auth/signup  {username, name, password}
   POST /api/auth/login   {username, password}
   POST /api/auth/logout
   GET  /api/auth/me
"""
from flask import Blueprint, jsonify, request, session
from werkzeug.security import check_password_hash, generate_password_hash

from core import db
from core.auth import current_user, public

bp = Blueprint('auth', __name__)

# 아바타 배경색 (유튜브처럼 이니셜 + 단색)
PALETTE = ['#8e24aa', '#d81b60', '#e53935', '#f4511e', '#fb8c00', '#43a047', '#00897b', '#039be5', '#3949ab', '#6d4c41']


def color_for(uid: str) -> str:
    return PALETTE[sum(map(ord, uid)) % len(PALETTE)]


@bp.post('/signup')
def signup():
    d = request.get_json(silent=True) or {}
    uid = (d.get('username') or '').strip().lower()
    pw = d.get('password') or ''
    if not uid or not pw:
        return jsonify(error='아이디와 비밀번호를 입력하세요.'), 400
    if not uid.isalnum() or len(uid) > 20:
        return jsonify(error='아이디는 영문·숫자 20자 이내입니다.'), 400
    if len(pw) < 4:
        return jsonify(error='비밀번호는 4자 이상입니다.'), 400
    if db.get('users', uid):
        return jsonify(error='이미 있는 아이디입니다.'), 409
    u = db.put('users', {'id': uid, 'name': (d.get('name') or uid).strip() or uid,
                         'pw': generate_password_hash(pw), 'color': color_for(uid), 'bio': ''})
    session['user_id'] = uid
    return jsonify(public(u)), 201


@bp.post('/login')
def login():
    d = request.get_json(silent=True) or {}
    u = db.get('users', (d.get('username') or '').strip().lower())
    if not u or not check_password_hash(u['pw'], d.get('password') or ''):
        return jsonify(error='아이디 또는 비밀번호가 틀렸습니다.'), 401
    session['user_id'] = u['id']
    return jsonify(public(u))


@bp.post('/logout')
def logout():
    session.clear()
    return jsonify(ok=True)


@bp.get('/me')
def me():
    return jsonify(current_user())
