"""V2 hardening 회귀 테스트: 세션 종류, 라운드 의미, 실제 음향 규칙, DEMO 검토, 로그인, 보존 기간, 보안 헤더."""

import asyncio
from datetime import timedelta

import pytest
from sqlalchemy import select

from app import main as api_module
from app import maintenance
from app.games.rounds import GAME_ROUNDS, public_round
from app.models import Child, ClinicalObservation, TrainingPlan, TrainingSession, Utterance, now
from test_api_flow import api, auth, child_login, real_child_auth, student_auth


GOOD = {"noiseFloorDb": -60, "meanRmsDb": -35}


def _start(client, headers, game, mode="real"):
    response = client.post("/api/activities", headers=headers, json={"game": game, "mode": mode})
    assert response.status_code == 200, response.text
    return response.json()


def _jump(sessions, session_id, round_index):
    """테스트용으로 서버 상태를 특정 라운드의 첫 시도로 옮긴다."""
    with sessions() as db:
        session = db.get(TrainingSession, session_id)
        state = dict(session.runtime_state)
        definition = GAME_ROUNDS[state["activityGame"]][round_index - 1]
        item = db.get(TrainingPlan, session.plan_id).plan_json["stages"][round_index - 1]["items"][0]
        state.update(roundIndex=round_index, stageIndex=round_index - 1, currentItem=item, roundAttempt=1,
                     roundAttemptsUsed=0, roundSuccesses=0, roundEvaluated=0, listenAgainCount=0,
                     roundStartedAt=now().isoformat(), difficulty=2,
                     roundDefinition={**public_round(definition, 2), "independence": "INDEPENDENT"})
        session.runtime_state = state
        db.commit()
        return item


def _say(client, headers, session_id, round_index, item, acoustic, attempt=1, transcript=None):
    response = client.post(f"/api/activities/{session_id}/utterances", headers=headers,
                           json={"roundIndex": round_index, "itemId": item["itemId"], "attemptIndex": attempt,
                                 "transcript": transcript, "acoustic": acoustic})
    assert response.status_code == 200, response.text
    return {event["type"] for event in response.json()["events"]}


# ---------------------------------------------------------------- 1. 세션 종류 교차 호출

def _legacy(client, headers, mode="demo"):
    response = client.post("/api/play/start", headers=headers, json={"playCode": "HERO01", "mode": mode})
    assert response.status_code == 200, response.text
    return response.json()


def test_legacy_endpoint_accepts_legacy_session(api):
    client, _ = api
    headers = student_auth(client)
    started = _legacy(client, headers)
    response = client.post(f"/api/play/sessions/{started['sessionId']}/utterances", headers=headers,
                           json={"itemId": started["firstItem"]["itemId"], "attemptIndex": 1,
                                 "transcript": started["firstItem"]["displayText"], "acoustic": {"durationMs": 900}})
    assert response.status_code == 200, response.text


def test_legacy_endpoint_rejects_activity_session(api):
    client, _ = api
    headers = student_auth(client)
    started = _start(client, headers, "magic_beam", "demo")
    response = client.post(f"/api/play/sessions/{started['sessionId']}/utterances", headers=headers,
                           json={"itemId": started["firstItem"]["itemId"], "attemptIndex": 1, "acoustic": {"durationMs": 900}})
    assert response.status_code == 409


def test_activity_endpoint_accepts_activity_session(api):
    client, _ = api
    headers = student_auth(client)
    started = _start(client, headers, "magic_beam", "demo")
    assert client.get(f"/api/activities/{started['sessionId']}", headers=headers).status_code == 200
    events = _say(client, headers, started["sessionId"], 1, started["firstItem"],
                  {"durationMs": 1300, "activeMs": 1200, "bestRunMs": 1200, "fricationMs": 1200})
    assert "ROUND_CLEAR" in events


def test_activity_endpoint_rejects_legacy_session(api):
    client, _ = api
    headers = student_auth(client)
    started = _legacy(client, headers)
    assert client.get(f"/api/activities/{started['sessionId']}", headers=headers).status_code == 409
    response = client.post(f"/api/activities/{started['sessionId']}/utterances", headers=headers,
                           json={"roundIndex": 1, "itemId": started["firstItem"]["itemId"], "acoustic": {"durationMs": 900}})
    assert response.status_code == 409


