"""치료사 전용 대화 기록. 게임의 임상 성공률과 합산하지 않는다."""
from collections import Counter, defaultdict

from sqlalchemy import select

from ..models import HoyaChatSession, HoyaChatTurn
from .service import source_of

LIMIT = 10
LIMITATION = (
    "최근 대화 회기 최대 10개의 완료된 턴만 집계합니다. 목표 낱말 시도는 TARGET_OBSERVED 근거이며 "
    "정확한 발음 횟수가 아닙니다. 불확실·무발화는 실패가 아닙니다. "
    "게임 회기와 자동 연결하거나 임상 성공률에 합산하지 않습니다."
)


def conversation_insights(db, child):
    sessions = list(db.scalars(select(HoyaChatSession).where(HoyaChatSession.child_id == child.id)
                              .order_by(HoyaChatSession.started_at.desc(), HoyaChatSession.id.desc())
                              .limit(LIMIT)).all())
    counts = defaultdict(Counter)
    if sessions:
        for session_id, evidence in db.execute(select(HoyaChatTurn.session_id, HoyaChatTurn.speech_evidence).where(
                HoyaChatTurn.session_id.in_([session.id for session in sessions]),
                HoyaChatTurn.status == "COMPLETED")):
            counts[session_id][evidence] += 1
    return {"sessions": [
        {"sessionId": session.id, "startedAt": session.started_at.isoformat(), "status": session.status,
         "source": source_of(session, child), "completedTurnN": sum(counts[session.id].values()),
         "targetObservedN": counts[session.id]["TARGET_OBSERVED"],
         "uncertainN": counts[session.id]["UNCERTAIN"], "noSpeechN": counts[session.id]["NO_SPEECH"]}
        for session in sessions], "limitation": LIMITATION}
