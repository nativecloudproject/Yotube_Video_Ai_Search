import { useEffect, useMemo, useState } from 'react'
import { api } from '../../api'
import { useAuth } from '../../auth'
import RequireLogin from '../../components/RequireLogin'
import VideoCard from '../../components/VideoCard'
import { Empty } from '../../components/ui'
import { CATEGORY_NAMES, matchVideos } from '../recommend/match'



// 구독 피드 · 시청 기록 · 내 동영상 · 좋아요 — 같은 화면, API 만 다르다
// 그중 '좋아요 표시한 동영상'(kind === 'liked')에는 키워드·카테고리로 찾는 기능(AI 맞춤 추천)이 붙는다.
export default function Library({ kind, title, empty }) {
  const { me } = useAuth()
  const [videos, setVideos] = useState(null)
  const [input, setInput] = useState('')
  const [query, setQuery] = useState('')
  const canSearch = kind === 'liked'

  useEffect(() => {
    if (!me) return
    setVideos(null)
    api.get(`/api/videos/${kind}`).then(setVideos).catch(() => setVideos([]))
  }, [kind, me])

  // 다른 페이지로 옮겨 가면 검색어 비우기
  useEffect(() => {
    setInput('')
    setQuery('')
  }, [kind])

  const rows = useMemo(() => {
    if (!videos) return []
    if (!canSearch || !query) return videos.map((video) => ({ video, matched: [] }))
    return matchVideos(videos, query)
  }, [videos, query, canSearch])

  // 카테고리마다 좋아요 영상이 몇 개 걸리는지 (칩 옆 숫자)
  const counts = useMemo(
    () => Object.fromEntries(CATEGORY_NAMES.map((n) => [n, videos ? matchVideos(videos, n).length : 0])),
    [videos],
  )

  const search = (e) => {
    e.preventDefault()
    setQuery(input.trim())
  }

  const choose = (keyword) => {
    // 이미 선택된 칩을 다시 누르면 해제 (전체 보기)
    const next = query === keyword ? '' : keyword
    setInput(next)
    setQuery(next)
  }

  return (
    <RequireLogin>
      <h1>{title}</h1>

      {canSearch && videos && videos.length > 0 && (
        <div className="ai-panel">
          <div className="ai-title">AI 맞춤 추천</div>
          <p className="ai-sub">제목이 기억나지 않을 때, 키워드나 카테고리로 좋아요 영상을 찾아보세요.</p>

          <form className="ai-form" onSubmit={search}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="예: 먹방, 공부, 카페"
              aria-label="좋아요 영상에서 찾을 키워드"
            />
            <button className="btn" type="submit">찾기</button>
          </form>

          <div className="ai-chips">
            {CATEGORY_NAMES.map((name) => (
              <button
                key={name}
                type="button"
                className={`chip ${query === name ? 'on' : ''} ${counts[name] === 0 ? 'zero' : ''}`}
                onClick={() => choose(name)}
              >
                {name}
                <span className="chip-n">{counts[name]}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {videos === null ? null : videos.length === 0 ? (
        <Empty>{empty}</Empty>
      ) : canSearch && query && rows.length === 0 ? (
        <Empty>“{query}”와 관련된 좋아요 영상이 없습니다. 다른 키워드로 찾아보세요.</Empty>
      ) : (
        <>
          {canSearch && query && <h2 style={{ margin: '8px 0 18px' }}>“{query}” 관련 영상 {rows.length}개</h2>}
          <div className="vgrid">
            {rows.map(({ video, matched }) => (
              <div key={video.id}>
                <VideoCard v={video} hideChannel={kind === 'mine'} />
                {matched.length > 0 && (
                  <div className="ai-tags">
                    {matched.slice(0, 4).map((w) => <span key={w} className="ai-tag">#{w}</span>)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </RequireLogin>
  )
}