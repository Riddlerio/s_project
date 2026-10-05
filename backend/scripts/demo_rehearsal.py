"""DEMO 리허설 전용 DB 생성과 오늘 회기 초기화. 기존 파일은 provision하지 않는다.

SEED_DEMO_DATA=true 설정 후 실행:
  python backend/scripts/demo_rehearsal.py provision --database backend/test-temp/rehearsal.db
  python backend/scripts/demo_rehearsal.py reset-today --database backend/test-temp/rehearsal.db
  python backend/scripts/demo_rehearsal.py reset-today --include-mic --database backend/test-temp/rehearsal.db  # 마이크 리허설 기록까지

서버 DATABASE_URL도 위 DB의 절대 경로로 명시한다. reset 전 진행 중인 리허설을 멈춘다.
"""
import argparse
import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import create_engine, event
from sqlalchemy.engine import URL
from sqlalchemy.orm import Session

from app.config import settings
from app.db import Base
from app.demo_seed import DemoSafetyError, local_database_path, provision_demo_child, reset_today
from app.seed import seed


def rehearsal_engine(path):
    engine = create_engine(URL.create("sqlite", database=str(path)))
    @event.listens_for(engine, "connect")
    def foreign_keys(connection, _record):
        connection.execute("PRAGMA foreign_keys=ON")
    return engine


def main(argv=None):
    parser = argparse.ArgumentParser(description="명시적으로 만든 로컬 DEMO 리허설 DB만 관리합니다.")
    parser.add_argument("command", choices=("provision", "reset-today"))
    parser.add_argument("--database", required=True, help="로컬 SQLite DB 파일 경로(기본 DB를 사용하지 않음)")
    parser.add_argument("--include-mic", action="store_true", help="reset-today에서 전용 아동의 오늘 마이크(real 모드) 회기도 지운다")
    args = parser.parse_args(argv)
    if not settings.seed_demo_data:
        raise DemoSafetyError("SEED_DEMO_DATA=true가 필요합니다. 실제 DB에서는 실행하지 않습니다.")
    path = local_database_path(args.database)
    if args.command == "provision":
        if not path.parent.is_dir():
            raise DemoSafetyError("DB를 둘 폴더를 먼저 준비하세요.")
        # 기존 DB를 데모로 잘못 지정하는 것을 막기 위해 새 파일만 독점 생성한다.
        try:
            with path.open("xb"):
                pass
        except FileExistsError as cause:
            raise DemoSafetyError("기존 DB에는 provision하지 않습니다. 새 파일 경로를 지정하세요.") from cause
    elif not path.is_file():
        raise DemoSafetyError("기존 provision DB 파일을 지정하세요.")
    engine = rehearsal_engine(path)
    try:
        if args.command == "provision":
            Base.metadata.create_all(engine)
            with Session(engine) as db:
                seed(db)
                with db.begin():
                    result = provision_demo_child(db, demo_enabled=settings.seed_demo_data)
            result["database"] = str(path)
            result["notice"] = "시연 전용 샘플 계정입니다. 기존 DEMO 로그인 계정은 유지합니다."
        else:
            result = reset_today(engine, demo_enabled=settings.seed_demo_data, include_mic=args.include_mic)
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return result
    finally:
        engine.dispose()


if __name__ == "__main__":
    try:
        main()
    except DemoSafetyError as error:
        raise SystemExit(f"실행 거부: {error}") from error
