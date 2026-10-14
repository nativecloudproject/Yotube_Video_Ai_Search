import pytest

from core import db


@pytest.fixture
def videos(put_video):
    for user_id, name in (
        ("kim", "Kim"),
        ("lee", "Lee"),
        ("empty-user", "Empty User"),
    ):
        db.put("users", {"id": user_id, "name": name, "color": "#606060"})

    return [
        put_video(
            "kim-python",
            "파이썬으로 게시판 만들기",
            "Flask 개발",
            likes=["kim"],
            created_at="2026-01-03T00:00:00+00:00",
        ),
        put_video(
            "kim-old",
            "학식 리뷰",
            "오늘의 메뉴",
            likes=["kim"],
            created_at="2026-01-01T00:00:00+00:00",
        ),
        put_video(
            "lee-server",
            "서버 개발 입문",
            "로컬 서버",
            uploader="lee",
            uploader_name="Lee",
            likes=["lee"],
            created_at="2026-01-02T00:00:00+00:00",
        ),
        put_video(
            "unliked-python",
            "파이썬 고급",
            uploader="lee",
            uploader_name="Lee",
            likes=["lee"],
            created_at="2026-01-04T00:00:00+00:00",
        ),
    ]


def test_liked_search_requires_login(client):
    response = client.get("/api/recommend/liked?q=개발")

    assert response.status_code == 401
    assert response.get_json() == {"error": "로그인이 필요합니다."}


def test_liked_search_returns_only_current_users_likes(client, login_as, videos):
    login_as("kim")

    response = client.get("/api/recommend/liked?q=파이썬")
    body = response.get_json()

    assert response.status_code == 200
    assert [item["id"] for item in body["items"]] == ["kim-python"]
    assert body["query"] == "파이썬"
    assert body["total"] == 1
    assert "likes" not in body["items"][0]
    assert "dislikes" not in body["items"][0]


def test_same_query_is_scoped_per_user(client, login_as, videos):
    login_as("kim")
    kim_ids = [
        item["id"]
        for item in client.get("/api/recommend/liked?q=개발").get_json()["items"]
    ]

    login_as("lee")
    lee_ids = [
        item["id"]
        for item in client.get("/api/recommend/liked?q=개발").get_json()["items"]
    ]

    assert kim_ids == ["kim-python"]
    assert lee_ids == ["lee-server"]


def test_blank_query_returns_all_likes_newest_first(client, login_as, videos):
    login_as("kim")

    body = client.get("/api/recommend/liked").get_json()

    assert [item["id"] for item in body["items"]] == ["kim-python", "kim-old"]
    assert all(item["score"] is None for item in body["items"])


def test_punctuation_only_query_returns_all_likes(client, login_as, videos):
    login_as("kim")

    body = client.get("/api/recommend/liked?q=...!!!").get_json()

    assert body["query"] == "...!!!"
    assert [item["id"] for item in body["items"]] == ["kim-python", "kim-old"]
    assert all(item["score"] is None for item in body["items"])


def test_no_likes_and_no_match_return_empty_success(client, login_as, videos):
    login_as("empty-user")
    assert client.get("/api/recommend/liked?q=개발").get_json() == {
        "query": "개발",
        "total": 0,
        "items": [],
    }

    login_as("kim")
    assert client.get("/api/recommend/liked?q=천문학").get_json() == {
        "query": "천문학",
        "total": 0,
        "items": [],
    }


def test_query_length_boundary(client, login_as):
    login_as("kim")

    assert client.get(
        "/api/recommend/liked", query_string={"q": "가" * 100}
    ).status_code == 200

    response = client.get(
        "/api/recommend/liked", query_string={"q": "가" * 101}
    )
    assert response.status_code == 400
    assert response.get_json() == {"error": "검색어는 100자 이하여야 합니다."}

    assert client.get(
        "/api/recommend/liked", query_string={"q": "ﬃ" * 34}
    ).status_code == 400


@pytest.mark.parametrize("limit", ["", "0", "51", "abc"])
def test_rejects_invalid_limit(client, login_as, limit):
    login_as("kim")

    response = client.get("/api/recommend/liked", query_string={"limit": limit})

    assert response.status_code == 400
    assert response.get_json() == {"error": "limit은 1부터 50 사이의 정수여야 합니다."}
