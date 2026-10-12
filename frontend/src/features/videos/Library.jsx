import { useEffect, useState } from 'react'
import { api } from '../../api'
import { useAuth } from '../../auth'
import RequireLogin from '../../components/RequireLogin'
import VideoCard from '../../components/VideoCard'
import { Empty } from '../../components/ui'

// 구독 피드 · 시청 기록 · 내 동영상 · 좋아요 — 같은 화면, API 만 다르다
export default function Library({ kind, title, empty }) {
  const { me } = useAuth()
  const [videos, setVideos] = useState(null)

  useEffect(() => {
    if (!me) return
    setVideos(null)
    api.get(`/api/videos/${kind}`).then(setVideos).catch(() => setVideos([]))
  }, [kind, me])

  return (
    <RequireLogin>
      <h1>{title}</h1>
      {videos === null ? null : videos.length === 0
        ? <Empty>{empty}</Empty>
        : <div className="vgrid">{videos.map((v) => <VideoCard key={v.id} v={v} hideChannel={kind === 'mine'} />)}</div>}
    </RequireLogin>
  )
}
