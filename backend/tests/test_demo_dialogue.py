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
from app.models import Child, HoyaChatSession, HoyaChatTurn, TrainingGoal, now
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
        # 전환 문구에서 실제로 제시하지 않은 목표 낱말은 내부 제공자 메타데이터에도 남기지 않는다.
        assert next(row for row in rows if row.turn_index == 11).target_words == []
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
    assert started["openingText"] == "안녕~ 만나서 반가워! 두두친구야. 나는 두두야. 오늘 뭐 하고 놀았어?"
    _turn(client, headers, started["sessionId"], 1, "안녕")
    assert seen[0].recent_turns == [{"speaker": "hoya", "text": OPENING}]
    assert "두두친구" not in repr(seen[0])


def _said(*items):
    """최근 대화(오래된 것부터). (말한 사람, 문장)"""
    return [{"speaker": speaker, "text": text} for speaker, text in items]


def _help_kind(text):
    """두두가 어떻게 도왔는지(고르기·빈칸·먼저 들려주기). 자연스러운 질문이면 None."""
    if "좋아, " in text and text.endswith("좋아?"):
        return "choice"
    if text.endswith("…?"):
        return "cloze"
    if text.endswith("너도 말해 볼래?"):
        return "model"
    return None


def test_word_script_starts_naturally_and_helps_after_two_misses():
    base = replace(context(), allowed_cue="auditory_model")
    first = DemoProvider().reply_sync(base)
    assert first.text == "학교 다녀왔구나! 오늘 선생님이랑 어떤 수업 했어?" and first.target_words == []
    # 이번 말("몰라")과 바로 앞 말("학교 갔어")에 목표 음소가 없으면, 4턴째부터 같은 낱말로 단서를 늘려 돕는다.
    history = _said(("child", "학교 갔어"), ("hoya", "그랬구나! 제일 좋아하는 과일은 뭐야?"))
    replies = []
    for turn, expected in [(4, "그랬구나! 사과가 좋아, 수박이 좋아?"), (5, "그랬구나! 빨갛고 동그란 과일은 사…?"),
                           (6, "그랬구나! 두두는 사과를 좋아해. 너도 말해 볼래?")]:
        reply = DemoProvider().reply_sync(replace(base, child_transcript="몰라", turn_index=turn, recent_turns=history))
        assert reply.text == expected and reply.target_words[0] == "사과"
        history = [*history, *_said(("child", "몰라"), ("hoya", reply.text))]
        replies.append(reply)
    # 허용 단서가 없으면 먼저 들려주기 없이 고르기·빈칸만 쓴다.
    no_cue = DemoProvider().reply_sync(replace(base, allowed_cue=None, child_transcript="몰라", turn_index=6, recent_turns=history[:-2]))
    assert _help_kind(no_cue.text) == "choice"
    recast = DemoProvider().reply_sync(replace(base, evidence="TARGET_OBSERVED", strategy="CONTINUE_OR_EXPAND", child_transcript="사과 먹어"))
    assert recast.text == "맞아, 사과! 제일 좋아하는 과일은 뭐야?" and recast.target_words == ["사과"]
    for reply in [first, *replies, no_cue, recast]:
        validate_output(reply, reply.strategy, base.target_lexicon)
        assert "정확" not in reply.text and "틀렸" not in reply.text


def test_allowed_cue_models_once_in_first_three_turns():
    base = replace(context(strategy="ALLOWED_CUE", transcript="그네 탔어", turn=2), level="syllable", allowed_cue="auditory_model",
                   recent_turns=_said(("child", "놀았어"), ("hoya", "그랬구나! 좋아하는 놀이가 뭐야?")))
    model = DemoProvider().reply_sync(base)
    assert model.text == "놀이터에서 놀았구나! 두두는 시소를 좋아해. 너도 말해 볼래?" and model.target_words == ["시소"]
    # 바로 앞에서 이미 들려줬으면 첫 3턴 안에서는 다시 돕지 않고 자연스럽게 묻는다.
    after = DemoProvider().reply_sync(replace(base, child_transcript="몰라", turn_index=3,
                                              recent_turns=[*base.recent_turns, *_said(("child", "그네 탔어"), ("hoya", model.text))]))
    assert after.text == "그랬구나! 제일 좋아하는 과일은 뭐야?" and _help_kind(after.text) is None
    # 서버가 허용 단서를 주지 않으면(대화 전략이 ALLOWED_CUE가 아니고 목표 단서도 없으면) 먼저 들려주지 않는다.
    for turn in range(1, 25):
        for recent in ([], base.recent_turns):
            reply = DemoProvider().reply_sync(replace(base, strategy="NATURAL_REELICITATION", allowed_cue=None,
                                                      child_transcript="몰라", turn_index=turn, recent_turns=recent))
            assert "너도 말해 볼래?" not in reply.text


