"""승인된 데모 대본·서버 전환 경계·재시도·개인정보 분리를 검증한다."""
from dataclasses import replace
from datetime import timedelta

import pytest
from sqlalchemy import select

from app import main as api_module
from app.hoya import api as hoya_api
from app.hoya.api import dialogue_service
from app.hoya.policy import HoyaConversationPolicy
from app.hoya.providers.demo_provider import DemoProvider, OPENING
from app.hoya.service import HoyaDialogueService
from app.hoya.transitions import TRANSITION_TEXT, should_transition
from app.hoya.validator import validate_output
from app.models import Child, HoyaChatSession, HoyaChatTurn, now
from app.training.content import conversation_candidates
from test_api_flow import api, student_auth
from test_hoya_chat import GOOD_MIC, _start, _turn, context, no_network, rid
from test_hoya_chat_reliability import CountingProvider, _processing_row


@pytest.mark.parametrize("observed,other,seconds,expected", [
    (9, [], 120, False), (10, [], 119.999, False), (10, [], 120, True),
    (11, [], 120, True), (0, ["UNCERTAIN"] * 10, 299.999, False),
    (0, ["UNCERTAIN"], 300, True), (0, ["NO_SPEECH"] * 3, 0, False),
    (0, ["NO_SPEECH"] * 4, 0, True),
    (0, ["NO_SPEECH"] * 3 + ["UNCERTAIN", "NO_SPEECH"], 0, False),
    (0, ["TARGET_NOT_OBSERVED"] * 10, 120, False),
])
def test_transition_product_boundaries(observed, other, seconds, expected):
    assert should_transition(["TARGET_OBSERVED"] * observed + other, seconds) is expected


def _clock(api, monkeypatch, session_id, seconds):
    _, sessions = api
    with sessions() as db:
        started = db.get(HoyaChatSession, session_id).started_at
    monkeypatch.setattr(hoya_api, "now", lambda: started + timedelta(seconds=seconds))


def test_tenth_observed_turn_needs_two_minutes_and_only_adds_next_activity(api, monkeypatch):
    client, sessions = api
    headers = student_auth(client)
    started = _start(client, headers)
    session_id = started["sessionId"]
    _clock(api, monkeypatch, session_id, 119.999)
    first_request = rid()
    first = _turn(client, headers, session_id, 1, "사과", request_id=first_request).json()
    for index in range(2, 11):
        result = _turn(client, headers, session_id, index, "사과")
        assert result.status_code == 200 and result.json()["nextActivity"] is None
    _clock(api, monkeypatch, session_id, 120)
    request_id = rid()
    response = _turn(client, headers, session_id, 11, "학교", request_id=request_id)
    body = response.json()
    assert response.status_code == 200 and body["nextActivity"] == "daegu_crossing"
    assert body["text"] == TRANSITION_TEXT and body["sessionComplete"] is False
    assert set(body) == {"status", "turnIndex", "clientRequestId", "text", "nextTurnIndex", "sessionComplete", "nextActivity"}
    with sessions() as db:
        rows = db.scalars(select(HoyaChatTurn).where(HoyaChatTurn.session_id == session_id)).all()
        assert sum(row.speech_evidence == "TARGET_OBSERVED" for row in rows) == 10
        assert db.get(HoyaChatSession, session_id).summary_json["nextActivityFromTurnIndex"] == 11
    # 과거 요청은 시간이 지나고 전환이 시작되어도 처음 결과 그대로 돌려준다.
    _clock(api, monkeypatch, session_id, 600)
    assert _turn(client, headers, session_id, 1, "사과", request_id=first_request).json() == first
    assert _turn(client, headers, session_id, 11, "학교", request_id=request_id).json() == body
    following = _turn(client, headers, session_id, 12, "안녕").json()
    assert following["text"] == TRANSITION_TEXT and following["nextActivity"] == "daegu_crossing"
    assert set(client.get(f"/api/hoya/chat/sessions/{session_id}", headers=headers).json()) == set(started)
    client.post(f"/api/hoya/chat/sessions/{session_id}/complete", headers=headers)
    assert _turn(client, headers, session_id, 11, "학교", request_id=request_id).json() == body


def test_tenth_observed_turn_at_two_minutes_transitions(api, monkeypatch):
    client, _ = api
    headers = student_auth(client)
    session_id = _start(client, headers)["sessionId"]
    _clock(api, monkeypatch, session_id, 120)
    for index in range(1, 11):
        result = _turn(client, headers, session_id, index, "사과").json()
        assert result["nextActivity"] == ("daegu_crossing" if index == 10 else None)


def test_five_minutes_uses_server_time_even_without_target_attempts(api, monkeypatch):
    client, _ = api
    headers = student_auth(client)
    session_id = _start(client, headers)["sessionId"]
    _clock(api, monkeypatch, session_id, 299.999)
    assert _turn(client, headers, session_id, 1, "학교").json()["nextActivity"] is None
    _clock(api, monkeypatch, session_id, 300)
    response = _turn(client, headers, session_id, 2, "학교").json()
    assert response["nextActivity"] == "daegu_crossing" and response["text"] == TRANSITION_TEXT


def test_three_no_speech_turns_offer_picture_choice_then_fourth_transitions(api, monkeypatch):
    client, sessions = api
    headers = student_auth(client)
    session_id = _start(client, headers)["sessionId"]
    _clock(api, monkeypatch, session_id, 1)
    for index in range(1, 4):
        response = _turn(client, headers, session_id, index, None).json()
        assert response["nextActivity"] is None
    assert "그림을 보고 골라" in response["text"] and "사과" in response["text"]
    final = _turn(client, headers, session_id, 4, None).json()
    assert final["nextActivity"] == "daegu_crossing" and final["text"] == TRANSITION_TEXT
    with sessions() as db:
        turns = db.scalars(select(HoyaChatTurn).where(HoyaChatTurn.session_id == session_id).order_by(HoyaChatTurn.turn_index)).all()
        assert all(turn.speech_evidence == "NO_SPEECH" for turn in turns)
        assert turns[2].strategy == "SIMPLIFY"


