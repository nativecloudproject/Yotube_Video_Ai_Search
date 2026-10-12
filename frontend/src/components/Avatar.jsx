// 유튜브식 이니셜 아바타.  name 의 첫 글자 + 계정 색.
export default function Avatar({ name = '?', color = '#606060', size = 36, ...p }) {
  return (
    <span className="avatar" style={{ width: size, height: size, background: color, fontSize: size * 0.45 }} {...p}>
      {String(name).trim().charAt(0).toUpperCase() || '?'}
    </span>
  )
}
