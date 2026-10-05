r"""seed 출처 수리(Phase 1 과거 행). 기본은 미리 보기이며 DB를 바꾸지 않는다.

  미리 보기: backend\.venv\Scripts\python.exe backend\scripts\repair_seed_provenance.py --database <파일>.db
  적용:      backend\.venv\Scripts\python.exe backend\scripts\repair_seed_provenance.py --database <파일>.db --apply

적용 전에 같은 폴더에 백업(<이름>.before-seed-repair-<시각>.db)을 만든다. 서버를 멈춘 뒤 실행한다.
무엇을 바꾸는지는 app/seed_provenance.py 설명을 본다. SQLite 파일 DB만 지원한다.
"""
import argparse
from datetime import datetime
import json
from pathlib import Path
import sqlite3
import sys

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.seed_provenance import apply_repair, plan_repair, summary  # noqa: E402


def database_path(value: str) -> Path:
    path = Path(value.removeprefix("sqlite:///")).expanduser().resolve()
    if path.suffix.lower() not in {".db", ".sqlite", ".sqlite3"} or not path.is_file():
        raise SystemExit(f"있는 SQLite 파일(.db, .sqlite, .sqlite3)을 지정하세요: {path}")
    return path


def backup(path: Path) -> Path:
    target = path.with_name(f"{path.stem}.before-seed-repair-{datetime.now():%Y%m%d-%H%M%S}{path.suffix}")
    source, copy = sqlite3.connect(f"file:{path.as_posix()}?mode=ro", uri=True), sqlite3.connect(target)
    with copy:
        source.backup(copy)
    source.close(); copy.close()
    return target


def main(argv=None) -> dict:
    parser = argparse.ArgumentParser(description="Phase 1 수정 전 seed 출처 행을 미리 보거나 고친다.")
    parser.add_argument("--database", required=True, help="SQLite 파일 경로")
    parser.add_argument("--apply", action="store_true", help="실제로 고친다(먼저 백업을 만든다)")
    args = parser.parse_args(argv)
    path = database_path(args.database)
    if not args.apply:
        engine = create_engine(f"sqlite:///file:{path.as_posix()}?mode=ro&uri=true")
        with Session(engine) as db:
            result = {"mode": "미리 보기(바꾸지 않음)", **summary(plan_repair(db))}
    else:
        copy = backup(path)
        engine = create_engine(f"sqlite:///{path.as_posix()}")
        with Session(engine) as db, db.begin():
            result = {"mode": "적용", "backup": str(copy), **apply_repair(db)}
    engine.dispose()
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return result


if __name__ == "__main__":
    main()
