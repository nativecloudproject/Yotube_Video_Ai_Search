// features/*/routes.jsx 를 전부 모은다. 폴더를 추가하면 자동으로 여기 들어온다.
// 각 routes.jsx 는  export default { order, nav: [{to,label,end?}], routes: [{path, element}], home?: '/경로' }
const mods = import.meta.glob('./*/routes.jsx', { eager: true })

export const features = Object.entries(mods)
  .filter(([path]) => !path.includes('/_'))          // _template 은 제외
  .map(([path, m]) => ({ name: path.split('/')[1], ...m.default }))
  .sort((a, b) => (a.order ?? 50) - (b.order ?? 50))

export const navItems = features.flatMap((f) => f.nav || [])
export const routes = features.flatMap((f) => f.routes || [])
export const homePath = features.find((f) => f.home)?.home || '/'
