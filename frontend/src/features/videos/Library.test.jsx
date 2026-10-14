import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
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

const rankedResponse = {
  query: '파이썬', total: 2, items: [
    { ...video, id: 'server-first', title: '서버가 먼저 보낸 낮은 점수 결과', score: 0.2 },
    { ...video, id: 'server-second', title: '서버가 두 번째로 보낸 높은 점수 결과', score: 0.93 },
  ],
}
const EMPTY = { query: '', total: 0, items: [] }
const NONEMPTY_CORPUS = { query: '', total: 1, items: [video] }

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function Location() {
  const location = useLocation()
  return <output data-testid="location">{location.pathname}{location.search}</output>
}

function HistoryControls() {
  const navigate = useNavigate()
  return <><button type="button" onClick={() => navigate(-1)}>뒤로</button><button type="button" onClick={() => navigate(1)}>앞으로</button></>
}

function renderLibrary({ kind = 'liked', route = '/liked', entries, initialIndex, response = rankedResponse, corpusResponse = NONEMPTY_CORPUS, fetchImpl } = {}) {
  global.fetch = vi.fn(fetchImpl || ((url) => {
    if (url === '/api/auth/me') return Promise.resolve(json(me))
    if (url === '/api/notifications/') return Promise.resolve(json({ unread: 0 }))
    if (url === '/api/recommend/liked?q=&limit=1') return Promise.resolve(json(corpusResponse))
    if (String(url).startsWith('/api/recommend/liked')) return Promise.resolve(json(response))
    if (url === `/api/videos/${kind}`) return Promise.resolve(json(Array.isArray(response) ? response : response.items))
    throw new Error(`Unexpected request: ${url}`)
  }))

  return render(
    <MemoryRouter initialEntries={entries || [route]} initialIndex={initialIndex} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <Routes>
          <Route path="*" element={<><Library kind={kind} title={kind === 'liked' ? '좋아요 표시한 동영상' : '시청 기록'} empty="비어 있습니다." /><Location /><HistoryControls /></>} />
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

function authenticated(fetchImpl, corpusResponse = NONEMPTY_CORPUS) {
  return (url, options) => {
    if (url === '/api/auth/me') return Promise.resolve(json(me))
    if (url === '/api/notifications/') return Promise.resolve(json({ unread: 0 }))
    if (url === '/api/recommend/liked?q=&limit=1') return Promise.resolve(json(corpusResponse))
    return fetchImpl(url, options)
  }
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})

describe('liked smart search library', () => {
  test('restores q in the searchbox and preserves the server order despite inverted scores', async () => {
    renderLibrary({ route: '/liked?q=파이썬' })

    expect(await screen.findByText('서버가 먼저 보낸 낮은 점수 결과')).toBeInTheDocument()
    expect(screen.getByRole('searchbox')).toHaveValue('파이썬')
    expect(screen.getByText('유사도 20%')).toBeInTheDocument()
    expect(screen.getAllByText('#파이썬')[0]).toBeInTheDocument()
    expect(screen.getAllByText('제목 · 설명')[0]).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /서버가 .* 결과/ }).map((link) => link.textContent)).toEqual([
      '서버가 먼저 보낸 낮은 점수 결과', '서버가 두 번째로 보낸 높은 점수 결과',
    ])
  })

  test('renders a response only for the exact encoded q and limit boundary', async () => {
    const exactUrl = '/api/recommend/liked?q=%ED%8C%8C%EC%9D%B4%EC%8D%AC%20%26%20Flask&limit=24'
    renderLibrary({ fetchImpl: authenticated((url) => {
      if (url === '/api/recommend/liked?q=&limit=24') return Promise.resolve(json(EMPTY))
      if (url === exactUrl) return Promise.resolve(json({ query: '파이썬 & Flask', total: 1, items: [{ ...video, title: '정확한 인코딩 경계 결과' }] }))
      return Promise.resolve(json({ error: '잘못된 검색 경계' }, 400))
    }) })
    const user = userEvent.setup()

    await user.type(await screen.findByRole('searchbox'), '파이썬 & Flask')
    await user.click(screen.getByRole('button', { name: '검색' }))
    expect(await screen.findByText('정확한 인코딩 경계 결과')).toBeInTheDocument()
    expect(screen.getByTestId('location')).toHaveTextContent('/liked?q=%ED%8C%8C%EC%9D%B4%EC%8D%AC+%26+Flask')
  })

  test('does not add history after a same-normalized submit, so Back restores the prior query', async () => {
    const previous = { query: '이전', total: 1, items: [{ ...video, id: 'previous', title: '이전 결과' }] }
    const development = { query: '개발', total: 1, items: [{ ...video, id: 'development', title: '개발 결과' }] }
    const user = userEvent.setup()
    renderLibrary({ entries: ['/liked?q=이전', '/liked?q=개발'], initialIndex: 1, fetchImpl: authenticated((url) => {
      if (url === '/api/recommend/liked?q=%EC%9D%B4%EC%A0%84&limit=24') return Promise.resolve(json(previous))
      if (url === '/api/recommend/liked?q=%EA%B0%9C%EB%B0%9C&limit=24') return Promise.resolve(json(development))
      throw new Error(`Unexpected request: ${url}`)
    }) })
    const input = await screen.findByRole('searchbox')
    expect(await screen.findByText('개발 결과')).toBeInTheDocument()

    await user.clear(input)
    await user.type(input, ' 개발 ')
    await user.click(screen.getByRole('button', { name: '검색' }))

    expect(input).toHaveValue('개발')
    await user.click(screen.getByRole('button', { name: '뒤로' }))
    expect(await screen.findByText('이전 결과')).toBeInTheDocument()
    expect(screen.getByRole('searchbox')).toHaveValue('이전')
    expect(screen.getByTestId('location')).toHaveTextContent('/liked?q=이전')
  })

  test('does not add history after a blank-only submit, so Back restores the prior query', async () => {
    const previous = { query: '이전', total: 1, items: [{ ...video, id: 'previous', title: '이전 결과' }] }
    const user = userEvent.setup()
    renderLibrary({ entries: ['/liked?q=이전', '/liked'], initialIndex: 1, fetchImpl: authenticated((url) => {
      if (url === '/api/recommend/liked?q=&limit=24') return Promise.resolve(json(EMPTY))
      if (url === '/api/recommend/liked?q=%EC%9D%B4%EC%A0%84&limit=24') return Promise.resolve(json(previous))
      throw new Error(`Unexpected request: ${url}`)
    }) })
    const input = await screen.findByRole('searchbox')

    await user.type(input, '   ')
    await user.click(screen.getByRole('button', { name: '검색' }))

    expect(input).toHaveValue('')
    await user.click(screen.getByRole('button', { name: '뒤로' }))
    expect(await screen.findByText('이전 결과')).toBeInTheDocument()
    expect(screen.getByRole('searchbox')).toHaveValue('이전')
    expect(screen.getByTestId('location')).toHaveTextContent('/liked?q=이전')
  })

  test('does not add history after reselecting the current example, so Back restores the prior query', async () => {
    const previous = { query: '이전', total: 1, items: [{ ...video, id: 'previous', title: '이전 결과' }] }
    const development = { query: '개발', total: 1, items: [{ ...video, id: 'development', title: '개발 결과' }] }
    const user = userEvent.setup()
    renderLibrary({ entries: ['/liked?q=이전', '/liked?q=개발'], initialIndex: 1, fetchImpl: authenticated((url) => {
      if (url === '/api/recommend/liked?q=%EC%9D%B4%EC%A0%84&limit=24') return Promise.resolve(json(previous))
      if (url === '/api/recommend/liked?q=%EA%B0%9C%EB%B0%9C&limit=24') return Promise.resolve(json(development))
      throw new Error(`Unexpected request: ${url}`)
    }) })
    const input = await screen.findByRole('searchbox')
    expect(await screen.findByText('개발 결과')).toBeInTheDocument()

    await user.clear(input)
    await user.type(input, '편집 중인 검색어')
    await user.click(screen.getByRole('button', { name: '개발' }))

    expect(input).toHaveValue('개발')
    await user.click(screen.getByRole('button', { name: '뒤로' }))
    expect(await screen.findByText('이전 결과')).toBeInTheDocument()
    expect(screen.getByRole('searchbox')).toHaveValue('이전')
    expect(screen.getByTestId('location')).toHaveTextContent('/liked?q=이전')
  })

  test.each(['/liked', '/liked?q=개발'])('hides search and gives like-addition guidance for an empty corpus at %s', async (route) => {
    renderLibrary({ route, response: { query: route.includes('?') ? '개발' : '', total: 0, items: [] }, corpusResponse: EMPTY })

    expect(await screen.findByText('아직 좋아요 표시한 동영상이 없습니다. 영상에서 좋아요를 누르면 여기에서 검색할 수 있습니다.')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: '좋아요 영상 스마트 검색' })).not.toBeInTheDocument()
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument()
  })

  test('offers a usable clear action when a query has no match', async () => {
    const user = userEvent.setup()
    renderLibrary({ route: '/liked?q=천문학', response: { query: '천문학', total: 0, items: [] } })

    expect(await screen.findByText('“천문학”와 관련된 좋아요 영상이 없습니다. 다른 키워드로 찾아보세요.')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: '좋아요 영상 스마트 검색' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '검색 초기화' }))
    expect(screen.getByTestId('location')).toHaveTextContent('/liked')
  })

  test('shows loading until the liked search response arrives', async () => {
    const pending = deferred()
    renderLibrary({ fetchImpl: authenticated((url) => {
      if (url === '/api/recommend/liked?q=&limit=24') return pending.promise
      throw new Error(`Unexpected request: ${url}`)
    }) })

    expect(await screen.findByText('좋아요 영상을 불러오는 중입니다.')).toBeInTheDocument()
    await act(async () => { pending.resolve(json(rankedResponse)); await Promise.resolve() })
    expect(await screen.findByText('서버가 먼저 보낸 낮은 점수 결과')).toBeInTheDocument()
  })

  test('retries a failed liked search and renders the recovered response', async () => {
    let failed = false
    renderLibrary({ route: '/liked?q=개발', fetchImpl: authenticated((url) => {
      if (url !== '/api/recommend/liked?q=%EA%B0%9C%EB%B0%9C&limit=24') return Promise.resolve(json({ error: '잘못된 검색 경계' }, 400))
      if (!failed) { failed = true; return Promise.resolve(json({ error: '서버 오류' }, 500)) }
      return Promise.resolve(json({ query: '개발', total: 1, items: [{ ...video, title: '재시도 후 복구된 결과' }] }))
    }) })
    const user = userEvent.setup()

    expect(await screen.findByText('좋아요 영상을 불러오지 못했습니다.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '다시 시도' }))
    expect(await screen.findByText('재시도 후 복구된 결과')).toBeInTheDocument()
  })

  test('keeps the newer result after a stale success finishes through React updates', async () => {
    const user = userEvent.setup()
    const first = deferred()
    const second = deferred()
    renderLibrary({ fetchImpl: authenticated((url) => {
      if (url === '/api/recommend/liked?q=&limit=24') return Promise.resolve(json(EMPTY))
      if (url === '/api/recommend/liked?q=%EC%B2%AB&limit=24') return first.promise
      if (url === '/api/recommend/liked?q=%EB%91%90&limit=24') return second.promise
      throw new Error(`Unexpected request: ${url}`)
    }) })
    const input = await screen.findByRole('searchbox')

    await user.type(input, '첫')
    await user.click(screen.getByRole('button', { name: '검색' }))
    await user.clear(input)
    await user.type(input, '두')
    await user.click(screen.getByRole('button', { name: '검색' }))
    await act(async () => { second.resolve(json({ query: '두', total: 1, items: [{ ...video, id: 'new', title: '새 쿼리 결과' }] })); await Promise.resolve() })
    expect(await screen.findByText('새 쿼리 결과')).toBeInTheDocument()

    await act(async () => { first.resolve(json({ query: '첫', total: 1, items: [{ ...video, id: 'old', title: '오래된 성공 응답' }] })); await Promise.resolve() })
    await waitFor(() => {
      expect(screen.getByText('새 쿼리 결과')).toBeInTheDocument()
      expect(screen.queryByText('오래된 성공 응답')).not.toBeInTheDocument()
    })
  })

  test('suppresses a stale server error after a newer result succeeds', async () => {
    const user = userEvent.setup()
    const first = deferred()
    const second = deferred()
    renderLibrary({ fetchImpl: authenticated((url) => {
      if (url === '/api/recommend/liked?q=&limit=24') return Promise.resolve(json(EMPTY))
      if (url === '/api/recommend/liked?q=%EC%B2%AB&limit=24') return first.promise
      if (url === '/api/recommend/liked?q=%EB%91%90&limit=24') return second.promise
      throw new Error(`Unexpected request: ${url}`)
    }) })
    const input = await screen.findByRole('searchbox')

    await user.type(input, '첫')
    await user.click(screen.getByRole('button', { name: '검색' }))
    await user.clear(input)
    await user.type(input, '두')
    await user.click(screen.getByRole('button', { name: '검색' }))
    await act(async () => { second.resolve(json({ query: '두', total: 1, items: [{ ...video, id: 'new', title: '새 쿼리 성공' }] })); await Promise.resolve() })
    expect(await screen.findByText('새 쿼리 성공')).toBeInTheDocument()

    await act(async () => { first.resolve(json({ error: '오래된 서버 오류' }, 500)); await Promise.resolve() })
    await waitFor(() => {
      expect(screen.getByText('새 쿼리 성공')).toBeInTheDocument()
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })
  })

  test('aborts an unmounted pending liked search at the fetch boundary', async () => {
    const pending = new Promise(() => {})
    let requestSignal
    const { unmount } = renderLibrary({ fetchImpl: authenticated((url, options) => {
      if (url === '/api/recommend/liked?q=&limit=24') {
        requestSignal = options?.signal
        return pending
      }
      throw new Error(`Unexpected request: ${url}`)
    }) })

    await screen.findByText('좋아요 영상을 불러오는 중입니다.')
    expect(requestSignal?.aborted).toBe(false)
    unmount()
    expect(requestSignal?.aborted).toBe(true)
  })

  test('restores input, URL, and result through real router back and forward navigation', async () => {
    const development = { query: '개발', total: 1, items: [{ ...video, id: 'development', title: '개발 결과' }] }
    const study = { query: '공부', total: 1, items: [{ ...video, id: 'study', title: '공부 결과' }] }
    const user = userEvent.setup()
    renderLibrary({ route: '/liked?q=개발', fetchImpl: authenticated((url) => {
      if (url === '/api/recommend/liked?q=%EA%B0%9C%EB%B0%9C&limit=24') return Promise.resolve(json(development))
      if (url === '/api/recommend/liked?q=%EA%B3%B5%EB%B6%80&limit=24') return Promise.resolve(json(study))
      throw new Error(`Unexpected request: ${url}`)
    }) })

    expect(await screen.findByText('개발 결과')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '공부' }))
    expect(await screen.findByText('공부 결과')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '뒤로' }))
    expect(await screen.findByText('개발 결과')).toBeInTheDocument()
    expect(screen.getByRole('searchbox')).toHaveValue('개발')
    expect(screen.getByTestId('location')).toHaveTextContent('/liked?q=개발')
    await user.click(screen.getByRole('button', { name: '앞으로' }))
    expect(await screen.findByText('공부 결과')).toBeInTheDocument()
    expect(screen.getByRole('searchbox')).toHaveValue('공부')
    expect(screen.getByTestId('location')).toHaveTextContent('/liked?q=%EA%B3%B5%EB%B6%80')
  })

  test('keeps non-liked library endpoints working', async () => {
    renderLibrary({ kind: 'history', route: '/history', response: [{ ...video, title: '시청 기록 영상' }] })

    expect(await screen.findByText('시청 기록 영상')).toBeInTheDocument()
  })
})
