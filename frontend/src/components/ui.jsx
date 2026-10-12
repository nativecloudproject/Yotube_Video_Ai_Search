import { useState } from 'react'

export const Card = ({ children, className = '', ...p }) => <div className={`card ${className}`} {...p}>{children}</div>
export const Muted = ({ children }) => <span className="muted">{children}</span>
export const Empty = ({ children }) => <div className="empty">{children}</div>
export const Row = ({ children, between }) => <div className={`row ${between ? 'between' : ''}`}>{children}</div>

export function Button({ variant = 'primary', ...p }) {
  return <button className={`btn ${variant}`} {...p} />
}

export function Field({ label, hint, children }) {
  return <label className="field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>
}

export function ErrorBox({ error }) {
  return error ? <div className="alert">{String(error.message || error)}</div> : null
}

// 폼 상태를 한 줄로.  const [f, set] = useForm({title:''}); <input value={f.title} onChange={set('title')} />
export function useForm(init) {
  const [f, setF] = useState(init)
  const set = (k) => (e) => {
    const t = e.target
    const v = t.type === 'file' ? t.files[0] : t.type === 'checkbox' ? t.checked : t.value
    setF((s) => ({ ...s, [k]: v }))
  }
  return [f, set, setF]
}
