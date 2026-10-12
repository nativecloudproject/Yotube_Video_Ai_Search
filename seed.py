"""데모 데이터.  python seed.py
채널 4개, 동영상 12개(썸네일은 색 카드 · 영상 파일은 직접 올려 보세요), 구독·좋아요·댓글 몇 개."""
import random
import struct
import zlib
from datetime import datetime, timedelta, timezone

from werkzeug.security import generate_password_hash

from core import db, storage
from features.auth.api import color_for


def _png(w, h, rgb, rgb2=None):
    """외부 라이브러리 없이 그라데이션 PNG 를 만든다 (데모용 썸네일)."""
    rgb2 = rgb2 or rgb
    rows = []
    for y in range(h):
        t = y / max(h - 1, 1)
        c = bytes(int(a + (b - a) * t) for a, b in zip(rgb, rgb2))
        rows.append(b'\x00' + c * w)
    raw = b''.join(rows)

    def chunk(t, d):
        return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    return (b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0))
            + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b''))


GRADS = [((255, 153, 0), (255, 87, 34)), ((27, 42, 65), (63, 81, 181)), ((96, 165, 250), (16, 185, 129)),
         ((236, 72, 153), (139, 92, 246)), ((20, 184, 166), (59, 130, 246)), ((245, 158, 11), (239, 68, 68))]

random.seed(7)
db.init()

USERS = [('kim', '김민지', '캠퍼스 일상과 공부 브이로그'), ('lee', '이준호', '자료구조 · 알고리즘 10분 요약'),
         ('park', '박서연', '학식 · 맛집 · 카페 리뷰'), ('choi', '최도윤', '취미로 하는 개발 이야기')]
for uid, name, bio in USERS:
    db.put('users', {'id': uid, 'name': name, 'pw': generate_password_hash('1234'), 'color': color_for(uid), 'bio': bio})

VIDEOS = [
    ('캠퍼스 산책 브이로그 | 가을 첫날', 'kim', '가을 캠퍼스를 한 바퀴 돌았습니다. 은행나무길 → 도서관 → 후문 카페.', 612, 9, 1840),
    ('시험 기간 도서관 24시', 'kim', '밤샘 공부 브이로그. 3시에 먹는 컵라면이 제일 맛있다.', 845, 20, 3210),
    ('자료구조 1강 · 배열과 연결 리스트 10분 요약', 'lee', '왜 배열은 빠르고 연결 리스트는 유연한가. 그림으로 설명합니다.', 603, 30, 12400),
    ('자료구조 2강 · 스택과 큐, 실무에선 어디에 쓰나', 'lee', '브라우저 뒤로가기, 프린터 대기열. 코드보다 쓰임새부터.', 587, 23, 8900),
    ('해시 테이블이 O(1)인 진짜 이유', 'lee', '충돌은 어떻게 처리하나. 파이썬 dict 안을 들여다봅니다.', 731, 5, 4300),
    ('학식 5끼 솔직 리뷰 | 이번 주 최고는?', 'park', '월요일부터 금요일까지 다 먹어 봤습니다. 평점 있음.', 428, 3, 6700),
    ('후문 카페 5곳, 공부하기 좋은 곳은', 'park', '콘센트 · 소음 · 좌석 · 가격 네 가지로 비교.', 512, 12, 2100),
    ('편의점 신상 털기 9월', 'park', '이번 달 나온 것 중 살 것과 말 것.', 355, 1, 980),
    ('내가 만든 사이드 프로젝트가 서버비로 죽은 이야기', 'choi', '트래픽은 없는데 매달 나가는 돈. 무엇을 잘못했나.', 903, 15, 5600),
    ('파이썬으로 30분 만에 나만의 게시판 만들기', 'choi', 'Flask + SQLite. 코드 전부 화면에 나옵니다.', 1810, 40, 7300),
    ('클라우드가 뭔지 5분 만에 이해하기', 'choi', '서버 한 대에서 시작해서 왜 쪼개졌는지까지.', 322, 2, 15200),
    ('개발자 책상 셋업 2026', 'choi', '모니터 암, 키보드, 조명. 다 합쳐서 얼마?', 654, 60, 3900),
]
now = datetime.now(timezone.utc)
vids = []
for i, (title, u, desc, dur, days_ago, views) in enumerate(VIDEOS):
    g = GRADS[i % len(GRADS)]
    v = db.put('videos', {
        'uploader': u, 'uploader_name': db.get('users', u)['name'], 'title': title, 'desc': desc,
        'file': '', 'thumb': storage.put_bytes(_png(480, 270, *g), '.png'),
        'duration': dur, 'views': views, 'likes': [], 'dislikes': [],
        'created_at': (now - timedelta(days=days_ago, hours=i)).isoformat(timespec='microseconds'),
    })
    vids.append(v)

# 구독 · 좋아요 · 댓글
for sub, ch in [('kim', 'lee'), ('kim', 'park'), ('lee', 'choi'), ('park', 'kim'), ('park', 'lee'), ('choi', 'lee'), ('choi', 'kim')]:
    db.put('subscriptions', {'id': f'{sub}_{ch}', 'sub': sub, 'channel': ch})
for v in vids:
    likers = random.sample([u for u, *_ in USERS if u != v['uploader']], k=random.randint(0, 3))
    db.update('videos', v['id'], likes=sorted(likers))
COMMENTS = ['도움 많이 됐어요!', '3분 20초 부분 다시 봤습니다', '다음 편 언제 나오나요', '학교 어디세요?', '구독하고 갑니다',
            '설명이 진짜 쉬워요', '이거 보고 과제 했어요 감사합니다']
for v in vids[:8]:
    for _ in range(random.randint(1, 3)):
        who = random.choice([u for u, *_ in USERS if u != v['uploader']])
        db.put('comments', {'video_id': v['id'], 'author': who, 'author_name': db.get('users', who)['name'],
                            'text': random.choice(COMMENTS), 'likes': []})
db.put('trending', {'id': 'today', 'ids': [v['id'] for v in sorted(vids, key=lambda x: x['views'], reverse=True)[:8]]})
print('seed 완료: 채널 4개 (kim / lee / park / choi · 비밀번호 1234), 동영상 12개, 구독 7건. 영상 파일은 직접 올려 보세요.')
