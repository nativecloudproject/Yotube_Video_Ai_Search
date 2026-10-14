# TubeLite Liked-Video Smart Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a fully local TubeLite flow that ranks only the signed-in user's liked videos with weighted TF-IDF search and exposes the results through a tested Flask API and React UI.

**Architecture:** Keep the existing Flask/SQLite monolith and React SPA. Add a pure-Python ranking module behind an authenticated `/api/recommend/liked` endpoint, make `/liked` URL-driven and server-ranked, and retain `/recommend` only as a client-side compatibility redirect.

**Tech Stack:** Python 3.11+, Flask 3.1, SQLite, pytest, React 18, React Router 6, Vite 5, Vitest 3, jsdom, React Testing Library

**Spec:** `docs/superpowers/specs/2026-10-14-liked-video-smart-search-design.md`

## Global Constraints

- Run entirely on the local machine; do not add Google/YouTube APIs, OAuth, cloud services, vector databases, external embedding APIs, PyTorch, or runtime model downloads.
- Rank only videos whose stored `likes` list contains the authenticated session user.
- Use title weight `3.0`, description weight `1.5`, and channel-name weight `1.0` with normalized word tokens plus character 2-grams.
- Expose `GET /api/recommend/liked?q=<query>&limit=<1..50>`; default limit is `24`, query length is at most `100`, and blank queries return liked videos newest first.
- Preserve the existing `data.db`, `uploads/`, `/api/videos/liked`, authentication, reaction, upload, watch, comment, channel, subscription, and notification behavior.
- Bind the direct local server to `127.0.0.1` by default and enable debug mode only through an explicit environment value.
- Keep runtime search dependencies to Python's standard library; pytest and browser-test packages are development dependencies only.
- Commit the Vite production output under `static/app` so `python app.py` serves the same UI as `frontend/src`.
- Follow strict TDD for authored production behavior: observe each named test fail for the intended missing behavior before implementing it.

## Review Focus

The following high-risk inputs must be pinned by the indicated owning task:

1. An empty or one-video liked corpus must not divide by zero or invent matches — Task 2 search tests and Task 3 API tests.
2. A query containing only whitespace or punctuation must behave exactly like a blank query — Task 2 search tests.
3. Normalized queries at 100 characters must pass while 101 characters fail, and invalid `limit` values must return 400 — Task 3 API tests.
4. A slower response for an old URL query must not overwrite a newer query's results — Task 4 React tests.
5. `/recommend?q=<encoded text>` must preserve the query while replacing history with `/liked?q=<encoded text>` — Task 5 route test.

---

### Task 1: Testable Flask Application and Isolated Database

**Files:**
- Create: `requirements-dev.txt`
- Create: `tests/test_app_factory.py`
- Create after the factory passes: `tests/conftest.py`
- Modify: `requirements.txt`
- Modify: `core/db.py`
- Modify: `app.py`
- Modify: `.env.example`

**Interfaces:**
- Consumes: existing `core.db` document operations and feature Blueprint modules.
- Produces: `core.db.configure(path: str) -> None` and `app.create_app(test_config: dict | None = None) -> Flask` for every later backend task.
- Produces fixtures: `app`, `client`, `login_as`, and `put_video` in `tests/conftest.py`.

- [ ] **Step 1: Declare runtime and test dependencies**

Set `requirements.txt` to the compatible runtime ranges `Flask>=3.1,<4` and `python-dotenv>=1,<2`. Create `requirements-dev.txt` with `-r requirements.txt` and `pytest>=8.3,<10`.

- [ ] **Step 2: Write the failing app-factory tests**

Create `tests/test_app_factory.py` with tests that import `app` inside each test so collection succeeds before `create_app` exists:

