from datetime import timedelta
from types import SimpleNamespace
import secrets

from sqlalchemy import delete, select

from .models import Account, Therapist, Child, EpisodeProgress, RoundMaterialReward, TrainingGoal, TrainingSession, now
from .security import hash_password


# 샘플 아동의 회기 이력. (며칠 전, 게임, 첫 시도를 일부러 어렵게 할지). 모두 seed·DEMO 자료라 임상 근거에 들어가지 않는다.
HISTORY = {
    "HERO01": [(14, "monster_adventure", True), (10, "magic_beam", False), (6, "monster_adventure", False), (2, "monster_adventure", True)],
    "HERO02": [(9, "magic_beam", False), (5, "sky_climb", False)],
}
# 목표 이력: (며칠 전, 바꿀 값). 치료사가 단계를 조정한 흐름을 보여 주는 샘플이다.
GOAL_CHANGES = {"HERO01": [(12, {"level": "syllable", "min_level": "syllable"}), (4, {"level": "word"})]}
GOOD_ACOUSTIC = {"durationMs": 5000, "voicedMs": 4000, "activeMs": 4000, "bestRunMs": 4000, "fricationMs": 4000,
                 "sustainSegmentsMs": [1600, 1600, 1600], "pauseTotalMs": 900, "onsetFricationMs": 500,
                 "voicedAfterFricationMs": 300, "energyMean01": 0.5, "meanRmsDb": -20, "peakRmsDb": -12, "meanHfRatio": 0.5}
SHORT_ACOUSTIC = {**GOOD_ACOUSTIC, "durationMs": 400, "voicedMs": 300, "activeMs": 300, "bestRunMs": 300, "fricationMs": 250,
                  "sustainSegmentsMs": [300]}


def seed(db):
    if db.scalar(select(Therapist.id).limit(1)):
        # 명시적 DEMO 모드에서 기존 MVP DB를 재사용할 때 새 쿠키 계정을 보충한다.
        therapist = db.scalar(select(Therapist).where(Therapist.username == "demo"))
        if therapist and not db.scalar(select(Account.id).where(Account.username == "demo")):
            db.add(Account(username="demo", password_salt=therapist.password_salt,
                           password_hash=therapist.password_hash, role="THERAPIST", therapist_id=therapist.id))
        for child in db.scalars(select(Child).where(Child.is_seed == True)).all():
            if not db.scalar(select(Account.id).where(Account.username == child.play_code)):
                salt = secrets.token_hex(16)
                db.add(Account(username=child.play_code, password_salt=salt,
                               password_hash=hash_password("speechhero", salt), role="STUDENT", child_id=child.id))
        db.commit()
        return
    salt = secrets.token_hex(16)
    therapist = Therapist(username="demo", password_salt=salt, password_hash=hash_password("speechhero", salt), display_name="데모 치료사")
    db.add(therapist)
    db.flush()
    db.add(Account(username="demo", password_salt=salt, password_hash=therapist.password_hash,
                   role="THERAPIST", therapist_id=therapist.id))
    children = {}
    for index, (hero, phoneme, sound, code) in enumerate([("바람용사", "ㅅ", "사", "HERO01"), ("별용사", "ㄹ", "라", "HERO02"), ("숲용사", "ㅈ", "자", "HERO03")], 1):
        child = Child(child_code=f"C-{index:04d}", hero_name=hero, therapist_id=therapist.id, play_code=code, guardian_consent_at=now(), is_seed=True)
        db.add(child)
        db.flush()
        child_salt = secrets.token_hex(16)
        db.add(Account(username=code, password_salt=child_salt,
                       password_hash=hash_password("speechhero", child_salt), role="STUDENT", child_id=child.id))
        db.add(TrainingGoal(child_id=child.id, version=1, target_phoneme=phoneme, target_sound=sound, level="word", min_level="syllable", source="seed",
                            created_at=now() - timedelta(days=15)))
        children[code] = child
    db.commit()

    # 앱 초기화 후 실제 5라운드 활동 경로를 호출한다. 점수와 판단은 분석 파이프라인에서만 계산한다.
    from .main import activity_utterance, complete, create_goal, start_activity
    from .schemas import CompleteInput, StartActivityInput, UtteranceInput

    def run(child, days_ago, game, struggle):
        account = SimpleNamespace(child_id=child.id)  # 서버 내부 seed 호출. 소유권 검사는 같은 아동으로 통과한다.
        started = start_activity(StartActivityInput(game=game, mode="demo"), db=db, account=account)
        session_id = started["sessionId"]
        item, round_index, attempt = started["firstItem"], started["currentRound"]["index"], 1
        for steps in range(1, 60):
            hard = struggle and attempt == 1 and round_index <= 2
            body = {"roundIndex": round_index, "itemId": item["itemId"], "attemptIndex": attempt, "recognizer": "demo_script",
                    "acoustic": SHORT_ACOUSTIC if hard and game != "monster_adventure" else GOOD_ACOUSTIC,
                    "transcript": ("바나나" if hard else item["displayText"]) if game in {"monster_adventure", "conversation_quest"} else None}
            result = activity_utterance(session_id, UtteranceInput.model_validate(body), db=db, account=account, x_activity_lease=None)
            if result["sessionComplete"]:
                break
            item, attempt = result["nextItem"], result["nextAttemptIndex"]
            round_index = result["currentRound"]["index"]
        else:
            raise RuntimeError("데모 세션 생성 중 반복 상한에 도달했습니다")
        complete(session_id, CompleteInput(elapsed_sec=steps * 20), db=db, account=account, x_activity_lease=None)
        session = db.get(TrainingSession, session_id)
        session.started_at = now() - timedelta(days=days_ago)
        session.ended_at = session.started_at + timedelta(seconds=steps * 20)
        db.commit()

    for code, history in HISTORY.items():
        child = children[code]
        changes = list(GOAL_CHANGES.get(code, []))
        for days_ago, game, struggle in history:
            while changes and changes[0][0] > days_ago:
                changed_days, values = changes.pop(0)
                goal = create_goal(db, child, values, source="seed")
                goal.created_at = now() - timedelta(days=changed_days)
                db.commit()
            run(child, days_ago, game, struggle)
    # 샘플 회기는 과거 기록을 보여 주기 위한 것이다. 소풍 재료는 0에서 시작해 시연에서 직접 모으게 한다.
    seeded = [child.id for child in children.values()]
    db.execute(delete(RoundMaterialReward).where(RoundMaterialReward.child_id.in_(seeded)))
    db.execute(delete(EpisodeProgress).where(EpisodeProgress.child_id.in_(seeded)))
    db.commit()
