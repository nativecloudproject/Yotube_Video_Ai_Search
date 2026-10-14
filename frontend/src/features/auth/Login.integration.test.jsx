import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { beforeEach, expect, test, vi } from 'vitest'
import App from '../../App'

const me = { id: 'kim', name: '김코딩', color: '#00897b', bio: '' }
const result = {
  id: 'python-board', uploader: 'kim', uploader_name: '김코딩',
  title: '로그인 후 보존된 파이썬 검색 결과', desc: 'Flask 설명',
  file: '', thumb: '', file_url: '', thumb_url: '', duration: 1800, views: 64,
  created_at: '2026-10-01T00:00:00+00:00', like_count: 2, dislike_count: 0,
  my_reaction: 'like', channel: { id: 'kim', name: '김코딩', color: '#00897b' },
  score: 0.64, matched_terms: ['파이썬'], matched_fields: ['title'],
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function LocationProbe() {
  const location = useLocation()
  return <output data-testid="location">{location.pathname}{location.search}{location.hash}</output>
}

function installFetchBoundary() {
  let signedIn = false

  vi.stubGlobal('fetch', vi.fn((url, options = {}) => {
    if (url === '/api/auth/me') return Promise.resolve(json(signedIn ? me : null))
    if (url === '/api/auth/login' && options.method === 'POST') {
      signedIn = true
      return Promise.resolve(json({ ok: true }))
    }
    if (url === '/api/notifications/') return Promise.resolve(json({ unread: 0 }))
    if (url === '/api/channels/subscriptions') return Promise.resolve(json([]))
    if (url === '/api/recommend/liked?q=&limit=1') {
      return Promise.resolve(json({ query: '', total: 1, items: [result] }))
    }
    if (url === '/api/recommend/liked?q=%ED%8C%8C%EC%9D%B4%EC%8D%AC&limit=24') {
      return Promise.resolve(json({ query: '파이썬', total: 1, items: [result] }))
    }
    if (url === '/api/recommend/liked?q=&limit=24') {
      return Promise.resolve(json({ query: '', total: 1, items: [{ ...result, title: '쿼리가 유실된 응답' }] }))
    }
    throw new Error(`Unexpected request: ${options.method || 'GET'} ${url}`)
  }))
}

beforeEach(() => {
  installFetchBoundary()
})

test.each([
  '/liked?q=%ED%8C%8C%EC%9D%B4%EC%8D%AC#saved',
  '/recommend?q=%ED%8C%8C%EC%9D%B4%EC%8D%AC#saved',
])('returns a signed-out protected search to its encoded liked URL after real login from %s', async (entry) => {
  const user = userEvent.setup()
  render(
    <MemoryRouter initialEntries={[entry]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <App />
      <LocationProbe />
    </MemoryRouter>,
  )

  await user.type(await screen.findByLabelText('아이디'), 'kim')
  await user.type(screen.getByLabelText('비밀번호'), '1234')
  await user.click(screen.getByRole('button', { name: '다음' }))

  expect(await screen.findByText('로그인 후 보존된 파이썬 검색 결과')).toBeInTheDocument()
  expect(screen.getByRole('searchbox', { name: '좋아요 영상 검색어' })).toHaveValue('파이썬')
  expect(screen.getByTestId('location')).toHaveTextContent('/liked?q=%ED%8C%8C%EC%9D%B4%EC%8D%AC#saved')
})
