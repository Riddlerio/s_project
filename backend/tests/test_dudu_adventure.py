"""두두 스킬 권한·비임상 제작·기기 간 재개의 실제 API 경계를 검증한다.

임시 DB와 가상 음향 입력을 사용한다. 실제 마이크나 치료 효과 검증은 아니다.
"""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta
from threading import Barrier
from uuid import uuid4

import pytest
from sqlalchemy import inspect, select
from sqlalchemy.orm import sessionmaker

from app.db import Base, make_engine
from app.models import (
    Account, ActivityLease, AuditEvent, Child, CraftEvent, EpisodeProgress,
    ProgressMetric, SkillGrant, SpeechAnalysis, Therapist, TrainingGoal, TrainingPlan,
    TrainingSession, Utterance, now,
)
from app.security import hash_password, hash_token
from test_api_flow import api, auth, student_auth


GOOD_ACOUSTIC = {
    "durationMs": 5000, "activeMs": 4000, "voicedMs": 4000,
    "bestRunMs": 4000, "fricationMs": 4000,
    "sustainSegmentsMs": [1600, 1600, 1600], "pauseTotalMs": 900,
    "onsetFricationMs": 500, "voicedAfterFricationMs": 300, "energyMean01": 0.5,
}
DECISION = {"evidenceKind": "DIRECT_OBSERVATION", "note": "치료사가 직접 관찰하고 승인함"}


def _actor(client, login, *args):
    """한 client에서도 두 기기/역할의 쿠키와 CSRF를 섞지 않는다."""
    headers = login(client, *args)
    return {**headers, "Cookie": f"speech_hero_session={client.cookies.get('speech_hero_session')}"}


def _child(sessions, code="HERO01"):
    with sessions() as db:
        return db.scalar(select(Child).where(Child.play_code == code)).id


def _start(client, headers, game="magic_beam", mode="demo"):
    response = client.post("/api/activities", headers=headers, json={"game": game, "mode": mode})
    assert response.status_code == 200, response.text
    started = response.json()
    assert len(started["rounds"]) == 5
    # 기존 세션은 claim하기 전까지 이전 기기의 입력 계약을 유지한다.
    claimed = client.post(f"/api/activities/{started['sessionId']}/claim", headers=headers,
                          json={"takeover": False})
    assert claimed.status_code == 200, claimed.text
    assert claimed.json()["leaseToken"]
    return claimed.json()


def _lease(headers, started):
    return {**headers, "X-Activity-Lease": started["leaseToken"]}


def _body(item, round_index, attempt=1, attack="basic", acoustic=None):
    return {"roundIndex": round_index, "itemId": item["itemId"], "attemptIndex": attempt,
            "transcript": item["displayText"], "recognizer": "demo_script", "attack": attack,
            "acoustic": dict(GOOD_ACOUSTIC if acoustic is None else acoustic)}


def _say(client, headers, started, item, round_index, attack="basic"):
    response = client.post(f"/api/activities/{started['sessionId']}/utterances",
                          headers=_lease(headers, started), json=_body(item, round_index, attack=attack))
    assert response.status_code == 200, response.text
    assert "ROUND_CLEAR" in {event["type"] for event in response.json()["events"]}
    return response.json()


def _inventory(client, headers):
    response = client.get("/api/me/adventure", headers=headers)
    assert response.status_code == 200, response.text
    return response.json()


def _grant(client, headers, child_id, action="grant", decision=None):
    response = client.post(f"/api/children/{child_id}/skills/magic_beam/{action}",
                          headers=headers, json=DECISION if decision is None else decision)
    assert response.status_code == 200, response.text
    return response.json()


def _two_requests(client, url, headers, bodies):
    """같은 DB 상태를 경쟁하는 요청을 실제 API에 함께 보낸다. sleep을 쓰지 않는다."""
    gate = Barrier(2)

    def request(body):
        gate.wait(timeout=10)
        return client.post(url, headers=headers, json=body)

    with ThreadPoolExecutor(max_workers=2) as workers:
        return list(workers.map(request, bodies))


