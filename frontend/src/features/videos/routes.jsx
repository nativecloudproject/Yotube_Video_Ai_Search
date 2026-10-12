import Home from './Home'
import Library from './Library'
import Results from './Results'
import Upload from './Upload'
import Watch from './Watch'

export default {
  order: 1,
  home: '/',
  nav: [
    { to: '/', label: '홈', icon: 'home', end: true },
    { to: '/feed', label: '구독', icon: 'subs' },
    { to: '/history', label: '시청 기록', icon: 'history', section: 'you' },
    { to: '/mine', label: '내 동영상', icon: 'mine', section: 'you' },
    { to: '/liked', label: '좋아요 표시한 동영상', icon: 'liked', section: 'you' },
  ],
  routes: [
    { path: '/home', element: <Home /> },
    { path: '/results', element: <Results /> },
    { path: '/watch/:id', element: <Watch /> },
    { path: '/upload', element: <Upload /> },
    { path: '/feed', element: <Library kind="feed" title="구독" empty="구독한 채널의 새 동영상이 여기에 표시됩니다." /> },
    { path: '/history', element: <Library kind="history" title="시청 기록" empty="시청한 동영상이 여기에 표시됩니다." /> },
    { path: '/mine', element: <Library kind="mine" title="내 동영상" empty="아직 올린 동영상이 없습니다." /> },
    { path: '/liked', element: <Library kind="liked" title="좋아요 표시한 동영상" empty="좋아요 표시한 동영상이 여기에 표시됩니다." /> },
  ],
}
