import { Link } from 'react-router-dom'
import { fmtDuration, fmtViews, timeAgo } from '../format'
import Avatar from './Avatar'

function Thumb({ v, className = '' }) {
  return (
    <div className={`vthumb ${className}`}>
      {v.thumb_url ? <img src={v.thumb_url} alt="" loading="lazy" /> : <div className="vthumb-ph" />}
      {v.duration > 0 && <span className="dur">{fmtDuration(v.duration)}</span>}
    </div>
  )
}

// 홈·채널 그리드용
export default function VideoCard({ v, hideChannel = false }) {
  const ch = v.channel || { id: v.uploader, name: v.uploader_name }
  return (
    <div className="vcard">
      <Link to={`/watch/${v.id}`}><Thumb v={v} /></Link>
      <div className="vmeta">
        {!hideChannel && <Link to={`/channel/${ch.id}`}><Avatar name={ch.name} color={ch.color} size={36} /></Link>}
        <div className="vtext">
          <Link to={`/watch/${v.id}`} className="vtitle">{v.title}</Link>
          {!hideChannel && <Link to={`/channel/${ch.id}`} className="vsub">{ch.name}</Link>}
          <div className="vsub">조회수 {fmtViews(v.views)} · {timeAgo(v.created_at)}</div>
        </div>
      </div>
    </div>
  )
}

// 시청 페이지 오른쪽 · 검색 결과용 (가로형)
export function VideoRow({ v, big = false }) {
  const ch = v.channel || { id: v.uploader, name: v.uploader_name }
  return (
    <div className={`vrow ${big ? 'big' : ''}`}>
      <Link to={`/watch/${v.id}`}><Thumb v={v} /></Link>
      <div className="vtext">
        <Link to={`/watch/${v.id}`} className="vtitle">{v.title}</Link>
        {big ? (
          <>
            <div className="vsub">조회수 {fmtViews(v.views)} · {timeAgo(v.created_at)}</div>
            <Link to={`/channel/${ch.id}`} className="vsub vch"><Avatar name={ch.name} color={ch.color} size={24} /> {ch.name}</Link>
            {v.desc && <div className="vsub vdesc">{v.desc}</div>}
          </>
        ) : (
          <>
            <Link to={`/channel/${ch.id}`} className="vsub">{ch.name}</Link>
            <div className="vsub">조회수 {fmtViews(v.views)} · {timeAgo(v.created_at)}</div>
          </>
        )}
      </div>
    </div>
  )
}
