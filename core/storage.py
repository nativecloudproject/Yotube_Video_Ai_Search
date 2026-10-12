"""파일 저장.  기능 코드는 이 두 함수만 부른다.

    key = storage.save(request.files['photo'])   # 저장하고 키를 받는다
    src = storage.url(key)                       # 화면에 보여줄 주소

# TODO(6주차): 이 파일이 S3로 간다.
#   save()  → s3.put_object(Bucket, Key, Body)
#   url()   → 프리사인 URL (버킷은 공개하지 않는다)
#   다른 파일은 손대지 않는다. features/ 는 이 두 함수만 알기 때문이다.
"""
import os
import shutil
import uuid

from werkzeug.utils import secure_filename

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'uploads')
os.makedirs(UPLOAD_DIR, exist_ok=True)
ALLOWED = {'.jpg', '.jpeg', '.png', '.gif', '.webp', '.mp4', '.webm', '.mov', '.pdf'}


class NotAllowed(ValueError):
    pass


def save(file_storage) -> str:
    """업로드 파일을 저장하고 key(파일 이름)를 돌려준다.  파일이 없으면 ''.
    허용되지 않은 확장자면 NotAllowed 를 던진다 (app.py 가 400 JSON 으로 바꿔 준다)."""
    if not file_storage or not file_storage.filename:
        return ''
    ext = os.path.splitext(secure_filename(file_storage.filename))[1].lower()
    if ext not in ALLOWED:
        raise NotAllowed(f'허용되지 않는 파일 형식입니다: {ext or "(확장자 없음)"}')
    key = f'{uuid.uuid4().hex}{ext}'
    file_storage.save(os.path.join(UPLOAD_DIR, key))
    _warn_if_full()
    return key


def put_bytes(data: bytes, ext: str) -> str:
    """바이트를 바로 저장 (seed 데이터, 9주차 썸네일 Lambda 등)."""
    key = f'{uuid.uuid4().hex}{ext}'
    with open(os.path.join(UPLOAD_DIR, key), 'wb') as f:
        f.write(data)
    return key


def url(key: str) -> str:
    """key 를 브라우저가 열 수 있는 주소로."""
    return f'/uploads/{key}' if key else ''


def delete(key: str) -> None:
    try:
        os.remove(os.path.join(UPLOAD_DIR, key))
    except FileNotFoundError:
        pass


def _warn_if_full():
    """서버 디스크에 파일을 쌓으면 어떤 일이 생기는지 보여주는 경고 (2주차 장애 장면).
    서버 디스크는 채워질 수 있고, 서버가 꺼지면 이 폴더의 파일은 함께 사라질 수 있다."""
    total, used, free = shutil.disk_usage(UPLOAD_DIR)
    n = len(os.listdir(UPLOAD_DIR))
    if n and n % 20 == 0:
        print(f'[storage] uploads/ 에 파일 {n}개 · 디스크 남은 공간 {free // 2**30}GB — 이 폴더는 서버와 함께 사라집니다')
