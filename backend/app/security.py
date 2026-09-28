import hashlib
import hmac
import secrets
from datetime import timedelta

from .models import AuthToken, now


def hash_password(password: str, salt: str) -> str:
    return hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), 200_000).hex()


def verify_password(password: str, salt: str, expected: str) -> bool:
    return hmac.compare_digest(hash_password(password, salt), expected)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def issue_token(db, therapist_id: str) -> str:
    token = secrets.token_urlsafe(32)
    db.add(AuthToken(token_hash=hash_token(token), therapist_id=therapist_id, expires_at=now() + timedelta(hours=12)))
    db.commit()
    return token
