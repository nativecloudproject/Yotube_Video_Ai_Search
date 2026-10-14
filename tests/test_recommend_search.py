from copy import deepcopy

from features.recommend.search import rank_videos


weighted_field_videos = [
    {
        "id": "title",
        "title": "파이썬",
        "desc": "",
        "uploader_name": "",
        "created_at": "2026-01-01T00:00:00+00:00",
    },
    {
        "id": "description",
        "title": "",
        "desc": "파이썬",
        "uploader_name": "",
        "created_at": "2026-01-02T00:00:00+00:00",
    },
    {
        "id": "channel",
        "title": "",
        "desc": "",
        "uploader_name": "파이썬",
        "created_at": "2026-01-03T00:00:00+00:00",
    },
]

videos = [
    {
        "id": "flask-video",
        "title": "Flask로 시작하기",
        "desc": "웹 개발 입문",
        "uploader_name": "튜브",
        "created_at": "2026-01-03T00:00:00+00:00",
    },
    {
        "id": "data-structures",
        "title": "자료구조 기초",
        "desc": "알고리즘을 위한 자료구조",
        "uploader_name": "컴퓨터 과학",
        "created_at": "2026-01-02T00:00:00+00:00",
    },
]

newest_videos = [
    {
        "id": "older",
        "title": "오래된 영상",
        "desc": "",
        "uploader_name": "채널",
        "created_at": "2026-01-01T00:00:00+00:00",
    },
    {
        "id": "newest",
        "title": "새 영상",
        "desc": "",
        "uploader_name": "채널",
        "created_at": "2026-01-03T00:00:00+00:00",
    },
]

single_video = {
    "id": "single",
    "title": "개발 일지",
    "desc": "파이썬",
    "uploader_name": "튜브",
    "created_at": "2026-01-01T00:00:00+00:00",
}

tied_videos = [
    {
        "id": "old",
        "title": "개발",
        "desc": "",
        "uploader_name": "채널",
        "created_at": "2026-01-01T00:00:00+00:00",
    },
    {
        "id": "new-b",
        "title": "개발",
        "desc": "",
        "uploader_name": "채널",
        "created_at": "2026-01-03T00:00:00+00:00",
    },
    {
        "id": "new-a",
        "title": "개발",
        "desc": "",
        "uploader_name": "채널",
        "created_at": "2026-01-03T00:00:00+00:00",
    },
]

matching_videos = [
    {
        "id": "one",
        "title": "개발 1",
        "desc": "",
        "uploader_name": "채널",
        "created_at": "2026-01-01T00:00:00+00:00",
    },
    {
        "id": "two",
        "title": "개발 2",
        "desc": "",
        "uploader_name": "채널",
        "created_at": "2026-01-02T00:00:00+00:00",
    },
    {
        "id": "three",
        "title": "개발 3",
        "desc": "",
        "uploader_name": "채널",
        "created_at": "2026-01-03T00:00:00+00:00",
    },
]

numeric_contract_videos = [
    {
        "id": "exact-title",
        "title": "abc",
        "desc": "",
        "uploader_name": "",
        "created_at": "2026-01-01T00:00:00+00:00",
    },
    {
        "id": "bigram-description",
        "title": "",
        "desc": "zabz",
        "uploader_name": "",
        "created_at": "2026-01-03T00:00:00+00:00",
    },
    {
        "id": "bigram-channel",
        "title": "",
        "desc": "",
        "uploader_name": "xbcx",
        "created_at": "2026-01-02T00:00:00+00:00",
    },
]


def test_title_match_ranks_above_description_then_channel():
    ranked, total = rank_videos(weighted_field_videos, "파이썬")

    assert [
        (row.video["id"], row.score, row.matched_terms, row.matched_fields)
        for row in ranked
    ] == [
        ("title", 0.5455, ("파이썬",), ("title",)),
        ("description", 0.2727, ("파이썬",), ("description",)),
        ("channel", 0.1818, ("파이썬",), ("channel",)),
    ]
    assert total == 3


def test_weighted_tfidf_numeric_contract_includes_bigram_only_overlap():
    ranked, total = rank_videos(numeric_contract_videos, "abc")

    assert [
        (row.video["id"], row.score, row.matched_terms, row.matched_fields)
        for row in ranked
    ] == [
        ("exact-title", 0.5455, ("abc",), ("title",)),
        ("bigram-description", 0.0568, ("abc",), ("description",)),
        ("bigram-channel", 0.0379, ("abc",), ("channel",)),
    ]
    assert total == 3


def test_normalizes_nfkc_case_and_punctuation():
    ranked, total = rank_videos(videos, "  ＦＬＡＳＫ!!!  ")

    assert [row.video["id"] for row in ranked] == ["flask-video"]
    assert total == 1


def test_character_bigrams_find_partial_korean_term():
    ranked, _ = rank_videos(videos, "자료구")

    assert ranked[0].video["id"] == "data-structures"
    assert ranked[0].matched_terms == ("자료구",)


def test_empty_or_punctuation_only_query_returns_newest_with_null_score():
    for query in ("", "   ", "...!!!"):
        ranked, total = rank_videos(newest_videos, query)

        assert [row.video["id"] for row in ranked] == ["newest", "older"]
        assert all(row.score is None for row in ranked)
        assert total == 2


def test_empty_and_singleton_corpora_are_safe():
    assert rank_videos([], "개발") == ([], 0)

    ranked, total = rank_videos([single_video], "개발")
    assert total == 1
    assert 0 < ranked[0].score <= 1
    assert rank_videos([single_video], "천문학") == ([], 0)


def test_unrelated_query_returns_no_results():
    assert rank_videos(videos, "천문학") == ([], 0)


def test_equal_scores_sort_by_created_at_then_id():
    ranked, _ = rank_videos(tied_videos, "개발")

    assert [row.video["id"] for row in ranked] == ["new-a", "new-b", "old"]


def test_limit_is_applied_after_total_is_counted():
    ranked, total = rank_videos(matching_videos, "개발", limit=2)

    assert len(ranked) == 2
    assert total == 3


def test_scores_are_stable_rounded_and_do_not_mutate_input():
    candidates = deepcopy(weighted_field_videos)
    original = deepcopy(candidates)

    first, first_total = rank_videos(candidates, "파이썬")
    second, second_total = rank_videos(candidates, "파이썬")

    assert candidates == original
    assert first_total == second_total == 3
    assert [row.score for row in first] == [row.score for row in second]
    assert all(row.score == round(row.score, 4) for row in first)
