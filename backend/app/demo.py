"""DEMO 샘플 계정 식별. DEMO 모드(SEED_DEMO_DATA)가 꺼져 있으면 이 계정들은 인증되지 않는다."""
from sqlalchemy import select

from .models import Account, Child, Therapist


# seed.py가 만드는 샘플 치료사 아이디. 기존 DB에도 같은 이름으로 남아 있다.
DEMO_THERAPIST_USERNAME = "demo"


def is_demo_account(db, account: Account) -> bool:
    """샘플 아동(is_seed)의 학생 계정, 샘플 치료사 계정을 DEMO 계정으로 본다. 관리자는 해당하지 않는다."""
    if account.role == "STUDENT" and account.child_id:
        child = db.get(Child, account.child_id)
        return bool(child and child.is_seed)
    if account.role == "THERAPIST" and account.therapist_id:
        therapist = db.get(Therapist, account.therapist_id)
        if therapist is None:
            return False
        if therapist.username == DEMO_THERAPIST_USERNAME or account.username == DEMO_THERAPIST_USERNAME:
            return True
        return db.scalar(select(Child.id).where(Child.therapist_id == therapist.id, Child.is_seed == True).limit(1)) is not None
    return False


def demo_account(db, role: str) -> Account | None:
    """DEMO 로그인에 쓸 계정. 치료사는 샘플 치료사, 학생은 첫 샘플 아동이다."""
    if role == "THERAPIST":
        row = db.scalar(select(Account).where(Account.role == "THERAPIST", Account.username == DEMO_THERAPIST_USERNAME))
    else:
        row = db.scalar(select(Account).join(Child, Child.id == Account.child_id)
                        .where(Account.role == "STUDENT", Child.is_seed == True).order_by(Child.child_code))
    return row if row is not None and is_demo_account(db, row) else None