def test_skill_requires_explicit_therapist_approval_and_keeps_audit_history(api):
    client, sessions = api
    child_id = _child(sessions)
    student = _actor(client, student_auth)
    therapist = _actor(client, auth)
    assert client.get("/api/me/skills", headers=student).json() == {"magicBeam": False}
    initial = client.get(f"/api/children/{child_id}/skills/magic_beam", headers=therapist)
    assert initial.status_code == 200
    assert initial.json()["granted"] is False and initial.json()["history"] == []
    with sessions() as db:
        goals_before = [(goal.id, goal.version, goal.target_phoneme, goal.level)
                        for goal in db.scalars(select(TrainingGoal).where(TrainingGoal.child_id == child_id))]
    granted = _grant(client, therapist, child_id)
    assert granted["granted"] is True
    assert granted["therapistName"] and granted["grantedAt"]
    assert granted["evidenceKind"] == "DIRECT_OBSERVATION"
    assert granted["note"] == DECISION["note"]
    assert client.get("/api/me/skills", headers=student).json() == {"magicBeam": True}
    revoked = _grant(client, therapist, child_id, "revoke",
                     {"evidenceKind": "APP_OBSERVATION", "note": "치료사가 사용 권한을 철회함"})
    assert revoked["granted"] is False
    assert {entry["action"] for entry in revoked["history"]} == {"GRANT", "REVOKE"}
    assert len(revoked["history"]) == 2
    assert all(entry["therapistName"] and entry["at"] and entry["note"] for entry in revoked["history"])
    assert client.get("/api/me/skills", headers=student).json() == {"magicBeam": False}
    with sessions() as db:
        assert len(db.scalars(select(SkillGrant).where(SkillGrant.child_id == child_id)).all()) == 2
        actions = [row.action for row in db.scalars(select(AuditEvent))]
        assert actions.count("SKILL_GRANT") == 1 and actions.count("SKILL_REVOKE") == 1
        assert [(goal.id, goal.version, goal.target_phoneme, goal.level)
                for goal in db.scalars(select(TrainingGoal).where(TrainingGoal.child_id == child_id))] == goals_before


def test_skill_role_csrf_and_child_ownership_are_enforced(api):
    client, sessions = api
    child_id = _child(sessions)
    student = _actor(client, student_auth)
    url = f"/api/children/{child_id}/skills/magic_beam"
    assert client.get(url, headers=student).status_code == 403
    assert client.post(f"{url}/grant", headers=student, json=DECISION).status_code == 403
    therapist = _actor(client, auth)
    without_csrf = {"Cookie": therapist["Cookie"]}
    assert client.post(f"{url}/grant", headers=without_csrf, json=DECISION).status_code == 403
    assert client.post(f"{url}/revoke", headers=without_csrf, json=DECISION).status_code == 403
    salt = "33" * 16
    with sessions() as db:
        other = Therapist(username="dudu-other", display_name="다른 치료사", password_salt=salt,
                          password_hash=hash_password("validpass", salt))
        db.add(other); db.flush()
        db.add(Account(username=other.username, password_salt=salt, password_hash=other.password_hash,
                       role="THERAPIST", therapist_id=other.id))
        db.commit()
    login = client.post("/api/auth/login", json={"username": "dudu-other", "password": "validpass"})
    assert login.status_code == 200
    outsider = {"X-CSRF-Token": login.json()["csrfToken"],
                "Cookie": f"speech_hero_session={client.cookies.get('speech_hero_session')}"}
    assert client.get(url, headers=outsider).status_code == 404
    assert client.post(f"{url}/grant", headers=outsider, json=DECISION).status_code == 404
    assert client.post(f"{url}/revoke", headers=outsider, json=DECISION).status_code == 404
    with sessions() as db:
        assert not db.scalars(select(SkillGrant).where(SkillGrant.child_id == child_id)).all()
        assert len(db.scalars(select(AuditEvent).where(AuditEvent.action == "ACCESS_DENIED",
                                                      AuditEvent.resource_id == child_id)).all()) == 3


