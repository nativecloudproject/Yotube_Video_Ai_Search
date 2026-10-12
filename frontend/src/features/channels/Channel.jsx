import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../../api'
import { useAuth } from '../../auth'
import Avatar from '../../components/Avatar'
import VideoCard from '../../components/VideoCard'
import { Empty, ErrorBox } from '../../components/ui'
import { fmtCount } from '../../format'

export default function Channel() {
  const { uid } = useParams()
  const { me } = useAuth()
  const nav = useNavigate()
  const [d, setD] = useState(null)
  const [err, setErr] = useState(null)

  useEffect(() => { setD(null); api.get(`/api/channels/${uid}`).then(setD).catch(setErr) }, [uid, me])

  if (err && !d) return <Empty>{err.message}</Empty>
  if (!d) return null
  const { channel: ch, videos } = d
  const subscribe = async () => {
    if (!me) return nav('/login', { state: { from: `/channel/${uid}` } })
    try { const r = await api.post(`/api/channels/${uid}/subscribe`); setD((s) => ({ ...s, channel: { ...s.channel, ...r } })) } catch (e) { setErr(e) }
  }
  const sorted = [...videos].sort((a, b) => (a.created_at < b.created_at ? 1 : -1))

  return (
    <div style={{ maxWidth: 1284, margin: '0 auto' }}>
      <div className="banner" style={{ background: `linear-gradient(120deg, ${ch.color}, #0f0f0f 80%)` }} />
      <div className="chhead">
        <Avatar name={ch.name} color={ch.color} size={128} />
        <div>
          <h1>{ch.name}</h1>
          <div className="handle">@{ch.id} · 구독자 {fmtCount(ch.subscribers)}명 · 동영상 {videos.length}개</div>
          {ch.bio && <div className="bio">{ch.bio}</div>}
          {me?.id !== ch.id
            ? <button className={`subbtn ${ch.subscribed ? 'on' : ''}`} style={{ marginLeft: 0, marginTop: 12 }} onClick={subscribe}>{ch.subscribed ? '구독중' : '구독'}</button>
            : <button className="subbtn on" style={{ marginLeft: 0, marginTop: 12 }} onClick={() => nav('/upload')}>동영상 업로드</button>}
        </div>
      </div>
      <ErrorBox error={err} />
      <div className="tabs"><span className="on">동영상</span><span>정보</span></div>
      {sorted.length === 0 ? <Empty>이 채널에는 동영상이 없습니다.</Empty>
        : <div className="chgrid">{sorted.map((v) => <VideoCard key={v.id} v={{ ...v, channel: ch }} hideChannel />)}</div>}
    </div>
  )
}
