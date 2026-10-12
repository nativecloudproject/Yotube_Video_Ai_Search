# 새 기능 만들기 (백엔드 폴더 + 프론트 폴더)

기능 하나 = 백엔드 폴더 하나 + 프론트 폴더 하나. 이름을 같게 맞춘다.

## 1. 백엔드 `features/<이름>/`

1. 이 폴더(`features/_template`)를 복사해서 이름을 바꾼다. 예) `features/wishlist`
2. `api.py` 의 `Blueprint('template', ...)` 첫 인자를 바꾼다.
3. 서버를 다시 켜면 `app.py` 가 `/api/wishlist/...` 로 자동 등록한다.

## 2. 프론트 `frontend/src/features/<이름>/`

1. `frontend/src/features/_template` 을 복사해서 같은 이름으로 바꾼다.
2. `routes.jsx` 의 경로(`/template`)와 메뉴 이름, `Index.jsx` 의 `API` 상수를 바꾼다.
3. `npm run dev` (개발) 또는 `npm run build` (배포). 라우트와 메뉴에 자동으로 붙는다.

## 규칙 하나

파일·데이터·알림·주기작업은 **반드시 `core`** 를 통해서만 쓴다.

| 필요한 것 | 부르는 것 |
|---|---|
| 파일 | `from core import storage` → `storage.save(file)`, `storage.url(key)` |
| 데이터 | `from core import db` → `db.put / get / find / all / update / delete` |
| 알림 | `from core import notify` → `notify.send(user_id, 제목, 내용, link=)` |
| 주기작업 | `from core import jobs` → `@jobs.every(hours=24)` |

그래야 6·7·9주차에 core 가 S3 · DynamoDB · Lambda 로 바뀔 때 이 기능도 함께 클라우드로 간다.
