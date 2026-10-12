import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../../api'
import { useAuth } from '../../auth'
import Avatar from '../../components/Avatar'
import * as Ic from '../../components/Icons'
import { VideoRow } from '../../components/VideoCard'
import { Empty, ErrorBox } from '../../components/ui'
import { fmtCount, fmtDate, fmtViews, timeAgo } from '../../format'

function Comment({ c, me, onLike }) {
  return (
    <div className="comment">
      <Link to={`/channel/${c.author}`}><Avatar name={c.author_name} color={c.author_color} size={40} /></Link>
      <div style={{ minWidth: 0 }}>
        <span className="who">@{c.author}</span><span className="when">{timeAgo(c.created_at)}</span>
        <p>{c.text}</p>
        <button className={`clike ${c.liked ? 'on' : ''}`} onClick={() => onLike(c)} disabled={!me}>
          {c.liked ? <Ic.ThumbUpFilled size={16} /> : <Ic.ThumbUp size={16} />}{c.like_count > 0 && fmtCount(c.like_count)}
        </button>
      </div>
    </div>
  )
}

export default function Watch() {
  const { id } = useParams()
  const { me } = useAuth()
  const nav = useNavigate()
  const [d, setD] = useState(null)
  const [err, setErr] = useState(null)
  const [text, setText] = useState('')
  const [focus, setFocus] = useState(false)
  const [expand, setExpand] = useState(false)
  const [sort, setSort] = useState('new')

  useEffect(() => {
    setD(null); setExpand(false); setText('')
    api.get(`/api/videos/${id}`).then(setD).catch(setErr)
    window.scrollTo(0, 0)
  }, [id])

  if (err && !d) return <Empty>{err.message}</Empty>
  if (!d) return null
  const { video: v, channel: ch, comments, related } = d
  const patchVideo = (p) => setD((s) => ({ ...s, video: { ...s.video, ...p } }))

  const react = async (value) => {
    if (!me) return nav('/login', { state: { from: `/watch/${id}` } })
    const next = v.my_reaction === value ? null : value
    patchVideo(await api.post(`/api/videos/${id}/react`, { value: next }))
  }
  const subscribe = async () => {
    if (!me) return nav('/login', { state: { from: `/watch/${id}` } })
    try { const r = await api.post(`/api/channels/${ch.id}/subscribe`); setD((s) => ({ ...s, channel: { ...s.channel, ...r } })) } catch (e) { setErr(e) }
  }
  const comment = async (e) => {
    e.preventDefault()
    if (!text.trim()) return
    try {
      const c = await api.post(`/api/comments/${id}`, { text })
      setD((s) => ({ ...s, comments: [c, ...s.comments] })); setText(''); setFocus(false)
    } catch (e) { setErr(e) }
  }
  const likeComment = async (c) => {
    const r = await api.post(`/api/comments/${c.id}/like`)
    setD((s) => ({ ...s, comments: s.comments.map((x) => (x.id === c.id ? { ...x, ...r } : x)) }))
  }
  const share = async () => {
    try { await navigator.clipboard.writeText(window.location.href); alert('링크를 복사했습니다.') } catch { /* ignore */ }
  }
  const sorted = sort === 'top' ? [...comments].sort((a, b) => b.like_count - a.like_count) : comments

  return (
    <div className="watch-wrap">
      <div>
        <div className="player">
          {v.file_url ? <video src={v.file_url} controls autoPlay />
            : <div className="nofile"><Ic.Play size={48} /><span>데모 동영상입니다. 영상 파일이 없습니다 — 업로드에서 직접 올려 보세요.</span></div>}
        </div>
        <h1 className="wtitle">{v.title}</h1>

        <div className="wbar">
          <div className="wch">
            <Link to={`/channel/${ch.id}`}><Avatar name={ch.name} color={ch.color} size={40} /></Link>
            <div>
              <Link to={`/channel/${ch.id}`} className="name">{ch.name}</Link>
              <div className="subs">구독자 {fmtCount(ch.subscribers)}명</div>
            </div>
            {me?.id !== ch.id && (
              <button className={`subbtn ${ch.subscribed ? 'on' : ''}`} onClick={subscribe}>{ch.subscribed ? '구독중' : '구독'}</button>
            )}
          </div>
          <div className="wactions">
            <div className="likegroup">
              <button className={`pill ${v.my_reaction === 'like' ? 'on' : ''}`} onClick={() => react('like')}>
                {v.my_reaction === 'like' ? <Ic.ThumbUpFilled /> : <Ic.ThumbUp />} {fmtCount(v.like_count)}
              </button>
              <button className={`pill ${v.my_reaction === 'dislike' ? 'on' : ''}`} onClick={() => react('dislike')} title="싫어요">
                {v.my_reaction === 'dislike' ? <Ic.ThumbDownFilled /> : <Ic.ThumbDown />}
              </button>
            </div>
            <button className="pill" onClick={share}><Ic.Share /> 공유</button>
            <button className="pill" style={{ padding: '0 8px' }} title="더보기"><Ic.Dots /></button>
          </div>
        </div>

        <div className={`descbox ${expand ? '' : 'clamp'}`} onClick={() => setExpand((x) => !x)}>
          <b>조회수 {fmtViews(v.views)} · {expand ? fmtDate(v.created_at) : timeAgo(v.created_at)}</b>
          <div className="body">{v.desc || '설명이 없습니다.'}</div>
          <span className="more">{expand ? '간략히' : '...더보기'}</span>
        </div>

        <section className="comments">
          <div className="chead">
            <h2>댓글 {comments.length.toLocaleString()}개</h2>
            <button className="pill" style={{ background: 'none' }} onClick={() => setSort((s) => (s === 'new' ? 'top' : 'new'))}>
              <Ic.Sort /> {sort === 'new' ? '최신순' : '인기 댓글순'}
            </button>
          </div>
          <ErrorBox error={err} />
          {me ? (
            <form className="cform" onSubmit={comment}>
              <Avatar name={me.name} color={me.color} size={40} />
              <div className="box">
                <input value={text} onChange={(e) => setText(e.target.value)} onFocus={() => setFocus(true)} placeholder="댓글 추가..." />
                {(focus || text) && (
                  <div className="acts">
                    <button type="button" className="pill" onClick={() => { setText(''); setFocus(false) }}>취소</button>
                    <button type="submit" className="pill primary" disabled={!text.trim()}>댓글</button>
                  </div>
                )}
              </div>
            </form>
          ) : (
            <p className="muted" style={{ marginBottom: 24 }}><Link to="/login" state={{ from: `/watch/${id}` }} style={{ color: 'var(--blue)' }}>로그인</Link>하면 댓글을 남길 수 있습니다.</p>
          )}
          {sorted.map((c) => <Comment key={c.id} c={c} me={me} onLike={likeComment} />)}
        </section>
      </div>

      <aside className="related">
        {related.map((r) => <VideoRow key={r.id} v={r} />)}
      </aside>
    </div>
  )
}