```python
def test_create_app_uses_configured_database(tmp_path):
    import app as app_module
    assert hasattr(app_module, "create_app")
    first = app_module.create_app({"TESTING": True, "DATABASE": str(tmp_path / "first.db"), "SECRET_KEY": "test"})
    with first.app_context():
        db.put("probe", {"id": "first"})
        assert db.get("probe", "first")["id"] == "first"
    second = app_module.create_app({"TESTING": True, "DATABASE": str(tmp_path / "second.db"), "SECRET_KEY": "test"})
    with second.app_context():
        assert db.get("probe", "first") is None

def test_create_app_preserves_auth_route(tmp_path):
    import app as app_module
    assert hasattr(app_module, "create_app")
    flask_app = app_module.create_app({"TESTING": True, "DATABASE": str(tmp_path / "auth.db"), "SECRET_KEY": "test"})
    response = flask_app.test_client().get("/api/auth/me")
    assert response.status_code == 200
    assert response.get_json() is None
```

These tests catch a missing factory, a connection that remains attached to the wrong database, and lost Blueprint registration.

- [ ] **Step 3: Create the local Python environment and install the declared dependencies**

Run:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
```

Expected: dependency installation succeeds inside `.venv`; no global Python package is changed.

- [ ] **Step 4: Run the tests and verify RED**

Run: `.\.venv\Scripts\python.exe -m pytest tests/test_app_factory.py -q`

Expected: FAIL because `app.create_app` and database reconfiguration do not exist yet.

- [ ] **Step 5: Implement database path configuration in `core/db.py`**

Add:

```python
DEFAULT_DB_PATH: str
def configure(path: str) -> None
```

`configure` must resolve the path, close any active connection, clear known-table state, and switch the next connection to that path. Initialize the active path from `DATABASE` when present, otherwise `DEFAULT_DB_PATH`. Keep every existing CRUD signature unchanged.

- [ ] **Step 6: Refactor `app.py` into an application factory**

Implement:

```python
def create_app(test_config: dict | None = None) -> Flask
```

The factory must configure `SECRET_KEY`, `DATABASE`, `MAX_CONTENT_LENGTH`, and `TESTING`; call `db.configure`; register feature Blueprints, upload routing, JSON error handlers, and SPA routing; and return the app. Keep `app = create_app()` for existing imports. Under `if __name__ == "__main__"`, call `db.init()`, start jobs once, and run with `HOST` defaulting to `127.0.0.1`, `PORT` defaulting to `5000`, and `FLASK_DEBUG` parsed as an explicit boolean.

Add `HOST=127.0.0.1`, `FLASK_DEBUG=0`, and an optional commented `DATABASE=` explanation to `.env.example`.

- [ ] **Step 7: Verify GREEN and add shared test fixtures**

Run: `.\.venv\Scripts\python.exe -m pytest tests/test_app_factory.py -q`

Expected: PASS.

Then create `tests/conftest.py`:

- `app(tmp_path)` builds an isolated testing app and closes DB after the test.
- `client(app)` returns `app.test_client()`.
- `login_as(client, user_id)` sets `session["user_id"]` with `session_transaction()`.
- `put_video(...)` creates complete literal video fixtures with caller-supplied likes and timestamps.

- [ ] **Step 8: Run the backend suite**

Run: `.\.venv\Scripts\python.exe -m pytest -q`

Expected: all current tests pass and no `data.db` or upload file is created by tests.

- [ ] **Step 9: Commit the foundation**

```powershell
git add requirements.txt requirements-dev.txt .env.example app.py core/db.py tests/conftest.py tests/test_app_factory.py
git commit -m "test: add isolated Flask app factory"
```

---

### Task 2: Weighted TF-IDF Ranking Engine

**Files:**
- Create: `features/recommend/search.py`
- Create: `tests/test_recommend_search.py`

**Interfaces:**
- Consumes: plain video dictionaries containing `id`, `title`, `desc`, `uploader_name`, and `created_at`.
- Produces: immutable `RankedVideo(video: dict, score: float | None, matched_terms: tuple[str, ...], matched_fields: tuple[str, ...])`.
- Produces: `rank_videos(videos: list[dict], query: str, limit: int = 24) -> tuple[list[RankedVideo], int]`.

- [ ] **Step 1: Write the failing ranking tests**

Create literal fixtures and the following tests in `tests/test_recommend_search.py`:

```python
def test_title_match_ranks_above_description_then_channel():
    ranked, total = rank_videos(weighted_field_videos, "파이썬")
    assert [row.video["id"] for row in ranked] == ["title", "description", "channel"]
    assert ranked[0].matched_fields == ("title",)
    assert total == 3

