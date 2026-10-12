import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { api } from './api'

const Ctx = createContext(null)

export function AuthProvider({ children }) {
  const [me, setMe] = useState(undefined)      // undefined = 아직 모름, null = 로그아웃
  const [unread, setUnread] = useState(0)

  const refresh = useCallback(async () => {
    const u = await api.get('/api/auth/me')
    setMe(u)
    if (u) {
      try { const n = await api.get('/api/notifications/'); setUnread(n.unread) } catch { setUnread(0) }
    } else setUnread(0)
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const login = async (username, password) => { await api.post('/api/auth/login', { username, password }); await refresh() }
  const signup = async (username, name, password) => { await api.post('/api/auth/signup', { username, name, password }); await refresh() }
  const logout = async () => { await api.post('/api/auth/logout'); await refresh() }

  return <Ctx.Provider value={{ me, unread, setUnread, refresh, login, signup, logout }}>{children}</Ctx.Provider>
}

export const useAuth = () => useContext(Ctx)
