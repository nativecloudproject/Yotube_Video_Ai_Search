"""TubeLite Flask entry point and application factory."""
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


def create_app(test_config: dict | None = None) -> Flask:
    """Create a configured TubeLite application without sharing SQLite state."""
    flask_app = Flask(__name__, static_folder=None)
    flask_app.config.from_mapping(
        SECRET_KEY=os.getenv('SECRET_KEY', 'dev-secret'),
        DATABASE=os.getenv('DATABASE', db.DEFAULT_DB_PATH),
        MAX_CONTENT_LENGTH=32 * 1024 * 1024,
        TESTING=False,
    )
    if test_config is not None:
        flask_app.config.from_mapping(test_config)
    flask_app.json.ensure_ascii = False
    db.configure(flask_app.config['DATABASE'])

    import features

    for module_info in pkgutil.iter_modules(features.__path__):
        if module_info.name.startswith('_'):
            continue
        module = importlib.import_module(f'features.{module_info.name}.api')
        flask_app.register_blueprint(module.bp, url_prefix=f'/api/{module_info.name}')

    @flask_app.route('/uploads/<path:key>')
    def uploads(key):
        return send_from_directory(storage.UPLOAD_DIR, key)

    def is_api_request():
        return request.path.startswith('/api/') or request.path.startswith('/uploads/')

    @flask_app.errorhandler(RequestEntityTooLarge)
    def too_large(error):
        return jsonify(error='파일이 너무 큽니다. 32MB 이하로 올려 주세요.'), 413

    @flask_app.errorhandler(storage.NotAllowed)
    def not_allowed(error):
        return jsonify(error=str(error)), 400

    @flask_app.errorhandler(HTTPException)
    def http_error(error):
        if is_api_request():
            return jsonify(error=error.description or error.name), error.code
        if error.code == 404:
            return spa('')
        return jsonify(error=error.description or error.name), error.code

    @flask_app.route('/', defaults={'path': ''})
    @flask_app.route('/<path:path>')
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
        response = send_from_directory(APP_DIR, 'index.html')
        response.headers['Cache-Control'] = 'no-cache'
        return response

    return flask_app


app = create_app()


def _env_bool(name: str, default: bool = False) -> bool:
    return os.getenv(name, str(int(default))).strip().lower() in {'1', 'true', 'yes', 'on'}


if __name__ == '__main__':
    db.init()
    jobs.start()
    host = os.getenv('HOST', '127.0.0.1')
    port = int(os.getenv('PORT', '5000'))
    print(f'[app] http://{host}:{port}')
    app.run(host=host, port=port, debug=_env_bool('FLASK_DEBUG'), use_reloader=False)
