import Recommend from './Recommend'

export default {
  order: 5,
  nav: [{ to: '/recommend', label: 'AI 맞춤 추천', icon: 'liked', section: 'you' }],
  routes: [{ path: '/recommend', element: <Recommend /> }],
}
