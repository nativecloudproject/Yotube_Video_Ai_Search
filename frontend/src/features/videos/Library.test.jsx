import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { AuthProvider } from '../../auth'
import Library from './Library'

const me = { id: 'kim', name: '김코딩', color: '#00897b', bio: '' }
const video = {
  id: 'python-board', uploader: 'kim', uploader_name: '김코딩',
  title: '파이썬으로 30분 만에 나만의 게시판 만들기', desc: 'Flask 설명',
  file: '', thumb: '', file_url: '', thumb_url: '', duration: 1800, views: 64,
  created_at: '2026-10-01T00:00:00+00:00', like_count: 2, dislike_count: 0,
  my_reaction: 'like', channel: { id: 'kim', name: '김코딩', color: '#00897b' },
  score: 0.64, matched_terms: ['파이썬'], matched_fields: ['title', 'description'],
}

const rankedResponse = { query: '파이썬', total: 2, items: [
  video,
  { ...video, id: 'second', title: '두 번째 서버 결과', score: 0.2, matched_terms: ['파이썬'], matched_fields: ['channel'] },
] }

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function Location() {
  const location = useLocation()
  return <output data-testid="location">{location.pathname}{location.search}</output>
}

function renderLibrary({ kind = 'liked', route = '/liked', response = rankedResponse, fetchImpl } = {}) {
  global.fetch = vi.fn(fetchImpl || ((url) => {
    if (url === '/api/auth/me') return Promise.resolve(json(me))
    if (url === '/api/notifications/') return Promise.resolve(json({ unread: 0 }))
    if (String(url).startsWith('/api/recommend/liked')) return Promise.resolve(json(response))
    if (url === `/api/videos/${kind}`) return Promise.resolve(json(Array.isArray(response) ? response : response.items))
    throw new Error(`Unexpected request: ${url}`)
  }))

  return render(
    <MemoryRouter initialEntries={[route]}>
      <AuthProvider>
        <Routes>
          <Route path="*" element={<><Library kind={kind} title={kind === 'liked' ? '좋아요 표시한 동영상' : '시청 기록'} empty="비어 있습니다." /><Location /></>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  )
}

function deferred() {
  let resolve
  const promise = new Promise((done) => { resolve = done })
  return { promise, resolve }
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})

describe('liked smart search library', () => {
  test('restores q from the URL and renders server-ranked evidence', async () => {
    renderLibrary({ route: '/liked?q=파이썬' })

    expect(await screen.findByText('파이썬으로 30분 만에 나만의 게시판 만들기')).toBeInTheDocument()
    expect(screen.getByText('유사도 64%')).toBeInTheDocument()
    expect(screen.getAllByText('#파이썬')[0]).toBeInTheDocument()
    expect(screen.getByText('제목 · 설명')).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /파이썬으로|두 번째 서버 결과/ }).map((link) => link.textContent)).toEqual([
      '파이썬으로 30분 만에 나만의 게시판 만들기', '두 번째 서버 결과',
    ])
  })

  test('submitting and clearing search updates the real URL', async () => {
    const user = userEvent.setup()
    renderLibrary({ route: '/liked' })

    await user.type(await screen.findByRole('searchbox'), '개발')
    await user.click(screen.getByRole('button', { name: '검색' }))
    expect(screen.getByTestId('location')).toHaveTextContent('/liked?q=%EA%B0%9C%EB%B0%9C')

    await user.click(screen.getByRole('button', { name: '검색 초기화' }))
    expect(screen.getByTestId('location')).toHaveTextContent('/liked')
  })

  test('shows a no-likes message when an empty query has no liked videos', async () => {
    renderLibrary({ response: { query: '', total: 0, items: [] } })

    expect(await screen.findByText('아직 좋아요 표시한 동영상이 없습니다.')).toBeInTheDocument()
  })

  test('shows a no-match message when a query has no matching liked videos', async () => {
    renderLibrary({ route: '/liked?q=천문학', response: { query: '천문학', total: 0, items: [] } })

    expect(await screen.findByText('“천문학”와 관련된 좋아요 영상이 없습니다. 다른 키워드로 찾아보세요.')).toBeInTheDocument()
  })

  test('shows a loading message until the liked search response arrives', async () => {
    const pending = deferred()
    renderLibrary({ fetchImpl: (url) => {
      if (url === '/api/auth/me') return Promise.resolve(json(me))
      if (url === '/api/notifications/') return Promise.resolve(json({ unread: 0 }))
      if (String(url).startsWith('/api/recommend/liked')) return pending.promise
      if (url === '/api/videos/liked') return pending.promise
      throw new Error(`Unexpected request: ${url}`)
    } })

    expect(await screen.findByText('좋아요 영상을 불러오는 중입니다.')).toBeInTheDocument()
    pending.resolve(json(rankedResponse))
    expect(await screen.findByText(video.title)).toBeInTheDocument()
  })

  test('shows a retryable error when liked search fails', async () => {
    renderLibrary({ fetchImpl: (url) => {
      if (url === '/api/auth/me') return Promise.resolve(json(me))
      if (url === '/api/notifications/') return Promise.resolve(json({ unread: 0 }))
      if (String(url).startsWith('/api/recommend/liked')) return Promise.resolve(json({ error: '서버 오류' }, 500))
      if (url === '/api/videos/liked') return Promise.resolve(json([]))
      throw new Error(`Unexpected request: ${url}`)
    } })

    expect(await screen.findByText('좋아요 영상을 불러오지 못했습니다.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeInTheDocument()
  })

  test('ignores a stale response after the URL query changes', async () => {
    const user = userEvent.setup()
    const first = deferred()
    const second = deferred()
    renderLibrary({ fetchImpl: (url) => {
      if (url === '/api/auth/me') return Promise.resolve(json(me))
      if (url === '/api/notifications/') return Promise.resolve(json({ unread: 0 }))
      if (String(url).includes('q=%EC%B2%AB')) return first.promise
      if (String(url).includes('q=%EB%91%90')) return second.promise
      if (String(url).startsWith('/api/recommend/liked')) return Promise.resolve(json({ query: '', total: 0, items: [] }))
      if (url === '/api/videos/liked') return Promise.resolve(json([]))
      throw new Error(`Unexpected request: ${url}`)
    } })

    const input = await screen.findByRole('searchbox')
    await user.type(input, '첫')
    await user.click(screen.getByRole('button', { name: '검색' }))
    await user.clear(input)
    await user.type(input, '두')
    await user.click(screen.getByRole('button', { name: '검색' }))

    second.resolve(json({ query: '두', total: 1, items: [{ ...video, id: 'second-query', title: '두 번째 응답' }] }))
    expect(await screen.findByText('두 번째 응답')).toBeInTheDocument()
    first.resolve(json({ query: '첫', total: 1, items: [{ ...video, id: 'first-query', title: '첫 번째 오래된 응답' }] }))
    expect(screen.queryByText('첫 번째 오래된 응답')).not.toBeInTheDocument()
  })

  test('keeps non-liked library endpoints working', async () => {
    renderLibrary({ kind: 'history', route: '/history', response: [{ ...video, title: '시청 기록 영상' }] })

    expect(await screen.findByText('시청 기록 영상')).toBeInTheDocument()
  })
})
