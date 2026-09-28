from collections import Counter

from sqlalchemy import select

from ..models import ProgressMetric, SpeechAnalysis, TrainingSession, Utterance


def generate_insights(db, session, goal, metric) -> list[str]:
    rows = db.execute(select(Utterance, SpeechAnalysis).join(SpeechAnalysis, SpeechAnalysis.utterance_id == Utterance.id).where(Utterance.session_id == session.id)).all()
    words = [(u.item_text, a.final_score) for u, a in rows if u.game != "magic_beam" and a.final_result == "retry"]
    lines = [f"/{goal.target_phoneme}/ 목표 재시도 {metric.retries}회 관찰"]
    if words:
        weakest = min(words, key=lambda pair: pair[1])
        lines.append(f"{weakest[0]} 항목에서 낮은 수행 점수 {weakest[1]}점이 관찰되었습니다.")
    previous = db.execute(select(TrainingSession, ProgressMetric).join(ProgressMetric, ProgressMetric.session_id == TrainingSession.id).where(TrainingSession.child_id == session.child_id, TrainingSession.id != session.id, TrainingSession.status == "completed").order_by(TrainingSession.started_at.desc()).limit(1)).first()
    if previous:
        delta = metric.first_try_success_rate - previous[1].first_try_success_rate
        if abs(delta) >= 15:
            lines.append(f"직전 세션 대비 첫 시도 성공률이 {abs(delta):.0f}%p {'증가' if delta > 0 else '감소'}했습니다.")
    tags = Counter(tag for _, analysis in rows for tag in analysis.pattern_tags)
    if tags:
        lines.append(f"관찰된 대치 유형(추정): {tags.most_common(1)[0][0]}")
    lines.append("ASR 기반 근사 분석이며 임상 판단을 대체하지 않습니다.")
    return lines
