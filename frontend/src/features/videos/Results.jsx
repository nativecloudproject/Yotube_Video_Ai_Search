import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../../api'
import { VideoRow } from '../../components/VideoCard'
import { Empty } from '../../components/ui'

export default function Results() {
  const [sp] = useSearchParams()
  const q = sp.get('q') || ''
  const [videos, setVideos] = useState(null)

  useEffect(() => {
    setVideos(null)
    api.get(`/api/videos/?q=${encodeURIComponent(q)}`).then(setVideos).catch(() => setVideos([]))
  }, [q])

  return (
    <div style={{ maxWidth: 1096, margin: '0 auto' }}>
      {videos === null ? null : videos.length === 0
        ? <Empty>"{q}"에 대한 검색 결과가 없습니다.</Empty>
        : videos.map((v) => <VideoRow key={v.id} v={v} big />)}
    </div>
  )
}
