# TubeLite 좋아요 영상 스마트 검색

TubeLite는 사용자가 **TubeLite 내부에서 좋아요를 누른 영상만** 로컬에서 검색하는 Flask + React 애플리케이션입니다. 검색어와 관련된 영상을 점수순으로 보여 주고, 일치한 검색어와 필드(제목·설명·채널)를 근거로 함께 표시합니다. 인증된 사용자의 좋아요 후보만 서버에서 랭킹하므로 다른 사용자의 좋아요 목록은 검색 결과에 섞이지 않습니다.

이 프로젝트는 로컬 학습·데모용입니다. 실제 YouTube 계정, YouTube API, 외부 추천 서비스와 연동하지 않으며 외부 배포를 목표로 하지 않습니다. 데이터베이스, 업로드 파일, 검색 계산, React 정적 번들은 모두 한 컴퓨터에서 동작합니다.

## 준비 사항

- Python 3.11 이상
- Node.js 18 이상과 npm
- Windows PowerShell(아래 명령 기준)

## 처음 설치하고 실행하기

```powershell
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements-dev.txt
Copy-Item .env.example .env
```

`.env`의 기본 서버 주소는 `127.0.0.1:5000`입니다. `SECRET_KEY`는 로컬 환경에 맞는 임의의 값으로 바꾸세요. 기본 데이터베이스는 저장소 루트의 `data.db`입니다.

데모 데이터는 `data.db`가 없을 때만 생성하세요. `seed.py`는 기존 사용자 데이터가 있는 환경의 초기화 도구가 아닙니다.

```powershell
if (-not (Test-Path data.db)) {
    .\.venv\Scripts\python.exe seed.py
}

Set-Location frontend
npm ci
npm run build
Set-Location ..

.\.venv\Scripts\python.exe app.py
```

브라우저에서 <http://127.0.0.1:5000>을 엽니다. `static/app/`에 커밋된 번들이 있어 소스 수정 없이 실행할 때는 Node.js 개발 서버가 필요하지 않습니다.

### 재현 가능한 데모

새로 seed한 데이터베이스에서는 다음 순서로 확인할 수 있습니다.

1. `kim` / `1234`로 로그인합니다.
2. 왼쪽 메뉴에서 **좋아요 표시한 동영상**을 엽니다.
3. `파이썬`을 검색합니다.
4. URL의 `/liked?q=...`, 결과 수, 유사도 점수, 일치 검색어와 일치 필드를 확인합니다.
5. **초기화**를 누르거나 브라우저 뒤로/앞으로 이동해 검색 상태가 URL과 함께 복원되는지 확인합니다.

seed 데이터는 Python의 고정 난수 seed를 사용하므로 좋아요 관계와 `파이썬` 데모를 반복해서 재현할 수 있습니다. 단, 생성 시각은 실행 시점을 기준으로 만들어집니다.

## 개발과 테스트

백엔드 전체 테스트는 저장소 안의 임시 디렉터리를 사용하면 제한된 Windows 환경에서도 권한 문제를 피할 수 있습니다.

```powershell
.\.venv\Scripts\python.exe -m pytest -q --basetemp=.pytest-tmp
```

프론트엔드 전체 테스트와 프로덕션 번들은 npm CLI로 실행합니다.

```powershell
Set-Location frontend
npm test
npm run build
Set-Location ..
```

프론트엔드 화면을 수정하며 개발 서버가 필요하면 Flask 서버를 함께 실행한 상태에서 다음 명령을 사용합니다. Vite가 API 요청을 `127.0.0.1:5000`으로 전달합니다.

```powershell
Set-Location frontend
npm run dev
```

`npm run build`는 `static/app/index.html`과 `static/app/assets/`의 해시 번들을 새로 만듭니다. Flask는 이 결과물을 제공합니다.

## 좋아요 스마트 검색 API

`GET /api/recommend/liked`는 로그인이 필요하며 현재 세션 사용자가 좋아요한 영상만 검색합니다.

