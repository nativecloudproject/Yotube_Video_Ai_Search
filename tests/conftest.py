import pytest

from app import create_app
from core import db


@pytest.fixture
def app(tmp_path):
    flask_app = create_app({
        "TESTING": True,
        "DATABASE": str(tmp_path / "test.db"),
        "SECRET_KEY": "test-secret",
    })
    yield flask_app
    db.close()


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture
def login_as(client):
    def _login_as(user_id):
        with client.session_transaction() as session:
            session["user_id"] = user_id

    return _login_as


@pytest.fixture
def put_video():
    def _put_video(
        id,
        title,
        desc="",
        uploader="kim",
        uploader_name="Kim",
        *,
        likes,
        created_at,
        dislikes=None,
        duration=0,
        views=0,
        file="",
        thumb="",
    ):
        return db.put("videos", {
            "id": id,
            "uploader": uploader,
            "uploader_name": uploader_name,
            "title": title,
            "desc": desc,
            "file": file,
            "thumb": thumb,
            "duration": duration,
            "views": views,
            "likes": list(likes),
            "dislikes": list(dislikes or []),
            "created_at": created_at,
        })

    return _put_video