def test_unknown_session_is_404_on_every_play_route(api):
    client, _ = api
    headers = student_auth(client)
    missing = "00000000-0000-0000-0000-000000000000"
    assert client.post(f"/api/play/sessions/{missing}/utterances", headers=headers,
                       json={"itemId": "x", "acoustic": {}}).status_code == 404
    assert client.post(f"/api/play/sessions/{missing}/complete", headers=headers, json={}).status_code == 404
    assert client.get(f"/api/activities/{missing}", headers=headers).status_code == 404
    assert client.post(f"/api/activities/{missing}/utterances", headers=headers,
                       json={"roundIndex": 1, "itemId": "x", "acoustic": {}}).status_code == 404


@pytest.mark.parametrize("damage", [
    {"currentItem": None}, {"itemAttempt": "1"}, {"stageIndex": None},
])
def test_malformed_legacy_state_is_409_not_500(api, damage):
    client, sessions = api
    headers = student_auth(client)
    started = _legacy(client, headers)
    with sessions() as db:
        session = db.get(TrainingSession, started["sessionId"])
        session.runtime_state = {**session.runtime_state, **damage}
        db.commit()
    response = client.post(f"/api/play/sessions/{started['sessionId']}/utterances", headers=headers,
                           json={"itemId": started["firstItem"]["itemId"], "acoustic": {"durationMs": 900}})
    assert response.status_code == 409


@pytest.mark.parametrize("damage", [
    {"roundIndex": 9}, {"roundIndex": "1"}, {"activityGame": "unknown_game"}, {"currentItem": []},
    {"roundStartedAt": "not-a-date"}, {"difficulty": None},
])
def test_malformed_activity_state_is_409_not_500(api, damage):
    client, sessions = api
    headers = student_auth(client)
    started = _start(client, headers, "magic_beam", "demo")
    with sessions() as db:
        session = db.get(TrainingSession, started["sessionId"])
        session.runtime_state = {**session.runtime_state, **damage}
        db.commit()
    assert client.get(f"/api/activities/{started['sessionId']}", headers=headers).status_code == 409
    response = client.post(f"/api/activities/{started['sessionId']}/utterances", headers=headers,
                           json={"roundIndex": 1, "itemId": started["firstItem"]["itemId"], "acoustic": {"durationMs": 900}})
    assert response.status_code == 409


# ---------------------------------------------------------------- 2. Monster Adventure R4 의미

def test_round_labels_do_not_claim_untrained_words():
    for rounds in GAME_ROUNDS.values():
        for definition in rounds:
            assert definition.item_source == "TRAINING_BANK"
            text = definition.child_title + definition.child_prompt + definition.clinical_focus
            assert "미훈련" not in text and "처음 보는" not in text and "novel" not in text.lower()
    assert public_round(GAME_ROUNDS["monster_adventure"][3])["itemSource"] == "TRAINING_BANK"


def test_monster_round_items_come_from_training_bank_and_do_not_repeat_in_session(api):
    from app.training.content import BANK
    client, sessions = api
    headers = student_auth(client)
    started = _start(client, headers, "monster_adventure", "demo")
    with sessions() as db:
        session = db.get(TrainingSession, started["sessionId"])
        stages = db.get(TrainingPlan, session.plan_id).plan_json["stages"]
    texts = [stage["items"][0]["displayText"] for stage in stages]
    assert texts[0] in BANK["ㅅ"]["syllable"]
    assert all(text in BANK["ㅅ"]["word"] for text in texts[1:4])
    assert texts[4] in BANK["ㅅ"]["short_sentence"]
    assert len(set(texts[1:4])) == 3  # R2·R3·R4 단어가 같은 세션 안에서 겹치지 않는다.
    assert stages[3]["round"]["itemSource"] == "TRAINING_BANK"


# ---------------------------------------------------------------- 3. 실제 마이크 음향 규칙

CASES = [
    # game, round, acoustic, expected event
    ("magic_beam", 3, {"durationMs": 2800, "activeMs": 2600, "bestRunMs": 2500, "fricationMs": 2600, "interruptionCount": 0}, "TARGET_SUCCESS"),
    ("magic_beam", 3, {"durationMs": 2800, "activeMs": 2600, "bestRunMs": 2500, "fricationMs": 2600, "interruptionCount": 3}, "TARGET_RETRY"),
    ("magic_beam", 4, {"durationMs": 3000, "activeMs": 1800, "bestRunMs": 600, "fricationMs": 1800, "sustainSegmentsMs": [600, 600, 600]}, "TARGET_SUCCESS"),
    ("magic_beam", 4, {"durationMs": 2000, "activeMs": 1200, "bestRunMs": 600, "fricationMs": 1200, "sustainSegmentsMs": [600, 600]}, "TARGET_RETRY"),
    ("magic_beam", 5, {"durationMs": 1200, "activeMs": 900, "bestRunMs": 500, "fricationMs": 500, "onsetFricationMs": 500, "voicedAfterFricationMs": 300}, "TARGET_SUCCESS"),
    ("magic_beam", 5, {"durationMs": 1200, "activeMs": 900, "bestRunMs": 500, "fricationMs": 500, "onsetFricationMs": 500, "voicedAfterFricationMs": 0}, "TARGET_RETRY"),
    ("sky_climb", 3, {"durationMs": 2000, "activeMs": 1800, "bestRunMs": 1600, "energyMean01": 0.5}, "TARGET_SUCCESS"),
    ("sky_climb", 3, {"durationMs": 2000, "activeMs": 1800, "bestRunMs": 1600, "energyMean01": 0.9}, "TARGET_RETRY"),
]


