// 서버와 이야기하는 유일한 통로. 실패하면 서버가 준 메시지로 Error 를 던진다.
async function request(method, url, body) {
  const opts = { method, headers: {}, credentials: 'same-origin' }
  if (body instanceof FormData) opts.body = body
  else if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json'
    opts.body = JSON.stringify(body)
  }
  const res = await fetch(url, opts)
  const text = await res.text()
  let data = null
  try { data = text ? JSON.parse(text) : null } catch { data = { error: text } }
  if (!res.ok) {
    const err = new Error((data && data.error) || `${res.status} ${res.statusText}`)
    err.status = res.status
    throw err
  }
  return data
}

export const api = {
  get: (url) => request('GET', url),
  post: (url, body) => request('POST', url, body),
}

// 폼 객체를 FormData 로 (파일 포함). 빈 값은 보내지 않는다.
export function toForm(obj) {
  const fd = new FormData()
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== null && v !== '') fd.append(k, v)
  }
  return fd
}

export const fmtDate = (iso) => (iso ? iso.slice(0, 16).replace('T', ' ') : '')
export const fmtWon = (n) => (Number(n) || 0).toLocaleString('ko-KR') + '원'
