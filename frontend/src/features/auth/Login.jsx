import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth'
import * as Ic from '../../components/Icons'
import { Button, Card, ErrorBox, Field, useForm } from '../../components/ui'

export default function Login() {
  const { login } = useAuth()
  const nav = useNavigate()
  const loc = useLocation()
  const [f, set] = useForm({ username: '', password: '' })
  const [err, setErr] = useState(null)

  const submit = async (e) => {
    e.preventDefault()
    setErr(null)
    try { await login(f.username, f.password); nav(loc.state?.from || '/') } catch (e) { setErr(e) }
  }

  return (
    <div className="narrow" style={{ maxWidth: 440, paddingTop: 40 }}>
      <Card>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <span className="logo" style={{ justifyContent: 'center', marginLeft: 0 }}><span className="logo-mark"><Ic.Play size={16} /></span>TubeLite</span>
          <h1 style={{ marginTop: 16, fontSize: 24, fontWeight: 400 }}>로그인</h1>
          <div className="muted" style={{ fontSize: 14 }}>TubeLite로 이동</div>
        </div>
        <form onSubmit={submit} className="form">
          <ErrorBox error={err} />
          <Field label="아이디"><input value={f.username} onChange={set('username')} autoFocus required /></Field>
          <Field label="비밀번호"><input type="password" value={f.password} onChange={set('password')} required /></Field>
          <div className="row between">
            <Link to="/signup" style={{ color: 'var(--blue)', fontWeight: 500 }}>계정 만들기</Link>
            <Button variant="accent">다음</Button>
          </div>
          <p className="muted" style={{ marginTop: 16 }}>데모 계정: kim · lee · park · choi (비밀번호 1234)</p>
        </form>
      </Card>
    </div>
  )
}
