import hashlib
import hmac
import secrets
from datetime import timedelta

from .models import AuthToken, now


def hash_password(password: str, salt: str) -> str:
    return hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), 200_000).hex()


def verify_password(password: str, salt: str, expected: str) -> bool:
    return hmac.compare_digest(hash_password(password, salt), expected)


# 없는 계정에도 같은 PBKDF2 비용을 치르게 해 응답 시간으로 계정 존재를 알 수 없게 한다.
_DUMMY_SALT = secrets.token_hex(16)
_DUMMY_HASH = hash_password(secrets.token_urlsafe(16), _DUMMY_SALT)


def verify_dummy_password(password: str) -> bool:
    verify_password(password, _DUMMY_SALT, _DUMMY_HASH)
    return False


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def issue_token(db, therapist_id: str) -> str:
    token = secrets.token_urlsafe(32)
    db.add(AuthToken(token_hash=hash_token(token), therapist_id=therapist_id, expires_at=now() + timedelta(hours=12)))
    db.commit()
    return token
