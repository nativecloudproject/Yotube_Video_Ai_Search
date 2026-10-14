import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth'
import { navItems } from '../features'
import Avatar from './Avatar'
import * as Ic from './Icons'

const ICONS = { home: Ic.Home, subs: Ic.Subs, history: Ic.History, mine: Ic.MyVideos, liked: Ic.Liked }

function SideItem({ to, label, icon, end }) {
  const Icon = ICONS[icon] || Ic.Home
  return (
    <NavLink to={to} end={end} className="side-item">
      <Icon /><span>{label}</span>
    </NavLink>
  )
}

export default function Layout({ children }) {
  const { me, unread, logout } = useAuth()
  const nav = useNavigate()
  const loc = useLocation()
  const [sp] = useSearchParams()
  const [open, setOpen] = useState(() => window.innerWidth > 1300)
  const [menu, setMenu] = useState(false)
  const [subs, setSubs] = useState([])
  const isWatch = loc.pathname.startsWith('/watch/')

  useEffect(() => {
    if (me) api.get('/api/channels/subscriptions').then(setSubs).catch(() => setSubs([]))
    else setSubs([])
  }, [me, loc.pathname])

  const search = (e) => {
    e.preventDefault()
    const q = e.target.q.value.trim()
    nav(q ? `/results?q=${encodeURIComponent(q)}` : '/')
  }

  const main = navItems.filter((n) => n.section !== 'you')
  const you = navItems.filter((n) => n.section === 'you')
  const mini = !open || isWatch

  return (
    <div className={`yt ${mini ? 'mini' : ''} ${isWatch ? 'watch' : ''}`}>
      <header className="topbar">
        <div className="tb-left">
          <button className="ibtn" onClick={() => setOpen((o) => !o)} aria-label="메뉴"><Ic.Menu /></button>
          <Link to="/" className="logo"><span className="logo-mark"><Ic.Play size={16} /></span>TubeLite<sup>KR</sup></Link>
        </div>
         <form className="tb-search" onSubmit={search}>
          <input name="q" placeholder="검색" defaultValue={sp.get('q') || ''} key={loc.search} />
          <button type="submit" aria-label="검색"><Ic.Search /></button>
        </form>
        <div className="tb-right">
          {me ? (
            <>
              <Link to="/upload" className="ibtn" title="만들기"><Ic.Upload /></Link>
              <Link to="/notifications" className="ibtn bell" title="알림">
                <Ic.Bell />{unread > 0 && <span className="badge">{unread > 9 ? '9+' : unread}</span>}
              </Link>
              <button className="avatar-btn" onClick={() => setMenu((m) => !m)}>
                <Avatar name={me.name} color={me.color} size={32} />
              </button>
              {menu && (
                <div className="menu" onMouseLeave={() => setMenu(false)}>
                  <div className="menu-head">
                    <Avatar name={me.name} color={me.color} size={40} />
                    <div><b>{me.name}</b><div className="muted">@{me.id}</div></div>
                  </div>
                  <Link to={`/channel/${me.id}`} onClick={() => setMenu(false)}>내 채널 보기</Link>
                  <Link to="/mine" onClick={() => setMenu(false)}>내 동영상</Link>
                  <button onClick={async () => { setMenu(false); await logout(); nav('/') }}>로그아웃</button>
                </div>
              )}
            </>
          ) : (
            <Link to="/login" className="signin"><span className="signin-ic">👤</span> 로그인</Link>
          )}
        </div>
      </header>

      <aside className="sidebar">
        <nav>
          {main.map((n) => <SideItem key={n.to} {...n} />)}
        </nav>
        {!mini && (
          <>
            <hr />
            <div className="side-title">{me ? '내 페이지' : '보관함'}</div>
            <nav>{you.map((n) => <SideItem key={n.to} {...n} />)}</nav>
            {me && subs.length > 0 && (
              <>
                <hr />
                <div className="side-title">구독</div>
                <nav>
                  {subs.map((c) => (
                    <NavLink key={c.id} to={`/channel/${c.id}`} className="side-item">
                      <Avatar name={c.name} color={c.color} size={24} /><span>{c.name}</span>
                    </NavLink>
                  ))}
                </nav>
              </>
            )}
            {!me && (
              <div className="side-login">
                <p>로그인하면 동영상에 좋아요를 표시하고 댓글을 달거나 구독할 수 있습니다.</p>
                <Link to="/login" className="signin"><span className="signin-ic">👤</span> 로그인</Link>
              </div>
            )}
            <hr />
            <div className="side-foot">TubeLite · 클라우드 컴퓨팅 실습 원본<br />지금은 전부 이 서버 한 대 안에서 돕니다</div>
          </>
        )}
      </aside>

      <main className="content">{children}</main>
    </div>
  )
}
