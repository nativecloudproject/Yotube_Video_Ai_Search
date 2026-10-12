"""진입점.
  /api/*      → features/<이름>/api.py 가 자동 등록된다  (/api/<이름>/...)
  /uploads/*  → 로컬 업로드 파일 (6주차에 S3로 가면 안 쓰인다)
  그 외       → React 앱 (static/app/index.html).  화면은 frontend/ 에서 빌드한다.
새 기능을 만들 때 이 파일은 건드리지 않는다."""
import importlib
import os
import pkgutil

from dotenv import load_dotenv
from flask import Flask, jsonify, request, send_from_directory
from werkzeug.exceptions import HTTPException, RequestEntityTooLarge

from core import db, jobs, storage

load_dotenv()
BASE = os.path.dirname(os.path.abspath(__file__))
APP_DIR = os.path.join(BASE, 'static', 'app')

app = Flask(__name__, static_folder=None)
app.secret_key = os.getenv('SECRET_KEY', 'dev-secret')
app.config['MAX_CONTENT_LENGTH'] = 32 * 1024 * 1024   # 업로드 32MB
app.json.ensure_ascii = False

# ── features/*/api.py 자동 등록 ─────────────────────────────
import features  # noqa: E402

for m in pkgutil.iter_modules(features.__path__):
    if m.name.startswith('_'):        # _template 은 등록하지 않는다 (복사해서 쓰는 용도)
        continue
    mod = importlib.import_module(f'features.{m.name}.api')
    app.register_blueprint(mod.bp, url_prefix=f'/api/{m.name}')
    print(f'[app] 기능 등록: /api/{m.name}')


# ── 로컬 업로드 파일 ─────────────────────────────────────────
@app.route('/uploads/<path:key>')
def uploads(key):
    return send_from_directory(storage.UPLOAD_DIR, key)


# ── 오류 처리 ────────────────────────────────────────────────
def _is_api():
    return request.path.startswith('/api/') or request.path.startswith('/uploads/')


@app.errorhandler(RequestEntityTooLarge)
def too_large(e):
    return jsonify(error='파일이 너무 큽니다. 32MB 이하로 올려 주세요.'), 413


@app.errorhandler(storage.NotAllowed)
def not_allowed(e):
    return jsonify(error=str(e)), 400


@app.errorhandler(HTTPException)
def http_error(e):
    if _is_api():
        return jsonify(error=e.description or e.name), e.code
    if e.code == 404:                 # SPA 라우트는 프론트가 처리한다
        return spa('')
    return jsonify(error=e.description or e.name), e.code


# ── React 앱 ────────────────────────────────────────────────
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def spa(path):
    if path.startswith('api/'):
        return jsonify(error='not found'), 404
    full = os.path.join(APP_DIR, path)
    if path and os.path.isfile(full):
        return send_from_directory(APP_DIR, path)
    if not os.path.isfile(os.path.join(APP_DIR, 'index.html')):
        return ('<pre style="font:14px/1.7 sans-serif;padding:40px">'
                '프론트 빌드가 없습니다.\n\n  cd frontend && npm install && npm run build\n\n'
                '그 다음 새로 고침하세요. (API 는 /api/... 로 이미 동작합니다)</pre>'), 200
    resp = send_from_directory(APP_DIR, 'index.html')
    resp.headers['Cache-Control'] = 'no-cache'       # 새 빌드가 바로 보이게 (assets 는 해시가 붙어 캐시해도 된다)
    return resp


if __name__ == '__main__':
    db.init()
    jobs.start()
    port = int(os.getenv('PORT', '5000'))
    print(f'[app] http://localhost:{port}')
    # use_reloader=False : 스케줄러가 두 번 뜨는 것을 막는다
    app.run(host='0.0.0.0', port=port, debug=True, use_reloader=False)