def test_uncertain_interrupts_no_speech_streak(api, monkeypatch):
    client, sessions = api
    headers = student_auth(client)
    session_id = _start(client, headers, mode="real")["sessionId"]
    _clock(api, monkeypatch, session_id, 1)
    for index in range(1, 4):
        assert _turn(client, headers, session_id, index, None).json()["nextActivity"] is None
    # 실제 소리가 있으나 ASR 문장이 없는 경우는 UNCERTAIN이며 무발화 연속 횟수를 끊는다.
    assert _turn(client, headers, session_id, 4, None, acoustic=GOOD_MIC).json()["nextActivity"] is None
    assert _turn(client, headers, session_id, 5, None).json()["nextActivity"] is None
    with sessions() as db:
        row = db.scalar(select(HoyaChatTurn).where(HoyaChatTurn.session_id == session_id, HoyaChatTurn.turn_index == 4))
        assert row.speech_evidence == "UNCERTAIN"


def test_stale_recovery_saves_transition_without_external_provider(api, monkeypatch):
    client, sessions = api
    provider = CountingProvider()
    api_module.app.dependency_overrides[dialogue_service] = lambda: HoyaDialogueService(provider)
    headers = student_auth(client)
    session_id = _start(client, headers)["sessionId"]
    request_id = rid()
    _processing_row(sessions, session_id, request_id, age=timedelta(minutes=5))
    _clock(api, monkeypatch, session_id, 300)
    response = _turn(client, headers, session_id, 1, "학교 갔어", request_id=request_id)
    assert response.status_code == 200 and response.json()["nextActivity"] == "daegu_crossing"
    assert response.json()["text"] == TRANSITION_TEXT and provider.calls == 0
    assert _turn(client, headers, session_id, 1, "학교 갔어", request_id=request_id).json() == response.json()


def test_nickname_greeting_does_not_enter_provider_context(api):
    client, sessions = api
    headers = student_auth(client)
    with sessions() as db:
        db.scalar(select(Child).where(Child.play_code == "HERO01")).hero_name = "두두친구"
        db.commit()
    seen = []

    class CaptureProvider(CountingProvider):
        async def reply(self, item):
            seen.append(item)
            return await super().reply(item)

    api_module.app.dependency_overrides[dialogue_service] = lambda: HoyaDialogueService(CaptureProvider())
    started = _start(client, headers)
    assert started["openingText"] == "안녕~ 만나서 반가워! 두두친구야. 나는 두두야."
    _turn(client, headers, started["sessionId"], 1, "안녕")
    assert seen[0].recent_turns == [{"speaker": "hoya", "text": OPENING}]
    assert "두두친구" not in repr(seen[0])


def test_word_script_has_choice_cloze_model_and_recast_without_correction():
    base = replace(context(), allowed_cue="auditory_model")
    replies = [DemoProvider().reply_sync(replace(base, turn_index=index)) for index in range(1, 5)]
    assert "사과가 좋아, 수박이 좋아?" in replies[0].text
    assert "빨갛고 동그란 과일은 사…?" in replies[1].text
    assert "두두는 사과를 좋아해. 너도 말해 볼래?" in replies[2].text
    recast = DemoProvider().reply_sync(replace(base, evidence="TARGET_OBSERVED", strategy="CONTINUE_OR_EXPAND", child_transcript="사과 먹어"))
    assert recast.text.startswith("맞아, 사과!")
    for reply in [*replies, recast]:
        validate_output(reply, reply.strategy, base.target_lexicon)
        assert "정확" not in reply.text and "틀렸" not in reply.text


def test_syllable_model_is_more_frequent_and_respects_allowed_cue():
    base = replace(context(), level="syllable", allowed_cue="auditory_model")
    replies = [DemoProvider().reply_sync(replace(base, turn_index=index)) for index in range(1, 5)]
    assert sum("너도 말해 볼래?" in reply.text for reply in replies) == 2
    for index in range(1, 5):
        reply = DemoProvider().reply_sync(replace(base, turn_index=index, allowed_cue=None))
        assert "너도 말해 볼래?" not in reply.text


@pytest.mark.parametrize("lexicon", [[], ["수박"], ["소리", "시소"], conversation_candidates("ㅅ", "medial")])
def test_scripts_keep_exclusions_and_validate_all_turns(lexicon):
    for index in range(1, 31):
        for level in ("syllable", "word"):
            item = replace(context(lexicon=lexicon, turn=index), level=level, allowed_cue="auditory_model")
            reply = DemoProvider().reply_sync(item)
            validate_output(reply, item.strategy, lexicon)
            assert set(reply.target_words) <= set(lexicon)


@pytest.mark.parametrize("phoneme", ["ㅈ", "ㄹ", "ㅋ"])
def test_other_goal_uses_existing_safe_fallback(phoneme):
    item = context(phoneme=phoneme)
    reply = DemoProvider().reply_sync(item)
    validate_output(reply, item.strategy, item.target_lexicon)
    assert "사과" not in reply.text and "수박" not in reply.text


def test_no_speech_policy_is_not_a_failure_or_unallowed_cue():
    policy = HoyaConversationPolicy()
    assert policy.decide("NO_SPEECH", ["NO_SPEECH"] * 2, None) == "SIMPLIFY"
    assert policy.decide("NO_SPEECH", ["NO_SPEECH"] * 2 + ["UNCERTAIN"], None) == "WAIT_OR_SIMPLIFY"
