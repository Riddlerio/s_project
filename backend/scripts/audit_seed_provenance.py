"""seed 출처 점검(읽기 전용). DB를 바꾸지 않고 잘못 표시된 과거 행의 수만 센다.

Phase 1 수정 전에는 seed 아동의 회기가 is_seed=False로 저장될 수 있었다. 이 스크립트는 수리 여부를
정하기 위한 현황 조회이며, 수리는 사용자 결정 후 별도로 한다.

사용: backend\\.venv\\Scripts\\python.exe backend\\scripts\\audit_seed_provenance.py [DATABASE_URL]
인자가 없으면 backend 설정(DATABASE_URL, 기본 sqlite:///./speech_hero.db)을 쓴다. SQLite는 읽기 전용으로 연다.
"""
import sys
from pathlib import Path

from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.models import AIRecommendation, Child, ClinicalObservation, TrainingGoal, TrainingSession  # noqa: E402


def read_only_engine(url: str):
    if url.startswith("sqlite:///") and url != "sqlite://":
        path = Path(url.removeprefix("sqlite:///")).resolve()
        if not path.exists():
            raise SystemExit(f"DB 파일이 없습니다: {path}")
        return create_engine(f"sqlite:///file:{path.as_posix()}?mode=ro&uri=true")
    # 다른 DB에서는 읽기 전용을 강제할 방법이 없으므로 연결하지 않는다(현재 지원 DB는 SQLite뿐이다).
    raise SystemExit("읽기 전용을 보장할 수 있는 SQLite 파일 DB만 지원합니다.")


def audit(db: Session) -> dict:
    mislabeled = (select(TrainingSession).join(Child, Child.id == TrainingSession.child_id)
                  .where(Child.is_seed.is_(True), TrainingSession.is_seed.is_(False)))
    by_mode = {}
    sessions = db.scalars(mislabeled).all()
    for session in sessions:
        by_mode[session.mode] = by_mode.get(session.mode, 0) + 1
    real_ids = [s.id for s in sessions if s.mode == "real"]
    states = dict(db.execute(select(ClinicalObservation.verification_state, func.count())
                             .where(ClinicalObservation.session_id.in_(real_ids))
                             .group_by(ClinicalObservation.verification_state)).all()) if real_ids else {}
    # 실제 아동의 DEMO 연습에서 나온 legacy 추천(수정 전 과거 행). 수락되었다면 목표 버전이 바뀌었을 수 있다.
    practice = (select(AIRecommendation).join(TrainingSession, TrainingSession.id == AIRecommendation.session_id)
                .join(Child, Child.id == TrainingSession.child_id)
                .where(TrainingSession.mode != "real", TrainingSession.is_seed.is_(False), Child.is_seed.is_(False)))
    recs = db.scalars(practice).all()
    rec_status = {}
    for rec in recs:
        rec_status[rec.status] = rec_status.get(rec.status, 0) + 1
    goals = db.scalar(select(func.count()).select_from(TrainingGoal).where(
        TrainingGoal.source_recommendation_id.in_([r.id for r in recs]))) if recs else 0
    return {"seedChildSessionsMarkedNonSeed": by_mode,
            "observationsInThoseRealSessions": states,
            "clinicallyContaminatedObservations": sum(n for state, n in states.items() if state in {"CONFIRMED", "CORRECTED"}),
            "demoPracticeLegacyRecommendations": rec_status,
            "goalVersionsFromDemoPracticeRecommendations": goals}


def main(url: str) -> None:
    engine = read_only_engine(url)
    with Session(engine) as db:
        result = audit(db)
    engine.dispose()
    for key, value in result.items():
        print(f"{key}: {value}")
    print("읽기 전용 점검입니다. DB는 바뀌지 않았습니다.")


if __name__ == "__main__":
    from app.config import settings
    main(sys.argv[1] if len(sys.argv) > 1 else settings.database_url)