@pytest.mark.parametrize("game,round_index,acoustic,expected", CASES)
def test_microphone_round_rules_through_api(api, game, round_index, acoustic, expected):
    client, sessions = api
    headers = student_auth(client)
    started = _start(client, headers, game)
    item = _jump(sessions, started["sessionId"], round_index)
    events = _say(client, headers, started["sessionId"], round_index, item, {**GOOD, **acoustic})
    assert expected in events
    with sessions() as db:
        observation = db.scalars(select(ClinicalObservation).where(
            ClinicalObservation.session_id == started["sessionId"])).one()
        assert observation.evidence["acoustic"]["source"] == "microphone"


RE_ONSET = [
    ("short pause", {"sustainSegmentsMs": [1100, 1100], "pauseTotalMs": 150}, "TARGET_RETRY"),
    ("natural pause and restart", {"sustainSegmentsMs": [1100, 1100], "pauseTotalMs": 1200}, "TARGET_SUCCESS"),
    ("long pause", {"sustainSegmentsMs": [1100, 1100], "pauseTotalMs": 5000}, "TARGET_RETRY"),
    ("no restart", {"sustainSegmentsMs": [1100], "pauseTotalMs": 0}, "TARGET_RETRY"),
]


@pytest.mark.parametrize("label,extra,expected", RE_ONSET, ids=[case[0] for case in RE_ONSET])
def test_sky_climb_re_onset(api, label, extra, expected):
    client, sessions = api
    headers = student_auth(client)
    started = _start(client, headers, "sky_climb")
    item = _jump(sessions, started["sessionId"], 4)
    acoustic = {**GOOD, "durationMs": 3600, "activeMs": 2200, "bestRunMs": 1100, **extra}
    events = _say(client, headers, started["sessionId"], 4, item, acoustic)
    assert expected in events
    assert "TARGET_RETRY" in events or "ROUND_CLEAR" in events  # 재시도도 실패 연출이 아니다.


def test_re_onset_round_allows_a_natural_pause_inside_one_utterance():
    definition = GAME_ROUNDS["sky_climb"][3]
    assert definition.rule == "RE_ONSET"
    # 자연스러운 쉼(약 1.2초)이 발화 종료 유예보다 짧아 한 발화 안에서 측정된다. 다른 라운드 유예는 700ms 그대로다.
    assert definition.end_hold_ms >= 2000
    assert public_round(definition)["endHoldMs"] == definition.end_hold_ms
    assert all(r.end_hold_ms == 700 for game in ("monster_adventure", "conversation_quest") for r in GAME_ROUNDS[game])


def test_re_onset_no_speech_and_uncertain_are_neutral(api):
    client, sessions = api
    headers = student_auth(client)
    started = _start(client, headers, "sky_climb")
    item = _jump(sessions, started["sessionId"], 4)
    silent = _say(client, headers, started["sessionId"], 4, item, {**GOOD, "durationMs": 900, "activeMs": 0})
    assert "NO_SPEECH" in silent and "TARGET_RETRY" not in silent
    poor = _say(client, headers, started["sessionId"], 4, item,
                {"noiseFloorDb": -60, "meanRmsDb": -56, "durationMs": 3600, "activeMs": 2200,
                 "sustainSegmentsMs": [1100, 1100], "pauseTotalMs": 1200})
    assert "LISTEN_AGAIN" in poor and "TARGET_RETRY" not in poor
    with sessions() as db:
        state = db.get(TrainingSession, started["sessionId"]).runtime_state
        assert state["roundAttempt"] == 1 and state["totalAttempts"] == 0


# ---------------------------------------------------------------- 4. DEMO 관찰 검토 의미

