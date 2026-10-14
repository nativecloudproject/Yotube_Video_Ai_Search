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


@pytest.fixture
def many_matching_likes(put_video):
    return [
        put_video(
            f"kim-match-{number}",
            "개발 공통 영상",
            likes=["kim"],
            created_at=f"2026-02-{number:02d}T00:00:00+00:00",
        )
        for number in range(1, 27)
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
    assert body["items"][0]["score"] == 0.1599
    assert body["items"][0]["matched_terms"] == ["파이썬"]
    assert body["items"][0]["matched_fields"] == ["title"]
    assert isinstance(body["items"][0]["matched_terms"], list)
    assert isinstance(body["items"][0]["matched_fields"], list)


def test_liked_search_passes_only_liked_candidates_to_ranker(
    client, login_as, videos, monkeypatch
):
    import features.recommend.api as recommend_api

    observed_candidates = []
    original_rank_videos = recommend_api.rank_videos

    def observe_candidates(candidates, query, limit):
        observed_candidates.append([video["id"] for video in candidates])
        return original_rank_videos(candidates, query, limit)

    monkeypatch.setattr(recommend_api, "rank_videos", observe_candidates)
    login_as("kim")

    response = client.get("/api/recommend/liked?q=개발")

    assert response.status_code == 200
    assert observed_candidates == [["kim-python", "kim-old"]]


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
    assert [item["matched_terms"] for item in body["items"]] == [[], []]
    assert [item["matched_fields"] for item in body["items"]] == [[], []]
    assert all(isinstance(item["matched_terms"], list) for item in body["items"])
    assert all(isinstance(item["matched_fields"], list) for item in body["items"])


def test_punctuation_only_query_returns_all_likes(client, login_as, videos):
    login_as("kim")

    body = client.get("/api/recommend/liked?q=...!!!").get_json()

    assert body["query"] == "...!!!"
    assert [item["id"] for item in body["items"]] == ["kim-python", "kim-old"]
    assert all(item["score"] is None for item in body["items"])
    assert [item["matched_terms"] for item in body["items"]] == [[], []]
    assert [item["matched_fields"] for item in body["items"]] == [[], []]


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


def test_liked_search_limit_defaults_truncates_and_preserves_total(
    client, login_as, many_matching_likes
):
    login_as("kim")

    default_response = client.get("/api/recommend/liked?q=개발")
    default_body = default_response.get_json()
    assert default_response.status_code == 200
    assert default_body["total"] == 26
    assert len(default_body["items"]) == 24

    small_response = client.get(
        "/api/recommend/liked", query_string={"q": "개발", "limit": "1"}
    )
    small_body = small_response.get_json()
    assert small_response.status_code == 200
    assert small_body["total"] == 26
    assert [item["id"] for item in small_body["items"]] == ["kim-match-26"]

    max_response = client.get(
        "/api/recommend/liked", query_string={"q": "개발", "limit": "50"}
    )
    max_body = max_response.get_json()
    assert max_response.status_code == 200
    assert max_body["total"] == 26
    assert len(max_body["items"]) == 26


def test_existing_liked_videos_route_remains_a_list(client, login_as, videos):
    login_as("kim")

    response = client.get("/api/videos/liked")
    body = response.get_json()

    assert response.status_code == 200
    assert isinstance(body, list)
    assert [item["id"] for item in body] == ["kim-python", "kim-old"]


@pytest.mark.parametrize("limit", ["", "0", "-1", "51", "abc"])
def test_rejects_invalid_limit(client, login_as, limit):
    login_as("kim")

    response = client.get("/api/recommend/liked", query_string={"limit": limit})

    assert response.status_code == 400
    assert response.get_json() == {"error": "limit은 1부터 50 사이의 정수여야 합니다."}


def test_rejects_overlong_decimal_limit(client, login_as):
    login_as("kim")

    response = client.get(
        "/api/recommend/liked", query_string={"limit": "9" * 5000}
    )

    assert response.status_code == 400
    assert response.get_json() == {"error": "limit은 1부터 50 사이의 정수여야 합니다."}
