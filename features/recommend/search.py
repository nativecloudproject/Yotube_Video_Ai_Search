"""Pure, local ranking for a user's liked-video candidates."""

from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
from datetime import datetime, timezone
import math
import re
import unicodedata


TITLE_WEIGHT = 3.0
DESCRIPTION_WEIGHT = 1.5
CHANNEL_WEIGHT = 1.0
DEFAULT_LIMIT = 24

_WORD_RE = re.compile(r"[0-9a-z가-힣]+")
_FIELDS = (
    ("title", "title", TITLE_WEIGHT),
    ("description", "desc", DESCRIPTION_WEIGHT),
    ("channel", "uploader_name", CHANNEL_WEIGHT),
)


@dataclass(frozen=True)
class RankedVideo:
    video: dict
    score: float | None
    matched_terms: tuple[str, ...]
    matched_fields: tuple[str, ...]


def _normalized_words(value: object) -> tuple[str, ...]:
    normalized = unicodedata.normalize("NFKC", str(value or "")).lower()
    return tuple(_WORD_RE.findall(normalized))


def _tokens(words: tuple[str, ...]) -> Counter[str]:
    tokens = list(words)
    tokens.extend(word[index:index + 2] for word in words for index in range(len(word) - 1))
    return Counter(tokens)


def _weighted_document(video: dict) -> tuple[Counter[str], dict[str, Counter[str]]]:
    document: Counter[str] = Counter()
    fields: dict[str, Counter[str]] = {}
    for field_name, key, weight in _FIELDS:
        field_tokens = _tokens(_normalized_words(video.get(key, "")))
        fields[field_name] = field_tokens
        for token, count in field_tokens.items():
            document[token] += count * weight
    return document, fields


def _idf(tokens_by_document: list[Counter[str]], query_tokens: Counter[str]) -> dict[str, float]:
    document_count = len(tokens_by_document)
    frequency = Counter(
        token
        for document in tokens_by_document
        for token in document
    )
    vocabulary = set(frequency) | set(query_tokens)
    return {
        token: math.log((1 + document_count) / (1 + frequency[token])) + 1
        for token in vocabulary
    }


def _vector(tokens: Counter[str], idf: dict[str, float]) -> dict[str, float]:
    return {token: count * idf[token] for token, count in tokens.items()}


def _cosine(left: dict[str, float], right: dict[str, float]) -> float:
    dot_product = sum(weight * right.get(token, 0.0) for token, weight in left.items())
    left_norm = math.sqrt(sum(weight * weight for weight in left.values()))
    right_norm = math.sqrt(sum(weight * weight for weight in right.values()))
    if not left_norm or not right_norm:
        return 0.0
    return dot_product / (left_norm * right_norm)


def _created_at_timestamp(video: dict) -> float:
    value = video.get("created_at")
    if not value:
        return float("-inf")
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return float("-inf")
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.timestamp()


def _sort_key(row: RankedVideo) -> tuple[float, float, str]:
    score = row.score if row.score is not None else 0.0
    return (-score, -_created_at_timestamp(row.video), str(row.video.get("id", "")))


def _matched_terms(
    query_words: tuple[str, ...],
    document: Counter[str],
) -> tuple[str, ...]:
    seen: set[str] = set()
    matched: list[str] = []
    for word in query_words:
        if word not in seen and any(token in document for token in _tokens((word,))):
            matched.append(word)
            seen.add(word)
    return tuple(matched)


def rank_videos(
    videos: list[dict], query: str, limit: int = DEFAULT_LIMIT,
) -> tuple[list[RankedVideo], int]:
    """Rank candidate videos without mutating their dictionaries or ordering."""
    query_words = _normalized_words(query)
    if not query_words:
        newest = [RankedVideo(video, None, (), ()) for video in videos]
        newest.sort(key=_sort_key)
        return newest[:limit], len(newest)

    query_tokens = _tokens(query_words)
    documents_and_fields = [_weighted_document(video) for video in videos]
    documents = [document for document, _ in documents_and_fields]
    idf = _idf(documents, query_tokens)
    query_vector = _vector(query_tokens, idf)

    ranked: list[RankedVideo] = []
    for video, (document, fields) in zip(videos, documents_and_fields):
        score = round(min(1.0, max(0.0, _cosine(query_vector, _vector(document, idf)))), 4)
        if score == 0.0:
            continue
        matched_fields = tuple(
            field_name
            for field_name, _, _ in _FIELDS
            if set(query_tokens).intersection(fields[field_name])
        )
        ranked.append(RankedVideo(
            video=video,
            score=score,
            matched_terms=_matched_terms(query_words, document),
            matched_fields=matched_fields,
        ))

    ranked.sort(key=_sort_key)
    return ranked[:limit], len(ranked)