def test_demo_observation_is_marked_and_review_is_not_clinical_verification(api):
    client, _ = api
    student = student_auth(client)
    started = _start(client, student, "magic_beam", "demo")
    _say(client, student, started["sessionId"], 1, started["firstItem"],
         {"durationMs": 1300, "activeMs": 1200, "bestRunMs": 1200, "fricationMs": 1200})
    therapist = auth(client)
    observation = client.get(f"/api/sessions/{started['sessionId']}/timeline", headers=therapist).json()["observations"][0]
    assert observation["is_demo"] is True and observation["clinical_eligible"] is False
    decided = client.post(f"/api/observations/{observation['id']}/decision", headers=therapist,
                          json={"action": "confirm"}).json()
    assert decided["verification_state"] == "DEMO_CONFIRMED"
    with api[1]() as db:
        child_id = db.query(Child).filter(Child.child_code == "C-0001").one().id
    proposal = client.post(f"/api/children/{child_id}/activity-recommendations", headers=therapist).json()
    assert proposal["status"] == "INSUFFICIENT_DATA"


def test_real_observation_is_clinically_eligible(api):
    client, _ = api
    student, _child = real_child_auth(client)
    started = _start(client, student, "magic_beam")
    _say(client, student, started["sessionId"], 1, started["firstItem"],
         {**GOOD, "durationMs": 1300, "activeMs": 1200, "bestRunMs": 1200, "fricationMs": 1200})
    therapist = auth(client)
    observation = client.get(f"/api/sessions/{started['sessionId']}/timeline", headers=therapist).json()["observations"][0]
    assert observation["is_demo"] is False and observation["clinical_eligible"] is True
    decided = client.post(f"/api/observations/{observation['id']}/decision", headers=therapist,
                          json={"action": "confirm"}).json()
    assert decided["verification_state"] == "CONFIRMED"


# ---------------------------------------------------------------- 8. 임상 요약 표본 수와 추천

def test_summary_separates_evaluable_from_uncertain_and_no_speech(api):
    client, _ = api
    student, _child = real_child_auth(client)
    started = _start(client, student, "magic_beam")
    session_id, item = started["sessionId"], started["firstItem"]
    _say(client, student, session_id, 1, item, {**GOOD, "durationMs": 900, "activeMs": 0})
    _say(client, student, session_id, 1, item, {"noiseFloorDb": -60, "meanRmsDb": -56, "durationMs": 1200, "activeMs": 1000})
    _say(client, student, session_id, 1, item, {**GOOD, "durationMs": 1300, "activeMs": 1200, "bestRunMs": 300, "fricationMs": 1200})
    therapist = auth(client)
    row = client.get(f"/api/sessions/{session_id}/clinical-summary", headers=therapist).json()["rounds"][0]
    assert row["totalObservedN"] == 3
    assert row["evaluableN"] == 1
    assert row["uncertainN"] == 1
    assert row["noSpeechN"] == 1
    assert row["limitedData"] is True
    assert "n" not in row
    empty = client.get(f"/api/sessions/{session_id}/clinical-summary", headers=therapist).json()["rounds"][1]
    assert empty["totalObservedN"] == 0 and empty["verifiedRate"] is None  # 자료 없음은 0%가 아니다.


def test_sound_recommendation_ignores_confirmed_uncertain_observations(api):
    client, sessions = api
    student, created = real_child_auth(client)
    for _ in range(2):
        started = _start(client, student, "magic_beam")
        # 음질 불량 발화의 짧은 bestRunMs가 '지속이 짧다'는 근거로 쓰이면 안 된다.
        _say(client, student, started["sessionId"], 1, started["firstItem"],
             {"noiseFloorDb": -60, "meanRmsDb": -56, "durationMs": 1200, "activeMs": 1000, "bestRunMs": 200})
        therapist = auth(client)
        for observation in client.get(f"/api/sessions/{started['sessionId']}/timeline", headers=therapist).json()["observations"]:
            assert observation["ai_result"] == "uncertain"
            client.post(f"/api/observations/{observation['id']}/decision", headers=therapist,
                        json={"action": "confirm"}).raise_for_status()
        student = child_login(client, created)
    therapist = auth(client)
    child_id = created["id"]
    proposal = client.post(f"/api/children/{child_id}/activity-recommendations", headers=therapist).json()
    assert proposal["recommendation"]["activity"] != "magic_beam"


# ---------------------------------------------------------------- 5. 로그인

def test_unknown_account_pays_password_hash_cost(api, monkeypatch):
    client, _ = api
    calls = []
    original = api_module.verify_dummy_password
    monkeypatch.setattr(api_module, "verify_dummy_password", lambda password: calls.append(password) or original(password))
    response = client.post("/api/auth/login", json={"username": "nobody", "password": "whatever"})
    assert response.status_code == 401
    assert response.json()["detail"] == client.post("/api/auth/login", json={"username": "demo", "password": "bad"}).json()["detail"]
    assert calls == ["whatever"]