@pytest.mark.parametrize("decision", [{}, {"note": "근거 유형 없음"},
                                      {"evidenceKind": "AI_SCORE", "note": "자동 승인"}])
def test_skill_approval_rejects_missing_or_unsupported_evidence(api, decision):
    client, sessions = api
    response = client.post(f"/api/children/{_child(sessions)}/skills/magic_beam/grant",
                           headers=_actor(client, auth), json=decision)
    assert response.status_code == 422
    with sessions() as db:
        assert not db.scalars(select(SkillGrant)).all()


def test_unapproved_beam_is_rejected_without_using_an_attempt_and_basic_still_clears(api):
    client, sessions = api
    student = _actor(client, student_auth)
    started = _start(client, student, "monster_adventure")
    item = started["firstItem"]
    rejected = client.post(f"/api/activities/{started['sessionId']}/utterances",
                           headers=_lease(student, started), json=_body(item, 1, attack="magic_beam"))
    assert rejected.status_code == 403
    with sessions() as db:
        assert not db.scalars(select(Utterance).where(Utterance.session_id == started["sessionId"])).all()
        assert db.get(TrainingSession, started["sessionId"]).runtime_state["roundAttempt"] == 1
    result = _say(client, student, started, item, 1)
    assert result["currentRound"]["index"] == 2
    assert client.get("/api/me/skills", headers=student).json() == {"magicBeam": False}


@pytest.mark.parametrize("wrong_word", [False, True])
def test_granted_attack_and_basic_have_identical_clinical_assessment_and_revoke_applies_next_round(api, wrong_word):
    client, sessions = api
    student = _actor(client, student_auth)
    therapist = _actor(client, auth)
    _grant(client, therapist, _child(sessions))
    other_child = _actor(client, student_auth, "HERO02")
    assert client.get("/api/me/skills", headers=other_child).json() == {"magicBeam": False}
    assessments = []
    for attack in ("basic", "magic_beam"):
        started = _start(client, student, "monster_adventure")
        body = _body(started["firstItem"], 1, attack=attack)
        if wrong_word:
            body["transcript"] = "바나나"
        result = client.post(f"/api/activities/{started['sessionId']}/utterances",
                             headers=_lease(student, started), json=body)
        assert result.status_code == 200, result.text
        if wrong_word:
            assert "TARGET_RETRY" in {event["type"] for event in result.json()["events"]}
            assert result.json()["currentRound"]["index"] == 1
        with sessions() as db:
            analysis = db.scalar(select(SpeechAnalysis).join(Utterance).where(Utterance.session_id == started["sessionId"]))
            assessments.append((analysis.ai_score, analysis.ai_result, analysis.target_status, analysis.pattern_tags))
    assert assessments[0] == assessments[1]
    _grant(client, therapist, _child(sessions), "revoke")
    # 승인 상태로 시작한 라운드는 철회 뒤에도 그 라운드가 끝날 때까지 매직빔을 쓸 수 있다.
    current = client.get(f"/api/activities/{started['sessionId']}", headers=student).json()
    assert current["magicBeamAvailable"] is True
    current_index = current["currentRound"]["index"]
    kept = client.post(f"/api/activities/{started['sessionId']}/utterances",
                       headers=_lease(student, started),
                       json=_body(current["firstItem"], current_index, current["nextAttemptIndex"], attack="magic_beam"))
    assert kept.status_code == 200, kept.text
    assert "ROUND_CLEAR" in {event["type"] for event in kept.json()["events"]}
    assert kept.json()["magicBeamAvailable"] is False
    # 다음 라운드부터 철회가 적용되고 기본 공격으로 계속 진행한다.
    next_item, next_index = kept.json()["nextItem"], kept.json()["currentRound"]["index"]
    rejected = client.post(f"/api/activities/{started['sessionId']}/utterances",
                           headers=_lease(student, started), json=_body(next_item, next_index, attack="magic_beam"))
    assert rejected.status_code == 403
    basic = client.post(f"/api/activities/{started['sessionId']}/utterances",
                        headers=_lease(student, started), json=_body(next_item, next_index))
    assert basic.status_code == 200, basic.text
    assert "ROUND_CLEAR" in {event["type"] for event in basic.json()["events"]}
    other_child = _actor(client, student_auth, "HERO02")
    assert client.get("/api/me/skills", headers=other_child).json() == {"magicBeam": False}


