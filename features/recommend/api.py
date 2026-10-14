"""Authenticated search across a user's liked videos."""

import re
import unicodedata

from flask import Blueprint, jsonify, request, session

from core import db
from core.auth import login_required
from features.recommend.search import rank_videos
from features.videos.api import view


bp = Blueprint("recommend", __name__)
MAX_QUERY_LENGTH = 100
DEFAULT_LIMIT = 24
MAX_LIMIT = 50
_LIMIT_RE = re.compile(r"^[0-9]+$")


@bp.get("/liked")
@login_required
def liked():
    query = unicodedata.normalize("NFKC", request.args.get("q", "")).strip()
    if len(query) > MAX_QUERY_LENGTH:
        return jsonify(error="검색어는 100자 이하여야 합니다."), 400

    raw_limit = request.args.get("limit")
    if raw_limit is None:
        limit = DEFAULT_LIMIT
    elif not _LIMIT_RE.fullmatch(raw_limit):
        return jsonify(error="limit은 1부터 50 사이의 정수여야 합니다."), 400
    else:
        limit = int(raw_limit)
        if not 1 <= limit <= MAX_LIMIT:
            return jsonify(error="limit은 1부터 50 사이의 정수여야 합니다."), 400

    user_id = session["user_id"]
    candidates = [
        video for video in db.all("videos") if user_id in video.get("likes", [])
    ]
    ranked, total = rank_videos(candidates, query, limit)
    return jsonify(
        query=query,
        total=total,
        items=[
            {
                **view(row.video),
                "score": row.score,
                "matched_terms": list(row.matched_terms),
                "matched_fields": list(row.matched_fields),
            }
            for row in ranked
        ],
    )
