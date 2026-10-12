import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api'
import { useAuth } from '../../auth'
import * as Ic from '../../components/Icons'
import RequireLogin from '../../components/RequireLogin'
import { Empty, Muted } from '../../components/ui'
import { timeAgo } from '../../format'

export default function Notifications() {
  const { me, setUnread } = useAuth()
  const [items, setItems] = useState(null)

  useEffect(() => {
    if (!me) return
    api.get('/api/notifications/').then(async (d) => {
      setItems(d.items)
      if (d.unread) { await api.post('/api/notifications/read'); setUnread(0) }
    }).catch(() => setItems([]))
  }, [me, setUnread])

  return (
    <RequireLogin>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <h1>알림</h1>
        {items === null ? <Muted>불러오는 중…</Muted> : items.length === 0 ? <Empty>알림이 없습니다.</Empty>
          : items.map((n) => (
            <Link key={n.id} to={n.link || '#'} className={`notif ${n.read ? '' : 'unread'}`}>
              <span style={{ color: 'var(--text-2)', marginTop: 2 }}><Ic.Bell /></span>
              <div>
                <div><b>{n.subject}</b> <span className="t">{timeAgo(n.created_at)}</span></div>
                <div>{n.body}</div>
              </div>
            </Link>
          ))}
      </div>
    </RequireLogin>
  )
}