def test_grant_during_round_is_kept_until_that_round_ends(api):
    client, sessions = api
    student = _actor(client, student_auth)
    therapist = _actor(client, auth)
    child_id = _child(sessions)
    started = _start(client, student, "monster_adventure")
    assert started["magicBeamAvailable"] is False
    item = started["firstItem"]
    miss = _body(item, 1)
    miss["transcript"] = "바나나"
    retry = client.post(f"/api/activities/{started['sessionId']}/utterances", headers=_lease(student, started), json=miss)
    assert retry.status_code == 200 and retry.json()["magicBeamAvailable"] is False
    # 라운드 도중 승인은 바로 쓸 수 있고, 아이가 본 뒤 철회돼도 그 라운드는 유지한다.
    _grant(client, therapist, child_id)
    seen = client.get(f"/api/activities/{started['sessionId']}", headers=student).json()
    assert seen["magicBeamAvailable"] is True
    miss = _body(item, 1, 2)
    miss["transcript"] = "바나나"
    latched = client.post(f"/api/activities/{started['sessionId']}/utterances", headers=_lease(student, started), json=miss)
    assert latched.status_code == 200 and latched.json()["magicBeamAvailable"] is True
    _grant(client, therapist, child_id, "revoke")
    used = client.post(f"/api/activities/{started['sessionId']}/utterances",
                       headers=_lease(student, started), json=_body(item, 1, 3, attack="magic_beam"))
    assert used.status_code == 200, used.text
    assert used.json()["currentRound"]["index"] == 2
    assert used.json()["magicBeamAvailable"] is False
    with sessions() as db:
        assert db.get(TrainingSession, started["sessionId"]).runtime_state["magicBeamRound"] is False


def test_claim_requires_explicit_takeover_and_invalidates_the_previous_device(api):
    client, sessions = api
    first_device = _actor(client, student_auth)
    started = _start(client, first_device)
    second_device = _actor(client, student_auth)
    url = f"/api/activities/{started['sessionId']}"
    assert client.post(f"{url}/claim", headers=second_device, json={"takeover": False}).status_code == 409
    claimed = client.post(f"{url}/claim", headers=second_device, json={"takeover": True})
    assert claimed.status_code == 200, claimed.text
    taken = claimed.json()
    assert taken["leaseToken"] != started["leaseToken"]
    assert taken["firstItem"] == started["firstItem"] and taken["currentRound"]["index"] == 1
    old = _lease(first_device, started)
    assert client.post(f"{url}/heartbeat", headers=old).status_code == 409
    assert client.post(f"{url}/pause", headers=old).status_code == 409
    assert client.post(f"{url}/utterances", headers=old, json=_body(started["firstItem"], 1)).status_code == 409
    assert client.post(f"{url}/utterances", headers=second_device, json=_body(started["firstItem"], 1)).status_code == 409
    assert client.post(f"{url}/heartbeat", headers=_lease(second_device, taken)).json() == {"ok": True}
    _say(client, second_device, taken, taken["firstItem"], 1)
    with sessions() as db:
        lease = db.get(ActivityLease, started["sessionId"])
        assert lease.token_hash == hash_token(taken["leaseToken"])
        assert lease.token_hash != taken["leaseToken"]
        assert len(db.scalars(select(Utterance).where(Utterance.session_id == started["sessionId"])).all()) == 1


