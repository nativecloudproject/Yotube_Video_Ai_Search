import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../../api'
import { useAuth } from '../../auth'
import RequireLogin from '../../components/RequireLogin'
import VideoCard from '../../components/VideoCard'
import { Empty } from '../../components/ui'

const EXAMPLE_QUERIES = ['개발', '공부', '브이로그']
const FIELD_LABELS = { title: '제목', description: '설명', channel: '채널' }

function MatchEvidence({ item }) {
  const fields = (item.matched_fields || []).map((field) => FIELD_LABELS[field] || field)
  const terms = item.matched_terms || []

  if (item.score == null && terms.length === 0 && fields.length === 0) return null

  return (
    <div className="search-evidence">
      {item.score != null && <span className="similarity">유사도 {Math.round(item.score * 100)}%</span>}
      {terms.length > 0 && <div className="matched-terms">{terms.map((term) => <span key={term} className="matched-term">#{term}</span>)}</div>}
      {fields.length > 0 && <span className="matched-fields">{fields.join(' · ')}</span>}
    </div>
  )
}

// 구독 피드 · 시청 기록 · 내 동영상 · 좋아요 — 같은 화면, API 만 다르다.
export default function Library({ kind, title, empty }) {
  const { me } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [input, setInput] = useState('')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [retrySequence, setRetrySequence] = useState(0)
  const canSearch = kind === 'liked'
  const query = canSearch ? (searchParams.get('q') || '') : ''

  useEffect(() => {
    if (canSearch) setInput(query)
  }, [canSearch, query])

  useEffect(() => {
    if (!me) return

    let cancelled = false
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    setData(null)

    const url = canSearch
      ? `/api/recommend/liked?q=${encodeURIComponent(query)}&limit=24`
      : `/api/videos/${kind}`

    api.get(url, { signal: controller.signal }).then((response) => {
      if (cancelled) return
      setData(canSearch ? response : { total: response.length, items: response })
    }).catch((requestError) => {
      if (cancelled) return
      setError(requestError)
    }).finally(() => {
      if (!cancelled) setLoading(false)
    })

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [canSearch, kind, me, query, retrySequence])

  const updateQuery = (next) => {
    setInput(next)
    const params = new URLSearchParams(searchParams)
    if (next) params.set('q', next)
    else params.delete('q')
    if (params.toString() !== searchParams.toString()) setSearchParams(params)
  }

  const search = (event) => {
    event.preventDefault()
    updateQuery(input.trim())
  }

  const clearSearch = () => updateQuery('')
  const retry = () => setRetrySequence((sequence) => sequence + 1)
  const items = data?.items || []

  return (
    <RequireLogin>
      <h1>{canSearch ? '좋아요 영상 스마트 검색' : title}</h1>

      {canSearch && (
        <section className="liked-search-panel" aria-label="좋아요 영상 스마트 검색">
          <p className="liked-search-description">좋아요를 누른 영상에서 제목, 설명, 채널을 기준으로 찾아보세요.</p>
          <form className="liked-search-form" onSubmit={search}>
            <input
              type="search"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="예: 파이썬, 공부, 브이로그"
              aria-label="좋아요 영상 검색어"
            />
            <button className="btn" type="submit">검색</button>
            {query && <button className="btn ghost clear-search" type="button" onClick={clearSearch} aria-label="검색 초기화">초기화</button>}
          </form>
          <div className="example-queries" aria-label="예시 검색어">
            {EXAMPLE_QUERIES.map((example) => <button key={example} className="chip" type="button" onClick={() => updateQuery(example)}>{example}</button>)}
          </div>
        </section>
      )}

      <section className="library-status" aria-live="polite">
        {loading ? <Empty>{canSearch ? '좋아요 영상을 불러오는 중입니다.' : '영상을 불러오는 중입니다.'}</Empty> : error ? (
          <div className="search-error" role="alert">
            <p>{canSearch ? '좋아요 영상을 불러오지 못했습니다.' : '영상을 불러오지 못했습니다.'}</p>
            <button className="btn ghost retry-search" type="button" onClick={retry}>다시 시도</button>
          </div>
        ) : data && items.length === 0 ? (
          <Empty>{canSearch && query ? `“${query}”와 관련된 좋아요 영상이 없습니다. 다른 키워드로 찾아보세요.` : canSearch ? '아직 좋아요 표시한 동영상이 없습니다.' : empty}</Empty>
        ) : data ? (
          <>
            {canSearch && query && <h2 className="search-result-count">“{query}” 관련 영상 {data.total}개</h2>}
            <div className="vgrid">
              {items.map((item) => (
                <div key={item.id} className="liked-result-card">
                  <VideoCard v={item} hideChannel={kind === 'mine'} />
                  {canSearch && <MatchEvidence item={item} />}
                </div>
              ))}
            </div>
          </>
        ) : null}
      </section>
    </RequireLogin>
  )
}
