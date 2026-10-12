"""데이터 저장.  키-값 문서 저장소 인터페이스.  기능 코드는 이 함수들만 부른다.

    db.put('items', {'id': ..., 'title': ...})   # 저장 (id 없으면 만들어 준다)
    db.get('items', id)                          # 하나
    db.find('items', seller='kim')               # 조건(같음)으로 여럿
    db.all('items')                              # 전부 (최신순)
    db.update('items', id, price=9000)           # 일부 필드
    db.delete('items', id)

로컬 구현은 SQLite 한 파일에 테이블마다 (id, data JSON, created_at) 로 저장한다.
관계형 조인은 쓰지 않는다 — 7주차에 DynamoDB로 갈 때 같은 인터페이스가 그대로 살게 하려는 것.

# TODO(7주차): 이 파일이 DynamoDB로 간다.
#   테이블 이름 = DDB_PREFIX + table,  파티션 키 = id
#   find() 는 Scan + FilterExpression (작을 땐 괜찮다. 커지면 GSI — 반박할 것)
#   *.db 파일을 지워도 데이터가 남는지가 검증 기준.
"""
import builtins
import json
import os
import sqlite3
import threading
import uuid
from datetime import datetime, timezone

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data.db')
_lock = threading.RLock()
_known = set()
_conn_obj = None


def _conn():
    """연결은 프로세스에 하나만 둔다 (Flask 스레드가 여럿이라 lock 으로 감싼다)."""
    global _conn_obj
    if _conn_obj is None:
        _conn_obj = sqlite3.connect(DB_PATH, check_same_thread=False)
        _conn_obj.row_factory = sqlite3.Row
        _conn_obj.execute('PRAGMA journal_mode=WAL')
    return _conn_obj


def close():
    global _conn_obj
    if _conn_obj is not None:
        _conn_obj.close()
        _conn_obj = None
    _known.clear()


def _ensure(table):
    if table in _known:
        return
    with _lock:
        _conn().execute(
            f'CREATE TABLE IF NOT EXISTS "{table}" (id TEXT PRIMARY KEY, data TEXT NOT NULL, created_at TEXT NOT NULL)')
        _conn().commit()
    _known.add(table)


def init():
    print(f'[db] SQLite {DB_PATH} — 이 파일이 지워지면 데이터도 사라집니다 (7주차에 밖으로 뺍니다)')


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec='microseconds')


def put(table: str, item: dict) -> dict:
    _ensure(table)
    item = dict(item)
    item.setdefault('id', uuid.uuid4().hex[:12])
    item.setdefault('created_at', now())
    with _lock:
        _conn().execute(f'INSERT OR REPLACE INTO "{table}" (id, data, created_at) VALUES (?, ?, ?)',
                        (item['id'], json.dumps(item, ensure_ascii=False), item['created_at']))
        _conn().commit()
    return item


def get(table: str, id: str):
    _ensure(table)
    with _lock:
        row = _conn().execute(f'SELECT data FROM "{table}" WHERE id=?', (id,)).fetchone()
    return json.loads(row['data']) if row else None


def all(table: str, desc: bool = True) -> list:
    _ensure(table)
    order = 'DESC' if desc else 'ASC'
    with _lock:
        rows = _conn().execute(f'SELECT data FROM "{table}" ORDER BY created_at {order}, id {order}').fetchall()
    return [json.loads(r['data']) for r in rows]


def find(table: str, **eq) -> list:
    """같음 조건만.  로컬에선 전부 읽어 파이썬으로 거른다 (DynamoDB Scan과 같은 성격)."""
    return [x for x in all(table) if builtins.all(x.get(k) == v for k, v in eq.items())]


def update(table: str, id: str, **fields):
    item = get(table, id)
    if item is None:
        return None
    item.update(fields)
    return put(table, item)


def delete(table: str, id: str) -> None:
    _ensure(table)
    with _lock:
        _conn().execute(f'DELETE FROM "{table}" WHERE id=?', (id,))
        _conn().commit()