요청 예:

```http
GET /api/recommend/liked?q=%ED%8C%8C%EC%9D%B4%EC%8D%AC&limit=24
```

- `q`: 선택 검색어. NFKC 정규화와 양끝 공백 제거 후 최대 100자입니다.
- `limit`: 선택 결과 개수. 기본값은 `24`, 허용 범위는 `1`~`50`입니다.
- 빈 검색어 또는 문장부호만 있는 검색어는 좋아요 영상을 최신순으로 반환합니다.
- 로그인하지 않으면 `401`, 잘못된 `q` 또는 `limit`은 `400`입니다.

성공 응답 예:

```json
{
  "query": "파이썬",
  "total": 1,
  "items": [
    {
      "id": "video-id",
      "title": "파이썬으로 30분 만에 나만의 게시판 만들기",
      "desc": "Flask + SQLite. 코드 전부 화면에 나옵니다.",
      "score": 0.5455,
      "matched_terms": ["파이썬"],
      "matched_fields": ["title"]
    }
  ]
}
```

`items`에는 화면 카드에 필요한 영상·채널 메타데이터도 포함되지만, 전체 사용자들의 `likes`/`dislikes` 목록은 노출하지 않습니다. `total`은 `limit` 적용 전 일치 결과 수입니다. 과거 화면 주소인 `/recommend?q=...`는 쿼리 문자열을 보존하면서 `/liked?q=...`로 replace 이동합니다.

## 랭킹 방식

검색은 외부 모델이나 네트워크 없이 `features/recommend/search.py`에서 계산합니다.

1. 검색어와 각 영상의 제목, 설명, 채널명을 NFKC 정규화하고 소문자 단어로 나눕니다.
2. 각 단어 자체와 단어 내부의 문자 2-그램을 TF-IDF 토큰으로 만듭니다. 예를 들어 긴 단어가 완전히 같지 않아도 일부 문자 쌍이 겹치면 후보가 될 수 있습니다.
3. 검색어 벡터와 각 필드 벡터의 코사인 유사도를 구합니다.
4. 제목 `3.0`, 설명 `1.5`, 채널 `1.0`의 가중치를 적용한 뒤 총 가중치 `5.5`로 정규화해 0~1 점수를 만듭니다.
5. 점수 내림차순, 생성 시각 내림차순, 영상 ID 오름차순으로 정렬해 동점에서도 결정적인 순서를 유지합니다.

### 알려진 제약

- TF-IDF 말뭉치는 그 사용자의 좋아요 영상만 사용하므로 좋아요 수가 적으면 IDF와 점수 구분력이 약하고, 좋아요 목록이 바뀌면 같은 검색어의 점수가 달라질 수 있습니다.
- 단순 단어·문자 2-그램 비교라 의미가 같은 동의어, 문맥, 오타를 이해하지 못합니다.
- 문자 2-그램은 부분 일치를 늘리는 대신 짧거나 흔한 문자열에서 관련성이 낮은 결과를 만들 수 있습니다.
- 한국어 형태소 분석을 하지 않으므로 조사·활용형을 별도 의미 단위로 처리하지 않습니다.
- 검색 대상은 제목, 설명, 채널명뿐이며 자막·댓글·영상 내용은 색인하지 않습니다.

## 주요 구조

```text
app.py                         Flask 서버와 React 정적 번들 제공
seed.py                        로컬 데모 데이터 생성
features/recommend/api.py      인증, 입력 검증, 사용자별 후보 제한
features/recommend/search.py   가중 TF-IDF 랭킹
frontend/src/                  React 소스와 Vitest 테스트
static/app/                    npm run build로 생성한 배포용 로컬 번들
tests/                         백엔드 pytest 테스트
```

기존 일반 좋아요 목록 API인 `GET /api/videos/liked`는 그대로 유지되며, 스마트 검색 화면은 `GET /api/recommend/liked`를 사용합니다.
