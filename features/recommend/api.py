"""키워드 기반 유사 영상 추천. (core 만 사용 · 외부 AI 라이브러리 없음)

GET /api/recommend/?q=클라우드
  → 입력 키워드와 제목·설명·채널명이 의미상 비슷한 영상을 유사도 순으로 반환
  → 각 항목에 score(0~1), reason(검색 키워드) 포함

방법: 키워드와 영상 텍스트를 단어 + 글자 2-gram TF-IDF 벡터로 변환한 뒤
      코사인 유사도를 계산한다. q가 비어 있으면 인기순으로 대신한다.
"""
import math
import re
from collections import Counter

from flask import Blueprint, jsonify, request

from core import db
from core.auth import login_required
from features.videos.api import _sorted, view

bp = Blueprint('recommend', __name__)
LIMIT = 12


def tokens_text(text: str) -> Counter:
    """한국어/영어 텍스트를 단어 + 글자 2-gram 토큰으로 만든다."""
    words = re.findall(r'[0-9a-z가-힣]+', (text or '').lower())
    grams = [w[i:i + 2] for w in words for i in range(len(w) - 1)]
    return Counter(words + grams)


def video_text(v: dict) -> str:
    # 제목을 두 번 넣어 제목 일치를 조금 더 중요하게 본다.
    return ' '.join([
        v.get('title', '') * 2,
        v.get('desc', ''),
        v.get('uploader_name', ''),
    ])


def vectorize(query: str, videos: list[dict]):
    """검색 키워드와 모든 영상을 같은 TF-IDF 공간으로 벡터화한다."""
    docs = {'__query__': tokens_text(query)}
    docs.update({v['id']: tokens_text(video_text(v)) for v in videos})

    df = Counter(t for d in docs.values() for t in d)
    n = len(docs)
    idf = {t: math.log((1 + n) / (1 + c)) + 1 for t, c in df.items()}

    return {
        doc_id: {t: count * idf[t] for t, count in tokens.items()}
        for doc_id, tokens in docs.items()
    }


def cosine(a: dict, b: dict) -> float:
    dot = sum(weight * b.get(token, 0) for token, weight in a.items())
    na = math.sqrt(sum(weight * weight for weight in a.values()))
    nb = math.sqrt(sum(weight * weight for weight in b.values()))
    return dot / (na * nb) if na and nb else 0.0


def recommend(query: str, videos: list[dict]):
    query = (query or '').strip()
    if not query:
        return [(v, 0.0) for v in _sorted(videos, 'popular')[:LIMIT]]

    vec = vectorize(query, videos)
    qvec = vec['__query__']

    scored = [(v, cosine(qvec, vec[v['id']])) for v in videos]
    scored.sort(key=lambda item: (item[1], item[0].get('views', 0)), reverse=True)
    return scored[:LIMIT]


@bp.get('/')
@login_required
def index():
    query = (request.args.get('q') or '').strip()
    return jsonify([
        {**view(v), 'score': round(score, 3), 'reason': query}
        for v, score in recommend(query, db.all('videos'))
    ])
