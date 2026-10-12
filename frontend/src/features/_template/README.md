# 프론트 기능 폴더

`routes.jsx` 하나만 규칙이다. `default export` 로 `{ order, nav, routes, home? }` 를 내보내면
`src/features/index.js` 가 자동으로 모아 라우터와 상단 메뉴에 붙인다.

| 키 | 뜻 |
|---|---|
| `order` | 메뉴 순서 (작을수록 왼쪽) |
| `nav` | `[{ to: '/wishlist', label: '찜' }]` · 메뉴에 안 넣으려면 `[]` |
| `routes` | `[{ path: '/wishlist', element: <Index/> }]` |
| `home` | `'/wishlist'` 를 주면 `/` 가 여기로 온다 (샘플마다 하나만) |

서버와는 `src/api.js` 의 `api.get / api.post` 로만 이야기한다. 파일은 `toForm({...})` 으로.
로그인이 필요한 화면은 `<RequireLogin>` 으로 감싼다.