def test_username_limit_blocks_across_passwords(api, monkeypatch):
    client, _ = api
    monkeypatch.setattr(api_module.settings, "login_max_failures_pair", 100)
    monkeypatch.setattr(api_module.settings, "login_max_failures_username", 3)
    for index in range(3):
        assert client.post("/api/auth/login", json={"username": "demo", "password": f"bad{index}"}).status_code == 401
    assert client.post("/api/auth/login", json={"username": "DEMO", "password": "speechhero"}).status_code == 429
    assert client.post("/api/auth/login", json={"username": "HERO01", "password": "speechhero"}).status_code == 200


def test_ip_limit_blocks_spraying_many_usernames(api, monkeypatch):
    client, _ = api
    monkeypatch.setattr(api_module.settings, "login_max_failures_ip", 4)
    for index in range(4):
        assert client.post("/api/auth/login", json={"username": f"user{index}", "password": "x"}).status_code == 401
    blocked = client.post("/api/auth/login", json={"username": "demo", "password": "speechhero"})
    assert blocked.status_code == 429
    assert blocked.json()["detail"] == "잠시 후 다시 시도해 주세요"


def test_login_failures_expire_after_window(api, monkeypatch):
    from app.models import LoginFailure
    client, sessions = api
    for _ in range(5):
        client.post("/api/auth/login", json={"username": "demo", "password": "bad"})
    assert client.post("/api/auth/login", json={"username": "demo", "password": "speechhero"}).status_code == 429
    with sessions() as db:
        for row in db.query(LoginFailure).all():
            row.created_at = now() - timedelta(minutes=16)
        db.commit()
    assert client.post("/api/auth/login", json={"username": "demo", "password": "speechhero"}).status_code == 200


def test_demo_accounts_flag_follows_server_setting(api, monkeypatch):
    client, _ = api
    assert client.get("/api/config/public").json()["demoModeEnabled"] is True
    monkeypatch.setattr(api_module.settings, "seed_demo_data", False)
    assert client.get("/api/config/public").json()["demoModeEnabled"] is False


# ---------------------------------------------------------------- 6. 보존 기간

def test_retention_purge_clears_only_expired_transcripts(api):
    _, sessions = api
    with sessions() as db:
        rows = db.scalars(select(Utterance).where(Utterance.transcript.is_not(None))).all()
        assert len(rows) >= 2
        old, fresh = rows[0], rows[1]
        old.created_at = now() - timedelta(days=91)
        old.alternatives = ["사과"]
        fresh.created_at = now() - timedelta(days=1)
        old_id, fresh_id = old.id, fresh.id
        db.commit()
        assert maintenance.purge_expired_transcripts(db, 90) == 1
        assert maintenance.purge_expired_transcripts(db, 90) == 0
    with sessions() as db:
        assert db.get(Utterance, old_id).transcript is None and db.get(Utterance, old_id).alternatives == []
        assert db.get(Utterance, fresh_id).transcript is not None


def test_retention_loop_runs_periodically(monkeypatch):
    calls = []
    monkeypatch.setattr(maintenance, "run_retention_once", lambda factory, days: calls.append(days) or 0)

    async def run():
        task = asyncio.create_task(maintenance.retention_loop(object(), 90, 0.01))
        await asyncio.sleep(0.08)
        task.cancel()
    asyncio.run(run())
    assert len(calls) >= 2 and set(calls) == {90}


# ---------------------------------------------------------------- 7. 보안 헤더

HEADERS = ("Cache-Control", "X-Content-Type-Options", "Referrer-Policy", "X-Frame-Options", "Content-Security-Policy")


def _has_security_headers(response):
    return all(name in response.headers for name in HEADERS)


def test_security_headers_on_normal_and_early_responses(api):
    client, _ = api
    responses = [
        client.get("/api/system/info"),
        client.get("/api/auth/me"),  # 401
        client.post("/api/auth/login", headers={"Origin": "https://evil.example"}, json={}),  # 미들웨어 403
        client.post("/api/auth/login", content=b"{" + b" " * 70000 + b"}",
                    headers={"Content-Type": "application/json"}),  # 미들웨어 413
        client.post("/api/auth/login", content=b"{}", headers={"Content-Type": "application/json",
                                                                "Content-Length": "abc"}),  # 미들웨어 400
        client.post("/api/auth/login", json={"username": ""}),  # 422
    ]
    assert [response.status_code for response in responses] == [200, 401, 403, 413, 400, 422]
    for response in responses:
        assert _has_security_headers(response), response.status_code
        assert "frame-ancestors 'none'" in response.headers["Content-Security-Policy"]