def test_normalizes_nfkc_case_and_punctuation():
    ranked, total = rank_videos(videos, "  ＦＬＡＳＫ!!!  ")
    assert [row.video["id"] for row in ranked] == ["flask-video"]
    assert total == 1

def test_character_bigrams_find_partial_korean_term():
    ranked, _ = rank_videos(videos, "자료구")
    assert ranked[0].video["id"] == "data-structures"
    assert ranked[0].matched_terms == ("자료구",)

def test_empty_or_punctuation_only_query_returns_newest_with_null_score():
    for query in ("", "   ", "...!!!"):
        ranked, total = rank_videos(videos, query)
        assert [row.video["id"] for row in ranked] == ["newest", "older"]
        assert all(row.score is None for row in ranked)
        assert total == 2

def test_empty_and_singleton_corpora_are_safe():
    assert rank_videos([], "개발") == ([], 0)
    ranked, total = rank_videos([single_video], "개발")
    assert total == 1
    assert 0 < ranked[0].score <= 1
    assert rank_videos([single_video], "천문학") == ([], 0)

def test_unrelated_query_returns_no_results():
    assert rank_videos(videos, "천문학") == ([], 0)

def test_equal_scores_sort_by_created_at_then_id():
    ranked, _ = rank_videos(tied_videos, "개발")
    assert [row.video["id"] for row in ranked] == ["new-a", "new-b", "old"]

def test_limit_is_applied_after_total_is_counted():
    ranked, total = rank_videos(matching_videos, "개발", limit=2)
    assert len(ranked) == 2
    assert total == 3
```

Expected values must be literal and must not be calculated with search helpers.

- [ ] **Step 2: Run the ranking tests and verify RED**

Run: `.\.venv\Scripts\python.exe -m pytest tests/test_recommend_search.py -q`

Expected: FAIL because `features.recommend.search` does not exist.

- [ ] **Step 3: Implement the minimal pure search module**

In `features/recommend/search.py`, define constants `TITLE_WEIGHT = 3.0`, `DESCRIPTION_WEIGHT = 1.5`, `CHANNEL_WEIGHT = 1.0`, and `DEFAULT_LIMIT = 24` plus the public interfaces above.

Implementation requirements:

- Normalize with `unicodedata.normalize("NFKC", value).lower()`.
- Extract `[0-9a-z가-힣]+` words and add each word's character 2-grams.
- Build document frequency from candidate videos only, then apply smoothed IDF.
- Combine weighted field token frequencies and compute cosine similarity without external packages.
- Track which original query terms contribute overlap and which fields contain overlap.
- Round non-null scores to four decimals.
- Filter zero scores, sort by score descending, parsed `created_at` descending, then ID ascending, and apply `limit` after calculating `total`.
- For a blank normalized query, skip vectorization and return newest-first rows with null score and empty match tuples.

- [ ] **Step 4: Verify GREEN**

Run: `.\.venv\Scripts\python.exe -m pytest tests/test_recommend_search.py -q`

Expected: all ranking tests pass.

- [ ] **Step 5: Run the complete backend suite**

Run: `.\.venv\Scripts\python.exe -m pytest -q`

Expected: all backend tests pass.

- [ ] **Step 6: Commit the ranking engine**

```powershell
git add features/recommend/search.py tests/test_recommend_search.py
git commit -m "feat: add weighted liked-video ranking"
```

---

### Task 3: Authenticated Liked-Video Search API

**Files:**
- Modify: `features/recommend/api.py`
- Create: `tests/test_recommend_api.py`
- Modify if fixture data needs reuse: `tests/conftest.py`

**Interfaces:**
- Consumes: `rank_videos(...)`, `db.all("videos")`, `session["user_id"]`, and `features.videos.api.view(video)`.
- Produces: `GET /api/recommend/liked?q=<query>&limit=<limit>` returning `{query: str, total: int, items: list[dict]}`.
- Removes: the old all-video `GET /api/recommend/` behavior.

- [ ] **Step 1: Write failing API integration tests**

Create `tests/test_recommend_api.py` with a local `videos` fixture that inserts users `kim`, `lee`, and `empty-user`, plus these literal videos:

- `kim-python`: title `파이썬으로 게시판 만들기`, description `Flask 개발`, likes `["kim"]`, created `2026-01-03T00:00:00+00:00`.
- `kim-old`: title `학식 리뷰`, description `오늘의 메뉴`, likes `["kim"]`, created `2026-01-01T00:00:00+00:00`.
- `lee-server`: title `서버 개발 입문`, description `로컬 서버`, likes `["lee"]`, created `2026-01-02T00:00:00+00:00`.
- `unliked-python`: title `파이썬 고급`, likes `["lee"]`; this proves Kim cannot see a relevant video outside Kim's liked set.

Then add these assertions:

```python
def test_liked_search_requires_login(client):
    response = client.get("/api/recommend/liked?q=개발")
    assert response.status_code == 401
    assert response.get_json() == {"error": "로그인이 필요합니다."}

