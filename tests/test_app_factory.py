from core import db


def test_create_app_uses_configured_database(tmp_path):
    import app as app_module

    assert hasattr(app_module, "create_app")
    first = app_module.create_app({
        "TESTING": True,
        "DATABASE": str(tmp_path / "first.db"),
        "SECRET_KEY": "test",
    })
    with first.app_context():
        db.put("probe", {"id": "first"})
        assert db.get("probe", "first")["id"] == "first"

    second = app_module.create_app({
        "TESTING": True,
        "DATABASE": str(tmp_path / "second.db"),
        "SECRET_KEY": "test",
    })
    with second.app_context():
        assert db.get("probe", "first") is None


def test_create_app_preserves_auth_route(tmp_path):
    import app as app_module

    assert hasattr(app_module, "create_app")
    flask_app = app_module.create_app({
        "TESTING": True,
        "DATABASE": str(tmp_path / "auth.db"),
        "SECRET_KEY": "test",
    })
    response = flask_app.test_client().get("/api/auth/me")
    assert response.status_code == 200
    assert response.get_json() is None
