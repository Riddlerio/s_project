"""기존 치료사·아동 또는 관리자 계정에 로그인 자격을 안전하게 부여한다."""

import argparse
import getpass
import secrets

from sqlalchemy import select

from app.db import Base, SessionLocal, engine
from app.models import Account, Child, Therapist
from app.security import hash_password


def main() -> None:
    parser = argparse.ArgumentParser(description="Speech Hero 계정 생성")
    parser.add_argument("username")
    parser.add_argument("role", choices=("STUDENT", "THERAPIST", "ADMIN"))
    parser.add_argument("--child-id")
    parser.add_argument("--therapist-id")
    args = parser.parse_args()
    if args.role == "STUDENT" and not args.child_id:
        parser.error("STUDENT에는 --child-id가 필요합니다")
    if args.role == "THERAPIST" and not args.therapist_id:
        parser.error("THERAPIST에는 --therapist-id가 필요합니다")
    password = getpass.getpass("새 비밀번호: ")
    confirmation = getpass.getpass("다시 입력: ")
    if password != confirmation or len(password) < 12:
        parser.error("비밀번호가 일치하지 않거나 12자보다 짧습니다")
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        if db.scalar(select(Account.id).where(Account.username == args.username)):
            parser.error("이미 존재하는 계정입니다")
        if args.child_id and not db.get(Child, args.child_id):
            parser.error("아동 ID가 없습니다")
        if args.therapist_id and not db.get(Therapist, args.therapist_id):
            parser.error("치료사 ID가 없습니다")
        salt = secrets.token_hex(16)
        db.add(Account(username=args.username, password_salt=salt, password_hash=hash_password(password, salt),
                       role=args.role, child_id=args.child_id if args.role == "STUDENT" else None,
                       therapist_id=args.therapist_id if args.role == "THERAPIST" else None))
        db.commit()
    print("계정을 생성했습니다")


if __name__ == "__main__":
    main()