def test_liked_search_returns_only_current_users_likes(client, login_as, videos):
    login_as(client, "kim")
    response = client.get("/api/recommend/liked?q=파이썬")
    body = response.get_json()
    assert response.status_code == 200
    assert [item["id"] for item in body["items"]] == ["kim-python"]
    assert body["query"] == "파이썬"
    assert body["total"] == 1
    assert "likes" not in body["items"][0]
    assert "dislikes" not in body["items"][0]

def test_same_query_is_scoped_per_user(client, login_as, videos):
    login_as(client, "kim")
    kim_ids = [item["id"] for item in client.get("/api/recommend/liked?q=개발").get_json()["items"]]
    login_as(client, "lee")
    lee_ids = [item["id"] for item in client.get("/api/recommend/liked?q=개발").get_json()["items"]]
    assert kim_ids == ["kim-python"]
    assert lee_ids == ["lee-server"]

def test_blank_query_returns_all_likes_newest_first(client, login_as, videos):
    login_as(client, "kim")
    body = client.get("/api/recommend/liked").get_json()
    assert [item["id"] for item in body["items"]] == ["kim-python", "kim-old"]
    assert all(item["score"] is None for item in body["items"])

def test_no_likes_and_no_match_return_empty_success(client, login_as, videos):
    login_as(client, "empty-user")
    assert client.get("/api/recommend/liked?q=개발").get_json() == {"query": "개발", "total": 0, "items": []}
    login_as(client, "kim")
    assert client.get("/api/recommend/liked?q=천문학").get_json() == {"query": "천문학", "total": 0, "items": []}

def test_query_length_boundary(client, login_as):
    login_as(client, "kim")
    assert client.get("/api/recommend/liked", query_string={"q": "가" * 100}).status_code == 200
    response = client.get("/api/recommend/liked", query_string={"q": "가" * 101})
    assert response.status_code == 400
    assert response.get_json() == {"error": "검색어는 100자 이하여야 합니다."}
    assert client.get("/api/recommend/liked", query_string={"q": "ﬃ" * 34}).status_code == 400

@pytest.mark.parametrize("limit", ["", "0", "51", "abc"])
def test_rejects_invalid_limit(client, login_as, limit):
    login_as(client, "kim")
    response = client.get("/api/recommend/liked", query_string={"limit": limit})
    assert response.status_code == 400
    assert response.get_json() == {"error": "limit은 1부터 50 사이의 정수여야 합니다."}
