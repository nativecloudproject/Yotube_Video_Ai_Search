import { useEffect, useState } from 'react'
import { api } from '../../api'
import { useAuth } from '../../auth'
import RequireLogin from '../../components/RequireLogin'
import VideoCard from '../../components/VideoCard'
import { Empty, Muted } from '../../components/ui'

const KEYWORDS = ['클라우드', '파이썬', '자료구조', '개발', '카페', '브이로그']

export default function Recommend() {
  const { me } = useAuth()
  const [query, setQuery] = useState('클라우드')
  const [input, setInput] = useState('클라우드')
  const [videos, setVideos] = useState(null)

  useEffect(() => {
    if (!me) return
    setVideos(null)
    api.get(`/api/recommend/?q=${encodeURIComponent(query)}`).then(setVideos).catch(() => setVideos([]))
  }, [me, query])

  const search = (e) => {
    e.preventDefault()
    const q = input.trim()
    if (q) setQuery(q)
  }

  const choose = (keyword) => {
    setInput(keyword)
    setQuery(keyword)
  }

  return (
    <RequireLogin>
      <h1>AI 키워드 추천</h1>
      <p className="muted" style={{ marginBottom: 16 }}>
        키워드와 영상의 제목·설명·채널명을 비교해 유사도가 높은 영상을 추천합니다.
      </p>

      <form className="form" onSubmit={search} style={{ maxWidth: 640, marginBottom: 16 }}>
        <div className="row" style={{ flexWrap: 'nowrap' }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="예: 클라우드, 파이썬, 카페"
            aria-label="추천 키워드"
          />
          <button className="btn" type="submit">추천</button>
        </div>
      </form>

      <div className="chips">
        {KEYWORDS.map((keyword) => (
          <button
            key={keyword}
            className={`chip ${query === keyword ? 'on' : ''}`}
            onClick={() => choose(keyword)}
          >
            {keyword}
          </button>
        ))}
      </div>

      <h2 style={{ margin: '8px 0 18px' }}>“{query}” 추천 영상</h2>
      {videos === null ? null : videos.length === 0
        ? <Empty>추천할 동영상이 없습니다.</Empty>
        : <div className="vgrid">{videos.map((v) => (
            <div key={v.id}>
              <VideoCard v={v} />
              <Muted>키워드 유사도 {Math.round(v.score * 100)}%</Muted>
            </div>
          ))}</div>}
    </RequireLogin>
  )
}