def test_activity_listing_claim_and_pause_cannot_cross_child_ownership(api):
    client, _ = api
    first = _actor(client, student_auth)
    started = _start(client, first)
    listed = client.get("/api/me/activities/active", headers=first)
    assert listed.status_code == 200
    assert started["sessionId"] in {activity["sessionId"] for activity in listed.json()["activities"]}
    other = _actor(client, student_auth, "HERO02")
    assert started["sessionId"] not in {activity["sessionId"] for activity in client.get("/api/me/activities/active", headers=other).json()["activities"]}
    url = f"/api/activities/{started['sessionId']}"
    assert client.post(f"{url}/claim", headers=other, json={"takeover": True}).status_code == 404
    assert client.post(f"{url}/pause", headers=_lease(other, started)).status_code == 404
    assert client.post(f"{url}/heartbeat", headers=_lease(other, started)).status_code == 404
    assert client.post(f"{url}/claim", headers={"Cookie": first["Cookie"]}, json={"takeover": True}).status_code == 403


def test_paused_duration_is_excluded_from_the_round_deadline(api):
    client, sessions = api
    student = _actor(client, student_auth)
    started = _start(client, student)
    url = f"/api/activities/{started['sessionId']}"
    assert client.post(f"{url}/pause", headers=_lease(student, started)).status_code == 200
    # 10초 연습 뒤 한 시간 쉬었다는 저장 스냅숏. 실제 sleep 없이 재개 시계를 검증한다.
    pause_time = now() - timedelta(hours=1)
    with sessions() as db:
        db.get(ActivityLease, started["sessionId"]).paused_at = pause_time
        session = db.get(TrainingSession, started["sessionId"])
        session.runtime_state = {**session.runtime_state, "roundStartedAt": (pause_time - timedelta(seconds=10)).isoformat()}
        db.commit()
    claimed = client.post(f"{url}/claim", headers=_lease(student, started), json={"takeover": False})
    assert claimed.status_code == 200, claimed.text
    resumed = claimed.json()
    body = _body(resumed["firstItem"], 1, acoustic={"durationMs": 1200, "activeMs": 0, "voicedMs": 0})
    body["transcript"] = None
    response = client.post(f"{url}/utterances", headers=_lease(student, resumed), json=body)
    assert response.status_code == 200, response.text
    assert response.json()["currentRound"]["index"] == 1
    assert "ROUND_CLEAR" not in {event["type"] for event in response.json()["events"]}
    with sessions() as db:
        state = db.get(TrainingSession, started["sessionId"]).runtime_state
        assert (now() - datetime.fromisoformat(state["roundStartedAt"])).total_seconds() < 20


@pytest.mark.parametrize("game,material", [("magic_beam", "rice"), ("monster_adventure", "tuna"),
                                           ("sky_climb", None), ("conversation_quest", None)])
def test_materials_are_awarded_once_only_at_selected_rounds_without_auto_grant(api, game, material):
    client, _ = api
    student = _actor(client, student_auth)
    started = _start(client, student, game)
    item = started["firstItem"]
    before = _inventory(client, student)
    expected = dict(before["inventory"])
    for round_index in range(1, 6):
        body = _body(item, round_index)
        result = _say(client, student, started, item, round_index)
        if material and round_index in (2, 4):
            expected[material] += 1
        assert _inventory(client, student)["inventory"] == expected
        duplicate = client.post(f"/api/activities/{started['sessionId']}/utterances",
                                headers=_lease(student, started), json=body)
        assert duplicate.status_code == 409
        assert _inventory(client, student)["inventory"] == expected
        item = result["nextItem"]
    assert result["sessionComplete"] is True
    assert client.get("/api/me/skills", headers=student).json() == {"magicBeam": False}