```

- [ ] **Step 2: Run API tests and verify RED**

Run: `.\.venv\Scripts\python.exe -m pytest tests/test_recommend_api.py -q`

Expected: FAIL with 404 for `/api/recommend/liked` or the old response shape.

- [ ] **Step 3: Replace the old recommendation endpoint**

In `features/recommend/api.py`:

- Remove the current embedded TF-IDF implementation and `GET /` endpoint.
- Add `MAX_QUERY_LENGTH = 100`, `DEFAULT_LIMIT = 24`, and `MAX_LIMIT = 50`.
- Add `GET /liked` guarded by `@login_required`.
- Trim and NFKC-normalize the query before validating its length.
- Reject missing, blank, non-numeric, zero, negative, and greater-than-50 explicit `limit` values with the exact Korean error message; omission uses 24.
- Select candidates with `uid in video.get("likes", [])` before calling the ranker.
- Serialize each result as `{**view(row.video), "score": row.score, "matched_terms": list(...), "matched_fields": list(...)}`.
- Return the exact top-level response contract.

- [ ] **Step 4: Verify GREEN**

Run: `.\.venv\Scripts\python.exe -m pytest tests/test_recommend_api.py -q`

Expected: all API tests pass.

- [ ] **Step 5: Run the complete backend suite**

Run: `.\.venv\Scripts\python.exe -m pytest -q`

Expected: app-factory, ranking, and API tests all pass without creating the real `data.db`.

- [ ] **Step 6: Commit the API vertical slice**

```powershell
git add features/recommend/api.py tests/conftest.py tests/test_recommend_api.py
git commit -m "feat: expose liked-video smart search API"
```

---

### Task 4: URL-Driven Liked Search Interface

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/package-lock.json`
- Modify: `frontend/vite.config.js`
- Create: `frontend/src/test/setup.js`
- Create: `frontend/src/features/videos/Library.test.jsx`
- Modify: `frontend/src/features/videos/Library.jsx`
- Modify: `frontend/src/styles.css`

**Interfaces:**
- Consumes: `{query, total, items}` from `GET /api/recommend/liked` and the existing array response from other library endpoints.
- Produces: `/liked?q=<query>` navigation, backend-ranked result cards, and distinct loading/error/empty states.
- Keeps: `Library({kind, title, empty})` so existing feed/history/mine routes remain unchanged.

- [ ] **Step 1: Add the frontend test harness dependencies and scripts**

Install exact compatible development ranges:

```powershell
cd frontend
npm install --save-dev vitest@^3.2.4 jsdom@^26.1.0 @testing-library/react@^16.3.0 @testing-library/jest-dom@^6.6.3 @testing-library/user-event@^14.6.1
```

Add package scripts `"test": "vitest run"` and `"test:watch": "vitest"`. Configure `vite.config.js` with `test.environment = "jsdom"` and `test.setupFiles = "./src/test/setup.js"`. Import `@testing-library/jest-dom/vitest` and restore mocks after each test in the setup file.

- [ ] **Step 2: Write failing component tests against real Router and AuthProvider behavior**

In `Library.test.jsx`, stub only `global.fetch` and return complete JSON responses for `/api/auth/me`, `/api/notifications/`, and the search endpoint. Render the real `AuthProvider`, `MemoryRouter`, route, and `Library` component.

Required behaviors:

```jsx
test('restores q from the URL and renders ranked evidence', async () => {
  renderLiked('/liked?q=파이썬', rankedResponse)
  expect(await screen.findByText('파이썬으로 30분 만에 나만의 게시판 만들기')).toBeInTheDocument()
  expect(screen.getByText('유사도 64%')).toBeInTheDocument()
  expect(screen.getByText('#파이썬')).toBeInTheDocument()
  expect(screen.getByText('제목 · 설명')).toBeInTheDocument()
})

test('submitting and clearing search updates the real URL', async () => {
  const user = userEvent.setup()
  renderLiked('/liked', responses)
  await user.type(await screen.findByRole('searchbox'), '개발')
  await user.click(screen.getByRole('button', {name: '검색'}))
  expect(screen.getByTestId('location')).toHaveTextContent('/liked?q=%EA%B0%9C%EB%B0%9C')
  await user.click(screen.getByRole('button', {name: '검색 초기화'}))
  expect(screen.getByTestId('location')).toHaveTextContent('/liked')
})

test('shows distinct no-likes, no-match, loading, and retryable-error states', async () => {
  // Use one case per state and assert its user-visible message and available action.
})

test('ignores a stale response after the URL query changes', async () => {
  // Resolve the second deferred fetch first, then the first fetch; the second result must remain visible.
})

test('keeps non-liked library endpoints working', async () => {
  renderLibrary({kind: 'history', route: '/history', response: [video]})
  expect(await screen.findByText(video.title)).toBeInTheDocument()
})
```

Do not assert that a fetch mock was called; assert the real URL and rendered behavior that depends on the boundary response.

- [ ] **Step 3: Run the component tests and verify RED**

