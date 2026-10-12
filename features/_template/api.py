"""[복사해서 쓰세요]  기능 이름: template
이 기능이 하는 일: (한 줄로)
   GET  /api/template/          → 목록
   POST /api/template/          → 추가 (multipart: text, photo)
"""
from flask import Blueprint, jsonify, request, session

from core import db, notify, storage  # noqa: F401  (notify 는 예시용)
from core.auth import login_required

bp = Blueprint('template', __name__)


def view(it):
    return {**it, 'photo_url': storage.url(it.get('photo', ''))}


@bp.get('/')
def index():
    return jsonify([view(x) for x in db.all('template_items')])


@bp.post('/')
@login_required
def new():
    text = (request.form.get('text') or '').strip()
    if not text:
        return jsonify(error='내용을 입력하세요.'), 400
    it = db.put('template_items', {
        'user_id': session['user_id'],
        'text': text,
        'photo': storage.save(request.files.get('photo')),   # 파일이 없으면 ''
    })
    # 예: notify.send(누구에게, '제목', '내용', link='/template')
    return jsonify(view(it)), 201