def test_craft_consumes_one_of_each_material_and_same_request_does_not_repeat(api):
    client, sessions = api
    student = _actor(client, student_auth)
    for game in ("magic_beam", "monster_adventure"):
        started = _start(client, student, game)
        item = started["firstItem"]
        for round_index in range(1, 6):
            item = _say(client, student, started, item, round_index)["nextItem"]
    assert _inventory(client, student)["inventory"] == {"rice": 2, "tuna": 2}
    body = {"requestId": str(uuid4()), "recipe": "tuna_sushi"}
    first = client.post("/api/me/adventure/craft", headers=student, json=body)
    assert first.status_code == 200, first.text
    assert first.json()["inventory"] == {"rice": 1, "tuna": 1}
    assert first.json()["crafted"] == {"tunaSushi": 1}
    again = client.post("/api/me/adventure/craft", headers=student, json=body)
    assert again.status_code == 200 and again.json() == first.json()
    assert _inventory(client, student) == first.json()
    # 요청 ID는 아동별이다. 다른 아동은 첫 아동의 저장 응답이나 재료를 받지 않는다.
    other_child = _actor(client, student_auth, "HERO02")
    assert _inventory(client, other_child)["inventory"] == {"rice": 0, "tuna": 0}
    assert client.post("/api/me/adventure/craft", headers=other_child, json=body).status_code == 409
    assert _inventory(client, student) == first.json()
    with sessions() as db:
        assert len(db.scalars(select(CraftEvent).where(CraftEvent.child_id == _child(sessions))).all()) == 1


def test_craft_shortage_and_csrf_failure_do_not_change_inventory(api):
    client, _ = api
    student = _actor(client, student_auth)
    before = _inventory(client, student)
    body = {"requestId": str(uuid4()), "recipe": "tuna_sushi"}
    assert client.post("/api/me/adventure/craft", headers=student, json=body).status_code == 409
    assert client.post("/api/me/adventure/craft", headers={"Cookie": student["Cookie"]}, json=body).status_code == 403
    assert _inventory(client, student) == before


@pytest.mark.parametrize("same_request", [False, True])
def test_concurrent_crafts_cannot_spend_the_same_materials_twice(api, same_request):
    client, sessions = api
    student = _actor(client, student_auth)
    child_id = _child(sessions)
    with sessions() as db:
        progress = db.get(EpisodeProgress, child_id)
        if progress is None:
            progress = EpisodeProgress(child_id=child_id)
            db.add(progress)
        progress.inventory_json = {"rice": 1, "tuna": 1}
        progress.crafted_json = {"tunaSushi": 0}
        db.commit()
    bodies = [{"requestId": str(uuid4()), "recipe": "tuna_sushi"} for _ in range(2)]
    if same_request:
        bodies[1] = dict(bodies[0])
    responses = _two_requests(client, "/api/me/adventure/craft", student, bodies)
    assert sorted(response.status_code for response in responses) == ([200, 200] if same_request else [200, 409])
    if same_request:
        assert responses[0].json() == responses[1].json()
    assert _inventory(client, student)["inventory"] == {"rice": 0, "tuna": 0}
    assert _inventory(client, student)["crafted"] == {"tunaSushi": 1}
    with sessions() as db:
        assert len(db.scalars(select(CraftEvent).where(CraftEvent.child_id == child_id)).all()) == 1


