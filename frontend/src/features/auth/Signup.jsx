import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth'
import * as Ic from '../../components/Icons'
import { Button, Card, ErrorBox, Field, useForm } from '../../components/ui'

export default function Signup() {
  const { signup } = useAuth()
  const nav = useNavigate()
  const [f, set] = useForm({ username: '', name: '', password: '' })
  const [err, setErr] = useState(null)

  const submit = async (e) => {
    e.preventDefault()
    setErr(null)
    try { await signup(f.username, f.name, f.password); nav('/') } catch (e) { setErr(e) }
  }

  return (
    <div className="narrow" style={{ maxWidth: 440, paddingTop: 40 }}>
      <Card>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <span className="logo" style={{ justifyContent: 'center', marginLeft: 0 }}><span className="logo-mark"><Ic.Play size={16} /></span>TubeLite</span>
          <h1 style={{ marginTop: 16, fontSize: 24, fontWeight: 400 }}>계정 만들기</h1>
          <div className="muted" style={{ fontSize: 14 }}>아이디가 채널 주소(@아이디)가 됩니다</div>
        </div>
        <form onSubmit={submit} className="form">
          <ErrorBox error={err} />
          <Field label="아이디" hint="영문·숫자 20자 이내"><input value={f.username} onChange={set('username')} autoFocus required /></Field>
          <Field label="채널 이름" hint="비우면 아이디"><input value={f.name} onChange={set('name')} /></Field>
          <Field label="비밀번호" hint="4자 이상"><input type="password" value={f.password} onChange={set('password')} required /></Field>
          <div className="row between">
            <Link to="/login" style={{ color: 'var(--blue)', fontWeight: 500 }}>이미 계정이 있습니다</Link>
            <Button variant="accent">다음</Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
