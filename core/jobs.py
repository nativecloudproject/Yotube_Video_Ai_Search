"""주기 작업.  기능 코드는 등록만 한다.

    from core import jobs

    @jobs.every(hours=24, name='cleanup')
    def cleanup(): ...

로컬 구현: 서버 프로세스 안에서 스레드가 돈다.
→ 서버가 꺼지면 이 작업도 멈춘다.  서버가 2대면 2번 돈다.  (이래서 밖으로 뺀다)

# TODO(9주차): 이 파일이 Lambda + EventBridge 로 간다.
#   등록된 함수를 Lambda 로 옮기고, EventBridge 규칙(cron)이 깨운다.
#   이 파일의 스레드 시작 코드는 삭제한다.  서버는 이제 주기 작업을 모른다.
"""
import threading
import time
import traceback

_registry = []   # (name, seconds, fn)


def every(seconds: int = 0, minutes: int = 0, hours: int = 0, name: str = ''):
    total = seconds + minutes * 60 + hours * 3600

    def deco(fn):
        _registry.append((name or fn.__name__, total, fn))
        return fn
    return deco


def _loop(name, seconds, fn):
    time.sleep(5)   # 서버가 뜬 뒤 첫 실행
    while True:
        try:
            print(f'[jobs] {name} 실행 — 서버 프로세스 안에서 돌고 있습니다. 서버가 꺼지면 이 작업도 멈춥니다')
            fn()
        except Exception:
            traceback.print_exc()
        time.sleep(seconds)


def start():
    for name, seconds, fn in _registry:
        threading.Thread(target=_loop, args=(name, seconds, fn), daemon=True).start()
        print(f'[jobs] 등록: {name} (every {seconds}s)')


def run_now(name: str):
    """콘솔 테스트용:  python -c "import app, core.jobs as j; j.run_now('cleanup')" """
    for n, _, fn in _registry:
        if n == name:
            return fn()
    raise KeyError(name)
