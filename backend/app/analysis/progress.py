from sqlalchemy import select, delete

from ..models import Utterance, SpeechAnalysis, TrainingDecision, ProgressMetric


def recompute(db, session, goal, elapsed_sec=0):
    db.execute(delete(ProgressMetric).where(ProgressMetric.session_id == session.id))
    rows = db.execute(select(Utterance, SpeechAnalysis).join(SpeechAnalysis, SpeechAnalysis.utterance_id == Utterance.id).where(Utterance.session_id == session.id)).all()
    decisions = db.scalars(select(TrainingDecision).where(TrainingDecision.session_id == session.id)).all()
    counts = {"success": 0, "retry": 0, "no_speech": 0}
    for _, a in rows:
        counts[a.final_result] += 1
    attempts = counts["success"] + counts["retry"]
    voiced = [u.acoustic.get("voicedMs", 0) for u, _ in rows if u.game == "magic_beam"]
    scores = [a.final_score for u, a in rows if u.game != "magic_beam"]
    ai_scores = [a.ai_score for u, a in rows if u.game != "magic_beam"]
    presented = {u.item_id for u, _ in rows if u.game != "magic_beam"}
    first = sum(1 for u, a in rows if u.game != "magic_beam" and u.attempt_index == 1 and a.final_result == "success")
    metric = ProgressMetric(child_id=session.child_id, session_id=session.id, goal_id=goal.id, phoneme=goal.target_phoneme, position=goal.word_position, level="all", attempts=attempts, successes=counts["success"], retries=counts["retry"], no_speech=counts["no_speech"], hints=sum(d.decision_type == "HINT" for d in decisions), first_try_success_rate=round(100 * first / max(1, len(presented)), 1), success_rate=round(100 * counts["success"] / max(1, attempts), 1), mean_score=round(sum(scores) / max(1, len(scores)), 1), ai_mean_score=round(sum(ai_scores) / max(1, len(ai_scores)), 1), level_down_count=sum(d.decision_type == "LEVEL_DOWN" for d in decisions), level_up_count=sum(d.decision_type == "LEVEL_UP" for d in decisions), duration_sec=elapsed_sec, max_beam_ms=max(voiced, default=0))
    db.add(metric)
    db.flush()
    return metric
