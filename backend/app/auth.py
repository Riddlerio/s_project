import hmac
import secrets
from datetime import timedelta

from fastapi import Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import settings
from .db import get_db
from .demo import is_demo_account
from .models import Account, AuditEvent, Child, CookieSession, Therapist, now
from .security import hash_token


COOKIE_NAME = "speech_hero_session"


def current_account(request: Request, db: Session = Depends(get_db)) -> Account:
    token = request.cookies.get(COOKIE_NAME)
    row = db.get(CookieSession, hash_token(token)) if token else None
    if row is None or row.expires_at.replace(tzinfo=None) <= now().replace(tzinfo=None):
        raise HTTPException(401, "로그인이 필요합니다")
    if request.method not in {"GET", "HEAD", "OPTIONS"}:
        supplied = request.headers.get("x-csrf-token", "")
        if not supplied or not hmac.compare_digest(hash_token(supplied), row.csrf_hash):
            raise HTTPException(403, "CSRF 검증 실패")
    account = db.get(Account, row.account_id)
    # DEMO 모드를 끈 뒤에는 이전에 만든 샘플 계정 세션도 쓸 수 없다.
    if account is None or (not settings.seed_demo_data and is_demo_account(db, account)):
        raise HTTPException(401, "로그인이 필요합니다")
    return account


def require_student(account: Account = Depends(current_account), db: Session = Depends(get_db)) -> Account:
    if account.role != "STUDENT" or not account.child_id:
        db.add(AuditEvent(actor_id=account.id, action="ROLE_ACCESS_DENIED", resource_id=account.id, result="DENIED"))
        db.commit()
        raise HTTPException(403, "학생 권한이 필요합니다")
    return account


def require_therapist(account: Account = Depends(current_account), db: Session = Depends(get_db)) -> Therapist:
    if account.role != "THERAPIST" or not account.therapist_id:
        db.add(AuditEvent(actor_id=account.id, action="ROLE_ACCESS_DENIED", resource_id=account.id, result="DENIED"))
        db.commit()
        raise HTTPException(403, "치료사 권한이 필요합니다")
    therapist = db.get(Therapist, account.therapist_id)
    if therapist is None:
        raise HTTPException(403, "치료사 권한이 필요합니다")
    return therapist


def owned_child(db, child_id, therapist):
    """담당 치료사의 아동만 돌려준다. 다른 치료사의 아동은 존재 여부를 숨기고 거부 기록을 남긴다."""
    child = db.get(Child, child_id)
    if not child or child.therapist_id != therapist.id:
        db.add(AuditEvent(actor_id=therapist.id, action="ACCESS_DENIED", resource_id=child.id if child else hash_token(child_id)[:36],
                          result="DENIED"))
        db.commit()
        raise HTTPException(404, "아동을 찾을 수 없습니다")
    return child


def require_admin(account: Account = Depends(current_account), db: Session = Depends(get_db)) -> Account:
    if account.role != "ADMIN":
        db.add(AuditEvent(actor_id=account.id, action="ROLE_ACCESS_DENIED", resource_id=account.id, result="DENIED"))
        db.commit()
        raise HTTPException(403, "관리자 권한이 필요합니다")
    return account


def create_session(db: Session, account: Account) -> tuple[str, str]:
    token = secrets.token_urlsafe(32)
    csrf = secrets.token_urlsafe(32)
    db.add(CookieSession(token_hash=hash_token(token), account_id=account.id,
                         csrf_hash=hash_token(csrf), expires_at=now() + timedelta(hours=12)))
    db.commit()
    return token, csrf
