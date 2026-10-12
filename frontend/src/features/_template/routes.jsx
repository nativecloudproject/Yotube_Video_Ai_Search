// [복사해서 쓰세요]  경로와 메뉴 이름을 바꾸면 자동으로 등록됩니다.
import Index from './Index'

export default {
  order: 50,
  nav: [{ to: '/template', label: '새 기능' }],
  routes: [{ path: '/template', element: <Index /> }],
}
