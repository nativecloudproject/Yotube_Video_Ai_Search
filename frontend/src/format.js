// 유튜브식 숫자·시간 표기

export function fmtViews(n) {
  n = Number(n) || 0
  if (n >= 1e8) return `${(n / 1e8).toFixed(n % 1e8 ? 1 : 0)}억회`
  if (n >= 1e4) return `${(n / 1e4).toFixed(n >= 1e5 || n % 1e4 === 0 ? 0 : 1)}만회`
  if (n >= 1e3) return `${(n / 1e3).toFixed(1).replace(/\.0$/, '')}천회`
  return `${n}회`
}

export function fmtCount(n) {
  n = Number(n) || 0
  if (n >= 1e4) return `${(n / 1e4).toFixed(n >= 1e5 ? 0 : 1).replace(/\.0$/, '')}만`
  if (n >= 1e3) return `${(n / 1e3).toFixed(1).replace(/\.0$/, '')}천`
  return String(n)
}

export function timeAgo(iso) {
  if (!iso) return ''
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  const t = [[31536000, '년'], [2592000, '개월'], [604800, '주'], [86400, '일'], [3600, '시간'], [60, '분']]
  for (const [sec, label] of t) if (s >= sec) return `${Math.floor(s / sec)}${label} 전`
  return '방금 전'
}

export function fmtDuration(sec) {
  sec = Math.max(0, Math.round(Number(sec) || 0))
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60
  const mm = h ? String(m).padStart(2, '0') : String(m)
  return `${h ? h + ':' : ''}${mm}:${String(s).padStart(2, '0')}`
}

export function fmtDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`
}