Run from `frontend`: `npm test -- Library.test.jsx`

Expected: FAIL because the current component reads no URL query, calls `/api/videos/liked`, hides errors, and ranks locally.

- [ ] **Step 4: Implement the liked-search state machine in `Library.jsx`**

Implementation requirements:

- Read and update `q` with `useSearchParams`; keep the input synchronized with back/forward navigation.
- For `kind === "liked"`, call `/api/recommend/liked?q=<encoded>&limit=24`; for other kinds preserve `/api/videos/<kind>` and the array response.
- Track `loading`, `error`, response data, and a retry sequence separately.
- Ignore responses from effects that have been cleaned up.
- Submit trimmed input, remove `q` for blank input, and expose a clear button with accessible name `검색 초기화`.
- Replace category-count computation and `matchVideos` with example-query shortcut buttons that only set `q`.
- Show no-likes, no-match, loading, error/retry, result count, rounded similarity percentage, matched query terms, and Korean labels for matched fields.
- Render the liked-page search heading as `좋아요 영상 스마트 검색` so the production bundle can be checked against a stable user-visible label.
- Continue using `VideoCard`; never re-sort the API result in the browser.

- [ ] **Step 5: Update responsive styles**

Replace category-specific CSS with focused classes for the search panel, status region, result evidence, retry/clear controls, and narrow-screen form wrapping. Retain the existing TubeLite dark theme and avoid unrelated visual redesign.

- [ ] **Step 6: Verify GREEN**

Run from `frontend`: `npm test -- Library.test.jsx`

Expected: all Library behavior tests pass with no React act warnings or unhandled promise errors.

- [ ] **Step 7: Run all frontend and backend tests**

```powershell
cd frontend
npm test
cd ..
.\.venv\Scripts\python.exe -m pytest -q
```

Expected: both suites pass.

- [ ] **Step 8: Commit the liked-search interface**

```powershell
git add frontend/package.json frontend/package-lock.json frontend/vite.config.js frontend/src/test/setup.js frontend/src/features/videos/Library.test.jsx frontend/src/features/videos/Library.jsx frontend/src/styles.css
git commit -m "feat: connect liked library to smart search"
```

---

### Task 5: Legacy Route Compatibility and Dead-Code Removal

**Files:**
- Modify: `frontend/src/features/recommend/routes.jsx`
- Create: `frontend/src/features/recommend/routes.test.jsx`
- Delete: `frontend/src/features/recommend/Recommend.jsx`
- Delete: `frontend/src/features/recommend/match.js`

**Interfaces:**
- Consumes: React Router location and navigation.
- Produces: named component `LegacyRecommendRedirect()`, preserving `location.search` while replacing `/recommend` with `/liked`.
- Removes: every browser-side ranking and old all-video recommendation screen.

- [ ] **Step 1: Write the failing legacy-route test**

```jsx
test('redirects legacy recommend URL to liked while preserving q', async () => {
  render(
    <MemoryRouter initialEntries={['/recommend?q=%ED%8C%8C%EC%9D%B4%EC%8D%AC']}>
      <Routes>
        <Route path="/recommend" element={<LegacyRecommendRedirect />} />
        <Route path="/liked" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  )
  expect(await screen.findByTestId('location')).toHaveTextContent('/liked?q=%ED%8C%8C%EC%9D%B4%EC%8D%AC')
})
```

- [ ] **Step 2: Run the route test and verify RED**

Run from `frontend`: `npm test -- routes.test.jsx`

Expected: FAIL because the routes module is commented out and exports no redirect.

- [ ] **Step 3: Implement the compatibility route and remove obsolete files**

In `routes.jsx`, export `LegacyRecommendRedirect()` using `useLocation` and `<Navigate replace to={{pathname: "/liked", search: location.search}} />`. Export the feature definition with no navigation item and one `/recommend` route.

Delete the commented `Recommend.jsx` and the client-side `match.js`. Confirm `rg "matchVideos|CATEGORIES|from './Recommend'" frontend/src` finds no obsolete import or implementation.

- [ ] **Step 4: Verify GREEN and run the frontend suite**

```powershell
cd frontend
npm test -- routes.test.jsx
npm test
```

