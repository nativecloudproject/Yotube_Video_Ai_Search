import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../auth'

// 로그인이 필요한 화면을 감싼다. 로그인 후 원래 자리로 돌아온다.
export default function RequireLogin({ children }) {
  const { me } = useAuth()
  const loc = useLocation()
  if (me === undefined) return null
  if (!me) return <Navigate to="/login" state={{ from: loc.pathname }} replace />
  return children
}
