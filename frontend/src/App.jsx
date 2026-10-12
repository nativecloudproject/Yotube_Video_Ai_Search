import { Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth'
import Layout from './components/Layout'
import Home from './features/videos/Home'
import { routes } from './features'

export default function App() {
  return (
    <AuthProvider>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          {routes.map((r) => <Route key={r.path} path={r.path} element={r.element} />)}
          <Route path="*" element={<div className="empty"><b>404</b><p>그런 페이지가 없습니다.</p></div>} />
        </Routes>
      </Layout>
    </AuthProvider>
  )
}
