"""주기적으로 실행하는 개인정보 보존 작업."""
import asyncio
import logging
from datetime import timedelta

from sqlalchemy import select

from .models import Utterance, now


def purge_expired_transcripts(db, retention_days: int, current=None) -> int:
    """보존 기간이 지난 발화의 인식 문장과 대체 인식 결과를 비운다. 비운 발화 수를 돌려준다."""
    cutoff = (current or now()) - timedelta(days=retention_days)
    rows = [row for row in db.scalars(select(Utterance).where(Utterance.created_at < cutoff)).all()
            if row.transcript is not None or row.alternatives]
    for utterance in rows:
        utterance.transcript = None
        utterance.alternatives = []
    db.commit()
    return len(rows)


def run_retention_once(session_factory, retention_days: int) -> int:
    with session_factory() as db:
        return purge_expired_transcripts(db, retention_days)


async def retention_loop(session_factory, retention_days: int, interval_sec: float) -> None:
    """서버가 켜져 있는 동안 interval_sec마다 보존 기간 삭제를 실행한다."""
    while True:
        await asyncio.sleep(interval_sec)
        try:
            await asyncio.to_thread(run_retention_once, session_factory, retention_days)
        except Exception:  # 한 번 실패해도 다음 주기에 다시 시도한다.
            logging.exception("전사문 보존 기간 삭제에 실패했습니다")
