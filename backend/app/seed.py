from datetime import timedelta
import secrets

from sqlalchemy import select

from .models import Therapist, Child, TrainingGoal, TrainingSession, AIRecommendation, TherapistFeedback, now
from .security import hash_password


def seed(db):
    if db.scalar(select(Therapist.id).limit(1)):
        return
    salt = secrets.token_hex(16)
    therapist = Therapist(username="demo", password_salt=salt, password_hash=hash_password("speechhero", salt), display_name="데모 치료사")
    db.add(therapist)
    db.flush()
    children = []
    for index, (hero, phoneme, sound, code) in enumerate([("바람용사", "ㅅ", "사", "HERO01"), ("별용사", "ㄹ", "라", "HERO02"), ("숲용사", "ㅈ", "자", "HERO03")], 1):
        child = Child(child_code=f"C-{index:04d}", hero_name=hero, therapist_id=therapist.id, play_code=code, guardian_consent_at=now(), is_seed=True)
        db.add(child)
        db.flush()
        db.add(TrainingGoal(child_id=child.id, version=1, target_phoneme=phoneme, target_sound=sound, level="word", min_level="syllable", source="seed"))
        children.append(child)
    db.commit()

    # 앱 초기화 후 실제 play 경로를 호출한다. 점수와 판단은 분석 파이프라인에서만 계산한다.
    from .main import start, play_utterance, complete, create_goal
    from .schemas import StartInput, UtteranceInput, CompleteInput

    def run(child, days_ago, struggle=False):
        response = start(StartInput(play_code=child.play_code, mode="demo"), db=db)
        session = db.get(TrainingSession, response["sessionId"])
        token = response["playToken"]
        item = response["firstItem"]
        attempt = 1
        steps = 0
        while steps < 80:
            if item["game"] == "magic_beam":
                transcript = None
                voiced = item.get("beamTargetMs", 1500) + 250
            else:
                transcript = "따과" if struggle and item["displayText"] == "사과" and attempt <= 3 and steps < 4 else item["displayText"]
                voiced = 900
            result = play_utterance(session.id, UtteranceInput(item_id=item["itemId"], attempt_index=attempt, transcript=transcript, recognizer="demo_script", acoustic={"durationMs": voiced, "voicedMs": voiced, "meanRmsDb": -20, "peakRmsDb": -12, "meanHfRatio": 0.2, "onsetLatencyMs": 100}, elapsed_sec=steps * 8), x_play_token=token, db=db)
            steps += 1
            if result["sessionComplete"]:
                break
            item, attempt = result["nextItem"], result["nextAttemptIndex"]
        if steps >= 80:
            raise RuntimeError("데모 세션 생성 중 반복 상한에 도달했습니다")
        complete(session.id, CompleteInput(elapsed_sec=steps * 8), x_play_token=token, db=db)
        session.is_seed = True
        session.started_at = now() - timedelta(days=days_ago)
        session.ended_at = session.started_at + timedelta(seconds=steps * 8)
        db.commit()
        return session

    def accept(child, rule_id):
        rec = db.scalar(select(AIRecommendation).where(AIRecommendation.child_id == child.id, AIRecommendation.rule_id == rule_id, AIRecommendation.status == "pending").order_by(AIRecommendation.created_at.desc()))
        if not rec:
            raise RuntimeError(f"데모 추천 {rule_id}을 찾지 못했습니다")
        patch = {"level": "syllable", "min_level": "syllable"} if rule_id == "R1" else {"level": "word"}
        next_goal = create_goal(db, child, patch, source="recommendation", recommendation_id=rec.id)
        rec.status, rec.decided_at = "accepted", now() - timedelta(days=12 if rule_id == "R1" else 4)
        db.add(TherapistFeedback(therapist_id=therapist.id, child_id=child.id, kind="recommendation_decision", recommendation_id=rec.id, action="accept", payload={"action": "accept"}, resulting_goal_id=next_goal.id))
        next_goal.created_at = rec.decided_at
        db.commit()

    run(children[0], 14, struggle=True)
    accept(children[0], "R1")
    run(children[0], 10)
    run(children[0], 6)
    accept(children[0], "R2")
    run(children[0], 2, struggle=True)
    run(children[1], 9)
    run(children[1], 5)