def test_concurrent_final_submissions_write_once_and_can_recover_completion(api):
    client, sessions = api
    student = _actor(client, student_auth)
    started = _start(client, student)
    item = started["firstItem"]
    for round_index in range(1, 5):
        item = _say(client, student, started, item, round_index)["nextItem"]
    url = f"/api/activities/{started['sessionId']}"
    final = _body(item, 5)
    responses = _two_requests(client, f"{url}/utterances", _lease(student, started), [final, final])
    assert sorted(response.status_code for response in responses) == [200, 409]
    assert next(response for response in responses if response.status_code == 200).json()["sessionComplete"] is True
    with sessions() as db:
        assert len(db.scalars(select(Utterance).where(Utterance.session_id == started["sessionId"])).all()) == 5
    # 완료 API 응답을 잃었을 때는 claim으로 완료 상태를 회수할 수 있다.
    claimed = client.post(f"{url}/claim", headers=_lease(student, started), json={"takeover": False})
    assert claimed.status_code == 200 and claimed.json()["sessionComplete"] is True
    assert client.post(f"{url}/utterances", headers=_lease(student, claimed.json()), json=final).status_code == 409
    completed = client.post(f"/api/play/sessions/{started['sessionId']}/complete",
                            headers=_lease(student, claimed.json()), json={"elapsedSec": 60})
    assert completed.status_code == 200, completed.text
    assert started["sessionId"] not in {activity["sessionId"] for activity in client.get("/api/me/activities/active", headers=student).json()["activities"]}


def _clear_five(client, headers, started):
    item = started["firstItem"]
    for round_index in range(1, 6):
        result = _say(client, headers, started, item, round_index)
        item = result["nextItem"]
    assert result["sessionComplete"] is True


def test_concurrent_leased_completion_awards_xp_and_metric_once(api):
    client, sessions = api
    student = _actor(client, student_auth)
    started = _start(client, student)
    _clear_five(client, student, started)
    with sessions() as db:
        session = db.get(TrainingSession, started["sessionId"])
        child_id = session.child_id
        before_xp = db.get(Child, child_id).xp
        earned_xp = session.runtime_state["xp"]
        assert earned_xp > 0
        assert not db.scalars(select(ProgressMetric).where(ProgressMetric.session_id == session.id)).all()
    responses = _two_requests(client, f"/api/play/sessions/{started['sessionId']}/complete",
                              _lease(student, started), [{"elapsedSec": 600}, {"elapsedSec": 600}])
    assert [response.status_code for response in responses] == [200, 200]
    assert responses[0].json() == responses[1].json()
    assert responses[0].json()["totalXp"] == earned_xp
    with sessions() as db:
        assert db.get(Child, child_id).xp == before_xp + earned_xp
        assert db.get(TrainingSession, started["sessionId"]).status == "completed"
        metrics = db.scalars(select(ProgressMetric).where(ProgressMetric.session_id == started["sessionId"])).all()
        assert len(metrics) == 1 and metrics[0].level == "all"
        assert metrics[0].attempts == 5


@pytest.mark.parametrize("gap_seconds", [3600, 10])
def test_reclaim_excludes_unconfirmed_heartbeat_gap_from_round_and_session_time(api, gap_seconds):
    client, sessions = api
    student = _actor(client, student_auth)
    started = _start(client, student)
    # 마지막으로 확인한 활동은 10초. 이후 연결이 끊긴 시간은 길이에 관계없이 활동 증거가 아니다.
    last_heartbeat = now() - timedelta(seconds=gap_seconds)
    with sessions() as db:
        lease = db.get(ActivityLease, started["sessionId"])
        lease.heartbeat_at = last_heartbeat
        lease.paused_at = None
        lease.active_elapsed_sec = 10.0
        session = db.get(TrainingSession, started["sessionId"])
        session.runtime_state = {**session.runtime_state,
                                 "roundStartedAt": (last_heartbeat - timedelta(seconds=10)).isoformat()}
        db.commit()
    claimed = client.post(f"/api/activities/{started['sessionId']}/claim",
                          headers=_lease(student, started), json={"takeover": False})
    assert claimed.status_code == 200, claimed.text
    resumed = claimed.json()
    assert resumed["currentRound"]["index"] == 1
    assert resumed["firstItem"] == started["firstItem"]
    with sessions() as db:
        session = db.get(TrainingSession, started["sessionId"])
        round_elapsed = (now() - datetime.fromisoformat(session.runtime_state["roundStartedAt"])).total_seconds()
        assert 8 <= round_elapsed < 15
        assert 10 <= db.get(ActivityLease, session.id).active_elapsed_sec < 15
    _clear_five(client, student, resumed)
    completed = client.post(f"/api/play/sessions/{started['sessionId']}/complete",
                            headers=_lease(student, resumed), json={"elapsedSec": 600})
    assert completed.status_code == 200, completed.text
    assert 10 <= completed.json()["durationSec"] < 20
    with sessions() as db:
        metric = db.scalar(select(ProgressMetric).where(ProgressMetric.session_id == started["sessionId"]))
        assert metric.duration_sec == completed.json()["durationSec"]


