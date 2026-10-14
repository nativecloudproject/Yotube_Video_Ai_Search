import { Navigate, useLocation } from 'react-router-dom'

export function LegacyRecommendRedirect() {
  const location = useLocation()

  return <Navigate replace to={{ pathname: '/liked', search: location.search }} />
}

export default {
  order: 5,
  nav: [],
  routes: [{ path: '/recommend', element: <LegacyRecommendRedirect /> }],
}