def test_recent_questions_and_topic_reactions_are_not_repeated():
    # 같은 주제(놀이터)를 계속 말해도 최근 3번 안의 질문과 바로 앞 주제 반응은 되풀이하지 않는다. '…에서'의 /ㅅ/로 목표 관찰이라 돕지 않는다.
    provider, recent, texts = DemoProvider(), _said(("hoya", OPENING)), []
    for turn, said in enumerate(["놀이터에서 놀았어", "그네에서 놀았어", "미끄럼틀에서", "놀이터에서", "그네에서", "미끄럼에서"], 1):
        reply = provider.reply_sync(replace(context(strategy="CONTINUE_OR_EXPAND", evidence="TARGET_OBSERVED", transcript=said, turn=turn),
                                            recent_turns=recent[-10:]))
        texts.append(reply.text)
        recent = [*recent, *_said(("child", said), ("hoya", reply.text))]
    assert texts[0] == "놀이터에서 놀았구나! 시소도 탔어?"
    questions = [text.split("! ")[-1] for text in texts]
    assert all(questions[i] not in questions[max(0, i - 3):i] for i in range(len(questions)))
    acks = [text.split("! ")[0] for text in texts]
    assert all(a != b or a == "그랬구나" for a, b in zip(acks, acks[1:]))


@pytest.mark.parametrize("cue", [None, "auditory_model"])
@pytest.mark.parametrize("lines", [["놀았어", "그네 탔어", "몰라"], ["놀이터에서 놀았어", "응 시소 탔어", "숨바꼭질 했어"],
                                   ["학교 갔어", "몰라", "아니"]])
def test_first_three_turns_have_no_choice_or_cloze_while_child_talks(api, cue, lines):
    client, sessions = api
    headers = student_auth(client)
    if cue:
        with sessions() as db:
            goal = db.scalar(select(TrainingGoal).join(Child, Child.id == TrainingGoal.child_id).where(Child.play_code == "HERO01"))
            goal.preferred_cue, goal.level = cue, "syllable"
            db.commit()
    started = _start(client, headers)
    assert started["openingText"].endswith("나는 두두야. 오늘 뭐 하고 놀았어?")
    texts = [_turn(client, headers, started["sessionId"], index, said).json()["text"] for index, said in enumerate(lines, 1)]
    assert [_help_kind(text) for text in texts if _help_kind(text) in {"choice", "cloze"}] == []
    # 목표 음소가 두 번 연달아 나오지 않으면 4턴째에 돕는다.
    fourth = _turn(client, headers, started["sessionId"], 4, "몰라").json()["text"]
    assert (_help_kind(fourth) is not None) == (lines[-1] in {"몰라", "아니"})


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


@pytest.mark.parametrize("mode,claimed_source,expected", [
    ("real", "keyboard", "UNCERTAIN"),
    ("demo", "microphone", "TARGET_OBSERVED"),
])
def test_chat_evidence_uses_server_mode_not_client_claimed_source(api, mode, claimed_source, expected):
    client, sessions = api
    headers = student_auth(client)
    session_id = _start(client, headers, mode=mode)["sessionId"]
    response = _turn(client, headers, session_id, 1, "사과", acoustic={
        **GOOD_MIC, "source": claimed_source, "meanRmsDb": -70,
    })
    assert response.status_code == 200 and response.json()["nextActivity"] is None
    with sessions() as db:
        row = db.scalar(select(HoyaChatTurn).where(HoyaChatTurn.session_id == session_id))
        assert row.speech_evidence == expected


def test_late_provider_response_cannot_overwrite_stale_transition(api, monkeypatch):
    import asyncio
    from test_hoya_chat_reliability import _async_client, _async_login

    client, sessions = api
    session_id = _start(client, student_auth(client))["sessionId"]
    with sessions() as db:
        started = db.get(HoyaChatSession, session_id).started_at
    clock = [started]
    monkeypatch.setattr(hoya_api, "now", lambda: clock[0])

    async def scenario():
        provider = CountingProvider(gate=asyncio.Event())
        api_module.app.dependency_overrides[dialogue_service] = lambda: HoyaDialogueService(provider)
        async with _async_client() as http:
            headers = await _async_login(http)
            body = {"turnIndex": 1, "transcript": "학교", "clientRequestId": rid()}
            url = f"/api/hoya/chat/sessions/{session_id}/turns"
            original = asyncio.create_task(http.post(url, headers=headers, json=body))
            await asyncio.wait_for(provider.started.wait(), 5)
            clock[0] = started + timedelta(seconds=300)
            recovered = await http.post(url, headers=headers, json=body)
            assert recovered.status_code == 200 and recovered.json()["nextActivity"] == "daegu_crossing"
            assert recovered.json()["text"] == TRANSITION_TEXT
            provider.gate.set()
            late = await original
            assert late.status_code == 200 and late.json() == recovered.json()
            assert provider.calls == 1

    asyncio.run(scenario())
    with sessions() as db:
        turn = db.scalar(select(HoyaChatTurn).where(HoyaChatTurn.session_id == session_id))
        assert turn.provider == "DEMO_FALLBACK" and turn.fallback_reason == "STALE_PROCESSING"
        assert db.get(HoyaChatSession, session_id).summary_json["nextActivityFromTurnIndex"] == 1


def test_opening_calls_hero_name_with_vocative_particle():
    # 부르는 말은 받침에 따라 아/야(두두 음성 파일이 있는 DEMO 별명은 받침이 없다). 인사 뒤에 "오늘 뭐 하고 놀았어?"로 대화를 연다.
    from app.hoya.providers.demo_provider import opening_text
    assert opening_text("두두친구") == "안녕~ 만나서 반가워! 두두친구야. 나는 두두야. 오늘 뭐 하고 놀았어?"
    assert opening_text("튼튼곰") == "안녕~ 만나서 반가워! 튼튼곰아. 나는 두두야. 오늘 뭐 하고 놀았어?"
