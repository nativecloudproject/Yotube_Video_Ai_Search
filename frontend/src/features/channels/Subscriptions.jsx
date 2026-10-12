import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api'
import { useAuth } from '../../auth'
import Avatar from '../../components/Avatar'
import RequireLogin from '../../components/RequireLogin'
import { Empty } from '../../components/ui'
import { fmtCount } from '../../format'

export default function Subscriptions() {
  const { me } = useAuth()
  const [subs, setSubs] = useState(null)
  useEffect(() => { if (me) api.get('/api/channels/subscriptions').then(setSubs).catch(() => setSubs([])) }, [me])
  return (
    <RequireLogin>
      <h1>모든 구독</h1>
      {subs === null ? null : subs.length === 0 ? <Empty>구독한 채널이 없습니다.</Empty> : (
        <div className="subsgrid">
          {subs.map((c) => (
            <Link key={c.id} to={`/channel/${c.id}`} className="subcard">
              <Avatar name={c.name} color={c.color} size={104} />
              <b>{c.name}</b>
              <span className="muted">@{c.id} · 구독자 {fmtCount(c.subscribers)}명</span>
            </Link>
          ))}
        </div>
      )}
    </RequireLogin>
  )
}
