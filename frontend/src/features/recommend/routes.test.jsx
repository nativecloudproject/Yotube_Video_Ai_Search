import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { expect, test } from 'vitest'
import { LegacyRecommendRedirect } from './routes'

function LocationProbe() {
  const location = useLocation()
  const navigate = useNavigate()

  return <>
    <output data-testid="location">{location.pathname}{location.search}</output>
    <button type="button" onClick={() => navigate(-1)}>뒤로</button>
  </>
}

test('redirects legacy recommend URL to liked with its complete encoded search via replace', async () => {
  const user = userEvent.setup()
  render(
    <MemoryRouter initialEntries={[
      '/source?from=dashboard',
      '/recommend?q=%ED%8C%8C%EC%9D%B4%EC%8D%AC&limit=24&tag=AI%2BML',
    ]} initialIndex={1} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/recommend" element={<LegacyRecommendRedirect />} />
        <Route path="/liked" element={<LocationProbe />} />
        <Route path="/source" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  )

  expect(await screen.findByTestId('location')).toHaveTextContent(
    '/liked?q=%ED%8C%8C%EC%9D%B4%EC%8D%AC&limit=24&tag=AI%2BML',
  )
  await user.click(screen.getByRole('button', { name: '뒤로' }))
  expect(await screen.findByTestId('location')).toHaveTextContent('/source?from=dashboard')
})
