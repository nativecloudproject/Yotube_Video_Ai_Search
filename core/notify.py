"""알림 보내기.  기능 코드는 이 함수 하나만 부른다.

    notify.send(to_user_id, '거래 요청', '민지 님이 "자료구조" 책에 거래를 요청했습니다.', link='/items/abc')

로컬 구현: 콘솔에 찍고, notifications 테이블에 저장한다 (화면 상단 🔔 에서 보인다).
실제 서비스라면 여기서 메일·푸시를 보낸다.

# TODO(9주차): 이 파일이 Lambda + SNS 로 간다.
#   send() 는 SNS 토픽에 publish 만 한다 (수 ms).  메일 본문 만들기·발송은 Lambda 가 한다.
#   서버는 "보냈다"만 알고 기다리지 않는다 — 이것이 함수로 떼어내는 이유.
"""
from core import db


def send(to_user_id: str, subject: str, body: str, link: str = '') -> None:
    print(f'[notify] → {to_user_id} | {subject} | {body}')
    db.put('notifications', {
        'user_id': to_user_id, 'subject': subject, 'body': body, 'link': link, 'read': False,
    })


def unread_count(user_id: str) -> int:
    return len([n for n in db.find('notifications', user_id=user_id) if not n.get('read')])


def mark_all_read(user_id: str) -> None:
    for n in db.find('notifications', user_id=user_id):
        if not n.get('read'):
            db.update('notifications', n['id'], read=True)