def test_create_all_adds_adventure_tables_without_replacing_existing_rows(tmp_path):
    engine = make_engine(f"sqlite:///{(tmp_path / 'existing.db').as_posix()}")
    existing = [Therapist.__table__, Child.__table__, TrainingGoal.__table__, TrainingPlan.__table__, TrainingSession.__table__]
    Base.metadata.create_all(engine, tables=existing)
    sessions = sessionmaker(bind=engine, expire_on_commit=False)
    try:
        with sessions() as db:
            therapist = Therapist(id="existing-therapist", username="existing", display_name="기존 치료사",
                                  password_salt="11" * 16, password_hash="existing-hash")
            child = Child(id="existing-child", therapist_id=therapist.id, child_code="KEEP01", play_code="KEEP01",
                          hero_name="기존 이름", collection_json={"badges": ["기존 배지"], "monsterCards": ["기존 카드"]})
            goal = TrainingGoal(id="existing-goal", child_id=child.id, version=7, target_phoneme="ㄹ", level="word")
            plan = TrainingPlan(id="existing-plan", child_id=child.id, goal_id=goal.id, plan_json={"oldPlan": True})
            session = TrainingSession(id="existing-session", child_id=child.id, goal_id=goal.id, plan_id=plan.id,
                                      mode="demo", play_token_hash="existing-token-hash", runtime_state={"oldState": True})
            db.add_all([therapist, child, goal, plan, session]); db.commit()
        Base.metadata.create_all(engine)
        Base.metadata.create_all(engine)
        assert set(Base.metadata.tables).issubset(inspect(engine).get_table_names())
        with sessions() as db:
            assert db.get(Child, "existing-child").collection_json == {"badges": ["기존 배지"], "monsterCards": ["기존 카드"]}
            assert db.get(Child, "existing-child").hero_name == "기존 이름"
            goal = db.get(TrainingGoal, "existing-goal")
            assert (goal.version, goal.target_phoneme, goal.level) == (7, "ㄹ", "word")
            assert db.get(TrainingPlan, "existing-plan").plan_json == {"oldPlan": True}
            assert db.get(TrainingSession, "existing-session").runtime_state == {"oldState": True}
    finally:
        engine.dispose()


def test_uncertain_twice_then_skips_neutrally_without_retry(api):
    """잡음 등으로 불확실이 이어지면 두 번 다시 듣고, 세 번째에는 실패 없이 넘어간다(V2 활동 경로)."""
    client, _ = api
    student = _actor(client, student_auth)
    started = _start(client, student, "magic_beam", mode="real")  # DEMO는 키보드 입력이라 음질 판정을 하지 않는다.
    item = started["firstItem"]
    poor = {**GOOD_ACOUSTIC, "snrDb": 50, "meanRmsDb": -56, "noiseFloorDb": -60, "source": "microphone"}
    kinds = []
    for _ in range(3):
        response = client.post(f"/api/activities/{started['sessionId']}/utterances", headers=_lease(student, started),
                               json=_body(item, 1, acoustic=poor))
        assert response.status_code == 200, response.text
        kinds.append([event["type"] for event in response.json()["events"]])
    assert "LISTEN_AGAIN" in kinds[0] and "LISTEN_AGAIN" in kinds[1]
    assert "ITEM_ADVANCE" in kinds[2] and "TARGET_RETRY" not in sum(kinds, [])
