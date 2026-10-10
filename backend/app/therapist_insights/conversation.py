"""치료사 전용 대화 기록. 게임의 임상 성공률과 합산하지 않는다."""
from collections import Counter, defaultdict

from sqlalchemy import func, or_, select

from ..models import HoyaChatSession, HoyaChatTurn
from .service import source_of

LIMIT = 10
LIMITATION = (
    "최근 대화 회기 최대 10개의 완료된 턴만 집계합니다. 목표 낱말 시도는 아이 말에서 목표 낱말이 들린 것으로 기록된 턴 수이며 "
    "정확한 발음 횟수가 아닙니다. 브라우저 음성 인식은 틀린 발음을 표준 낱말로 고쳐 적을 수 있어"
    "([다과]를 '사과'로 적는 식), 대화 기록으로는 발음의 정오를 판단하지 않습니다. 불확실·무발화는 실패가 아닙니다. "
    "게임 회기와 자동 연결하거나 임상 성공률에 합산하지 않습니다."
)


def conversation_insights(db, child):
    has_completed_turn = select(HoyaChatTurn.id).where(
        HoyaChatTurn.session_id == HoyaChatSession.id,
        HoyaChatTurn.status == "COMPLETED",
    ).exists()
    hidden_empty = (HoyaChatSession.status != "active") & ~has_completed_turn
    hidden_empty_n = db.scalar(select(func.count()).select_from(HoyaChatSession).where(
        HoyaChatSession.child_id == child.id, hidden_empty)) or 0
    sessions = list(db.scalars(select(HoyaChatSession).where(
        HoyaChatSession.child_id == child.id,
        or_(HoyaChatSession.status == "active", has_completed_turn))
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
        for session in sessions], "hiddenEmptyN": hidden_empty_n, "limitation": LIMITATION}
