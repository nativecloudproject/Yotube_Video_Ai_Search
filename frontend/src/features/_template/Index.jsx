import { useEffect, useState } from 'react'
import { api, toForm } from '../../api'
import { useAuth } from '../../auth'
import { Button, Card, Empty, ErrorBox, Field, Muted, useForm } from '../../components/ui'

const API = '/api/template/'   // 백엔드 폴더 이름과 같게

export default function Index() {
  const { me } = useAuth()
  const [items, setItems] = useState([])
  const [f, set, setF] = useForm({ text: '', photo: null })
  const [err, setErr] = useState(null)
  const load = () => api.get(API).then(setItems)
  useEffect(() => { load() }, [])

  const submit = async (e) => {
    e.preventDefault()
    setErr(null)
    try {
      await api.post(API, toForm(f))
      setF({ text: '', photo: null }); e.target.reset(); load()
    } catch (e) { setErr(e) }
  }

  return (
    <>
      <h1>새 기능 (template)</h1>
      {me && (
        <Card>
          <form onSubmit={submit} className="form">
            <ErrorBox error={err} />
            <Field label="내용"><input value={f.text} onChange={set('text')} required /></Field>
            <Field label="사진 (선택)"><input type="file" accept="image/*" onChange={set('photo')} /></Field>
            <Button>추가</Button>
          </form>
        </Card>
      )}
      {items.length === 0 ? <Empty>아직 없습니다.</Empty> : items.map((it) => (
        <Card key={it.id}>
          {it.photo_url && <img src={it.photo_url} alt="" style={{ maxWidth: 320, borderRadius: 8, display: 'block' }} />}
          <p>{it.text} <Muted>— {it.user_id}</Muted></p>
        </Card>
      ))}
    </>
  )
}