Expected: the redirect test and complete frontend suite pass.

- [ ] **Step 5: Commit compatibility cleanup**

```powershell
git add frontend/src/features/recommend/routes.jsx frontend/src/features/recommend/routes.test.jsx frontend/src/features/recommend/Recommend.jsx frontend/src/features/recommend/match.js
git commit -m "refactor: retire client-side recommendation search"
```

---

### Task 6: Local Runbook, Production Bundle, and End-to-End Verification

**Files:**
- Modify: `README.md`
- Regenerate: `static/app/index.html`
- Regenerate: `static/app/assets/*`

**Interfaces:**
- Consumes: the completed backend API, React source, existing deterministic `seed.py`, and local environment variables.
- Produces: a source-backed README and the deployable local static bundle served by Flask.

- [ ] **Step 1: Rewrite the README around the completed local product**

Document:

- The project goal: smart search over TubeLite's internal liked videos.
- The explicit non-goal: no real YouTube account or external deployment.
- Python 3.11+ and Node 18+ prerequisites.
- Virtual environment creation and `requirements-dev.txt` installation.
- `.env.example` copy, `python seed.py`, frontend `npm ci`, `npm run build`, and `python app.py` commands.
- Demo account `kim / 1234` and the reproducible query `파이썬`.
- `pytest` and `npm test` commands.
- API request/response summary for `/api/recommend/liked`.
- Weighted TF-IDF behavior, field weights, character 2-grams, and known small-corpus limitations.

- [ ] **Step 2: Run complete automated verification before generating assets**

```powershell
.\.venv\Scripts\python.exe -m pytest -q
cd frontend
npm test
```

Expected: zero backend and frontend test failures; no warnings that indicate unhandled UI work.

- [ ] **Step 3: Generate the production frontend bundle**

Run from `frontend`: `npm run build`

Expected: Vite exits 0 and writes a new `../static/app/index.html` plus hashed assets.

- [ ] **Step 4: Verify source and bundle consistency**

Run from the repository root:

```powershell
rg -n "AI 키워드 추천|/api/recommend/\?" static/app
rg -n "좋아요 영상 스마트 검색|/api/recommend/liked" static/app
```

Expected: the first command finds nothing; the second finds the new UI/API strings in the generated JavaScript bundle.

- [ ] **Step 5: Seed and start the local app without overwriting user data**

First run `Test-Path data.db`. If it is false, run `.\.venv\Scripts\python.exe seed.py`; if true, preserve it and do not reset or delete it. Start `.\.venv\Scripts\python.exe app.py` and confirm it reports `http://127.0.0.1:5000`.

- [ ] **Step 6: Perform a real-browser smoke test**

Using the local browser:

1. Open `http://127.0.0.1:5000`.
2. Sign in as `kim / 1234` when demo data was seeded, or use an existing local account.
3. Open `좋아요 표시한 동영상`.
4. Search for `파이썬` when using demo data, or a term from an existing liked video's title.
5. Verify URL persistence, ranked result evidence, clear behavior, browser back/forward restoration, and absence of other users' liked-only videos.
6. Open `/recommend?q=<same query>` and verify replacement navigation to `/liked?q=<same query>`.

- [ ] **Step 7: Run final repository checks**

```powershell
.\.venv\Scripts\python.exe -m pytest -q
cd frontend
npm test
npm run build
cd ..
git diff --check
git status --short
```

Expected: tests and build exit 0; `git diff --check` reports no whitespace errors; status contains only the intended README, source, tests, dependency manifests, and generated static bundle changes.

- [ ] **Step 8: Commit the local-ready release artifacts**

```powershell
git add README.md static/app frontend/package-lock.json
git commit -m "docs: ship local smart search workflow"
```

---

## Final Whole-Branch Review

After Task 6, compare the complete branch against the design spec requirement by requirement. Request an independent code review focused on:

- authentication and cross-user data isolation;
- ranking correctness and deterministic ordering;
- API validation and response privacy;
- stale-response handling and accessible error/empty states;
- clean-install instructions and source/static-bundle consistency.

Fix every Critical or Important finding with a reproducing failing test, rerun both full suites and the production build, and only then prepare the final handoff.
