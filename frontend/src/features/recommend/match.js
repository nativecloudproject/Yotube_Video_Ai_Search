// 좋아요 누른 영상 안에서 "키워드/카테고리"로 찾기.
// 서버 변경 없이 화면에서 처리한다 (영상 데이터는 /api/videos/liked 로 이미 받아온 것).
//
// 나중에 진짜 AI(예: 영상마다 태그를 붙여 주는 방식)로 바꿀 때는
// 이 파일의 matchVideos() 만 바꾸면 화면(Recommend.jsx)은 그대로 쓸 수 있다.

// 카테고리 이름 → 그 카테고리를 떠올리게 하는 단어들.
// 검색어가 카테고리 이름(또는 단어 목록 안의 단어)이면 같은 카테고리 단어까지 같이 찾는다.
export const CATEGORIES = {
  먹방: ['먹방', '먹', '라면', '음식', '맛집', '맛', '학식', '편의점', '디저트', '치킨', '떡볶이', '요리', '레시피'],
  공부: ['공부', '시험', '도서관', '과제', '강의', '요약', '정리', '밤샘', '스터디'],
  개발: ['개발', '코드', '코딩', '파이썬', '프로젝트', '서버', '클라우드', '자료구조', '알고리즘', 'flask', 'sql', '해시'],
  카페: ['카페', '커피', '라떼', '디저트', '콘센트'],
  브이로그: ['브이로그', 'vlog', '일상', '캠퍼스', '산책', '하루'],
}

export const CATEGORY_NAMES = Object.keys(CATEGORIES)

const TITLE_W = 3   // 제목에 있으면 가장 중요
const DESC_W = 2    // 설명
const CHANNEL_W = 1 // 채널 이름
const DIRECT_W = 1  // 사용자가 직접 친 단어
const RELATED_W = 0.5 // 같은 카테고리의 비슷한 단어 (조금 덜 중요)

const norm = (s) => (s || '').toLowerCase()

// "먹방 라면" → ['먹방', '라면']
const splitQuery = (q) => norm(q).split(/[\s,]+/).filter(Boolean)

// 검색어 한 단어를 { 단어: 가중치 } 로 넓힌다.
function expandTerm(term) {
  const out = { [term]: DIRECT_W }
  for (const words of Object.values(CATEGORIES)) {
    if (words.includes(term)) {
      for (const w of words) if (!(w in out)) out[w] = RELATED_W
    }
  }
  return out
}

// videos 중에서 query 와 관련 있는 영상만, 관련도 높은 순으로.
// 반환: [{ video, score, matched: ['라면', '먹', ...] }]
export function matchVideos(videos, query) {
  const terms = splitQuery(query)
  if (terms.length === 0) return videos.map((video) => ({ video, score: 0, matched: [] }))

  // 단어별로 합치기 (같은 단어가 여러 번 나오면 가장 높은 가중치만)
  const weights = {}
  for (const t of terms) {
    for (const [w, wt] of Object.entries(expandTerm(t))) weights[w] = Math.max(weights[w] || 0, wt)
  }

  const results = []
  for (const video of videos) {
    const parts = [
      [norm(video.title), TITLE_W],
      [norm(video.desc), DESC_W],
      [norm(video.uploader_name), CHANNEL_W],
    ]
    let score = 0
    const matched = []
    for (const [word, wt] of Object.entries(weights)) {
      let hit = 0
      for (const [text, partW] of parts) if (text.includes(word)) hit = Math.max(hit, partW)
      if (hit) {
        score += hit * wt
        matched.push(word)
      }
    }
    if (score > 0) results.push({ video, score, matched })
  }
  return results.sort((a, b) => b.score - a.score)
}