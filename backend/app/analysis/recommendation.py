from collections import defaultdict

from sqlalchemy import select

from ..enums import LEVEL_ORDER, TrainingLevel
from ..models import AIRecommendation, ProgressMetric, SpeechAnalysis, TrainingGoal, TrainingSession, Utterance


def _source(session) -> str:
    if session.is_seed:
        return "seed"
    return "clinical" if session.mode == "real" else "practice"


def recommend(db, session, goal, metric):
    retry_rate = metric.retries / max(1, metric.attempts)
    previous = db.execute(select(TrainingSession, ProgressMetric, TrainingGoal).join(ProgressMetric, ProgressMetric.session_id == TrainingSession.id).join(TrainingGoal, TrainingGoal.id == TrainingSession.goal_id).where(TrainingSession.child_id == session.child_id, TrainingSession.status == "completed", ProgressMetric.level == "all").order_by(TrainingSession.started_at.desc()).limit(3)).all()
    # 비교할 과거 회기는 이번 회기와 출처(임상·seed 시연·DEMO 연습)가 같은 것만 쓴다. 조회 범위(최근 3회)와 기준값은 그대로다.
    same_level = [m for s, m, g in previous if g.level == goal.level and not s.runtime_state.get("activityGame")
                  and _source(s) == _source(session)]
    rows = db.execute(select(Utterance, SpeechAnalysis).join(SpeechAnalysis, SpeechAnalysis.utterance_id == Utterance.id).where(Utterance.session_id == session.id)).all()
    word_scores = defaultdict(list)
    for utterance, analysis in rows:
        if utterance.level == "word" and utterance.game != "magic_beam":
            word_scores[utterance.item_text].append(analysis.final_score)
    weak = [word for word, scores in word_scores.items() if len(scores) >= 3 and sum(scores) / len(scores) < 60]
    candidates = []
    if retry_rate > 0.4 or metric.level_down_count:
        next_level = LEVEL_ORDER[max(1, LEVEL_ORDER.index(TrainingLevel(goal.level)) - 1)].value
        candidates.append(("R1", {"level": next_level, "minLevel": next_level}, f"/{goal.target_phoneme}/ 목표에서 재시도 비율 {retry_rate:.0%}, 단계 하향 {metric.level_down_count}회", "음절 연습을 강화하고 다음 세션에서 반응을 관찰하세요."))
    if metric.first_try_success_rate >= 80 and any(m.first_try_success_rate >= 80 for m in same_level):
        next_level = LEVEL_ORDER[min(3, LEVEL_ORDER.index(TrainingLevel(goal.level)) + 1)].value
        candidates.append(("R2", {"level": next_level}, f"최근 두 세션 첫 시도 성공률 {metric.first_try_success_rate:.0f}% 이상", "다음 단계를 검토하세요."))
    if weak:
        candidates.append(("R3", {"priorityTargets": weak}, f"반복 시도 항목의 평균 점수 60점 미만: {', '.join(weak)}", "어려운 단어를 다음 세션의 우선 항목으로 설정하세요."))
    presented = len({u.item_id for u, _ in rows if u.game != "magic_beam"})
    if metric.hints / max(1, presented) > 0.3 and goal.preferred_cue in ("none", "visual_mouth"):
        candidates.append(("R4", {"preferredCue": "auditory_model"}, f"힌트 {metric.hints}회 / 제시 항목 {presented}개", "청각 모델 단서를 검토하세요."))
    if not candidates:
        candidates.append(("R5", {}, "현재 목표에서 수행을 계속 관찰하세요.", "현재 목표 유지"))
    evidence = [{"label": "재시도 비율", "value": f"{retry_rate:.0%}", "metricRef": metric.id}, {"label": "첫 시도 성공률", "value": f"{metric.first_try_success_rate:.1f}%", "metricRef": metric.id}, {"label": "단계 하향", "value": str(metric.level_down_count), "metricRef": metric.id}]
    result = []
    for rule, patch, observation, suggestion in candidates[:2]:
        history_count = 1 + sum(m.retries / max(1, m.attempts) > 0.4 for m in same_level) if rule == "R1" else 1 + len(same_level)
        rec = AIRecommendation(child_id=session.child_id, session_id=session.id, goal_id=goal.id, rule_id=rule, observation=observation, evidence=evidence, suggestion_text=suggestion, suggested_goal=patch, rationale=f"{rule}: retryRate={retry_rate:.2f}, firstTry={metric.first_try_success_rate:.1f}, levelDown={metric.level_down_count}, goal v{goal.version}({goal.level})", confidence="high" if history_count >= 3 else "medium" if history_count >= 2 else "low")
        db.add(rec)
        result.append(rec)
    db.flush()
    return result
