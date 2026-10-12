import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, toForm } from '../../api'
import * as Ic from '../../components/Icons'
import RequireLogin from '../../components/RequireLogin'
import { Button, Card, ErrorBox, Field, useForm } from '../../components/ui'
import { fmtDuration } from '../../format'

// 영상에서 1초 지점 프레임을 잡아 썸네일(JPEG)로 만든다 — 유튜브가 자동 썸네일을 만드는 것처럼
function captureThumb(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    video.muted = true; video.playsInline = true; video.preload = 'auto'; video.src = url
    const done = (blob, duration) => { URL.revokeObjectURL(url); resolve({ blob, duration }) }
    video.onloadedmetadata = () => { video.currentTime = Math.min(1, Math.max(0, video.duration / 2)) }
    video.onseeked = () => {
      try {
        const c = document.createElement('canvas')
        c.width = 640; c.height = Math.round(640 * video.videoHeight / video.videoWidth) || 360
        c.getContext('2d').drawImage(video, 0, 0, c.width, c.height)
        c.toBlob((b) => done(b, video.duration), 'image/jpeg', 0.85)
      } catch { done(null, video.duration) }
    }
    video.onerror = () => done(null, 0)
  })
}

export default function Upload() {
  const nav = useNavigate()
  const fileRef = useRef()
  const [f, set, setF] = useForm({ title: '', desc: '' })
  const [file, setFile] = useState(null)
  const [thumb, setThumb] = useState(null)          // Blob (자동) 또는 File (직접 선택)
  const [thumbUrl, setThumbUrl] = useState('')
  const [duration, setDuration] = useState(0)
  const [previewUrl, setPreviewUrl] = useState('')
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl) }, [previewUrl])

  const pick = async (fl) => {
    if (!fl) return
    setFile(fl); setErr(null)
    setPreviewUrl(URL.createObjectURL(fl))
    if (!f.title) setF((s) => ({ ...s, title: fl.name.replace(/\.[^.]+$/, '') }))
    const { blob, duration } = await captureThumb(fl)
    setDuration(duration || 0)
    if (blob) { setThumb(blob); setThumbUrl(URL.createObjectURL(blob)) }
  }

  const pickThumb = (e) => {
    const t = e.target.files[0]
    if (t) { setThumb(t); setThumbUrl(URL.createObjectURL(t)) }
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!file) { setErr(new Error('동영상 파일을 선택하세요.')); return }
    setErr(null); setBusy(true)
    try {
      const fd = toForm({ title: f.title, desc: f.desc, video: file, duration: Math.round(duration) })
      if (thumb) fd.append('thumb', thumb, 'thumb.jpg')
      const v = await api.post('/api/videos/', fd)
      nav(`/watch/${v.id}`)
    } catch (e) { setErr(e) } finally { setBusy(false) }
  }

  return (
    <RequireLogin>
      <div className="narrow" style={{ maxWidth: 860 }}>
        <h1>동영상 업로드</h1>
        <Card>
          <form onSubmit={submit} className="form">
            <ErrorBox error={err} />
            {!file ? (
              <div className="dropzone" onClick={() => fileRef.current.click()}
                   onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files[0]) }}>
                <div className="big-ic"><Ic.Upload size={32} /></div>
                <div style={{ fontSize: 15, color: 'var(--text)' }}>동영상 파일을 드래그 앤 드롭하여 업로드</div>
                <div className="muted" style={{ margin: '6px 0 16px' }}>mp4 · webm · 32MB 이하 · 지금은 서버 폴더 uploads/ 에 저장됩니다 (6주차에 S3로)</div>
                <span className="btn accent">파일 선택</span>
              </div>
            ) : (
              <div className="preview">
                <div>
                  <video src={previewUrl} controls />
                  <div className="muted" style={{ marginTop: 6 }}>{file.name} · {(file.size / 1048576).toFixed(1)}MB{duration ? ` · ${fmtDuration(duration)}` : ''}</div>
                </div>
                <div>
                  <div className="vthumb">{thumbUrl ? <img src={thumbUrl} alt="" /> : <div className="vthumb-ph" />}</div>
                  <div className="muted" style={{ margin: '6px 0' }}>썸네일 (영상에서 자동으로 뽑았습니다 · 바꾸려면 선택)</div>
                  <input type="file" accept="image/*" onChange={pickThumb} />
                </div>
              </div>
            )}
            <input ref={fileRef} type="file" accept="video/*" hidden onChange={(e) => pick(e.target.files[0])} />
            <Field label="제목 (필수)"><input value={f.title} onChange={set('title')} maxLength={100} required placeholder="동영상을 설명하는 제목을 추가하세요" /></Field>
            <Field label="설명"><textarea value={f.desc} onChange={set('desc')} placeholder="시청자에게 동영상에 대해 알려주세요" /></Field>
            <div className="row between">
              {file && <button type="button" className="btn ghost" onClick={() => { setFile(null); setThumb(null); setThumbUrl(''); setDuration(0) }}>다른 파일</button>}
              <span />
              <Button variant="accent" disabled={busy || !file}>{busy ? '업로드 중…' : '게시'}</Button>
            </div>
          </form>
        </Card>
      </div>
    </RequireLogin>
  )
}
