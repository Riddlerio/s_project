"""호야 대화 turn의 멱등성·동시성·응답 유실 복구·마지막 turn 서버 종료·개발 DB 구조 이전 테스트."""

import asyncio
from datetime import timedelta

import httpx
from sqlalchemy import func, select

from app import main as api_module
from app.hoya import api as hoya_api
from app.hoya.api import dialogue_service
from app.hoya.providers.base import ProviderError
from app.hoya.schemas import ProviderOutput
from app.hoya.service import HoyaDialogueService
from app.models import HoyaChatSession, HoyaChatTurn, now
from test_api_flow import api, student_auth
from test_hoya_chat import _start, _turn, no_network, rid


class CountingProvider:
    """호출 횟수를 세는 가짜 제공자. gate가 있으면 풀릴 때까지 응답하지 않는다."""
    name, model = "OPENAI", "fake-model"

    def __init__(self, gate=None, fail=False):
        self.calls = 0
        self.gate = gate
        self.fail = fail
        self.started = asyncio.Event()

    async def reply(self, item):
        self.calls += 1
        self.started.set()
        if self.gate is not None:
            await self.gate.wait()
        if self.fail:  # OpenAIProvider가 시간 초과를 알리는 방식과 같다.
            raise ProviderError("TIMEOUT")
        return ProviderOutput(text=f"호야 응답 {item.turn_index}", strategy=item.strategy)


def _use(provider):
    api_module.app.dependency_overrides[dialogue_service] = lambda: HoyaDialogueService(provider)


def _turn_count(sessions):
    with sessions() as db:
        return db.scalar(select(func.count()).select_from(HoyaChatTurn))


def _processing_row(sessions, session_id, request_id, transcript="학교 갔어", age=timedelta(0)):
    with sessions() as db:
        db.add(HoyaChatTurn(session_id=session_id, turn_index=1, client_request_id=request_id, status="PROCESSING",
                            child_transcript=transcript, recognizer="demo_script", speech_evidence="TARGET_NOT_OBSERVED",
                            strategy="NATURAL_REELICITATION", target_words=[],
                            created_at=now() - age, updated_at=now() - age))
        db.commit()


# ---------------------------------------------------------------- 응답 유실 복구

def test_response_loss_retry_returns_saved_turn_without_provider_call(api):
    client, sessions = api
    provider = CountingProvider()
    _use(provider)
    headers = student_auth(client)
    chat = _start(client, headers)
    request_id = rid()
    first = _turn(client, headers, chat["sessionId"], 1, "학교 갔어", request_id=request_id)
    assert first.status_code == 200 and provider.calls == 1
    # 서버는 저장했지만 브라우저가 응답을 못 받았다고 보고, 같은 발화(같은 요청 ID)를 다시 보낸다.
    again = _turn(client, headers, chat["sessionId"], 1, "학교 갔어", request_id=request_id)
    assert again.status_code == 200 and again.json() == first.json()
    assert provider.calls == 1 and _turn_count(sessions) == 1
    # 다음 발화는 새 요청 ID와 다음 번호로 정상 진행한다.
    second = _turn(client, headers, chat["sessionId"], first.json()["nextTurnIndex"], "수박 먹었어")
    assert second.status_code == 200 and second.json()["turnIndex"] == 2 and provider.calls == 2


def test_request_id_cannot_be_reused_for_another_utterance(api):
    client, _ = api
    headers = student_auth(client)
    chat = _start(client, headers)
    request_id = rid()
    assert _turn(client, headers, chat["sessionId"], 1, "학교 갔어", request_id=request_id).status_code == 200
    assert _turn(client, headers, chat["sessionId"], 1, "다른 말", request_id=request_id).status_code == 409
    assert _turn(client, headers, chat["sessionId"], 2, "학교 갔어", request_id=request_id).status_code == 409


def test_completed_turn_retry_after_manual_end_returns_saved_result(api):
    client, _ = api
    headers = student_auth(client)
    chat = _start(client, headers)
    request_id = rid()
    first = _turn(client, headers, chat["sessionId"], 1, "학교 갔어", request_id=request_id)
    client.post(f"/api/hoya/chat/sessions/{chat['sessionId']}/complete", headers=headers)
    assert _turn(client, headers, chat["sessionId"], 1, "학교 갔어", request_id=request_id).json() == first.json()
    assert _turn(client, headers, chat["sessionId"], 2, "또").status_code == 409


def test_provider_failure_is_a_completed_turn_not_a_network_error(api):
    client, sessions = api
    _use(CountingProvider(fail=True))
    headers = student_auth(client)
    chat = _start(client, headers)
    response = _turn(client, headers, chat["sessionId"], 1, "학교 갔어")
    # OpenAI 실패는 서버에서 DEMO로 대체한 정상 turn(200)이다. 같은 turn을 다시 보낼 필요가 없다.
    assert response.status_code == 200 and response.json()["status"] == "COMPLETED"
    assert response.json()["nextTurnIndex"] == 2
    with sessions() as db:
        turn = db.scalar(select(HoyaChatTurn))
        assert turn.status == "COMPLETED" and turn.provider == "DEMO_FALLBACK" and turn.fallback_reason == "TIMEOUT"


# ---------------------------------------------------------------- 동시 중복 요청

def _async_client():
    return httpx.AsyncClient(transport=httpx.ASGITransport(app=api_module.app), base_url="http://testserver")


async def _async_login(client):
    response = await client.post("/api/auth/login", json={"username": "HERO01", "password": "speechhero"})
    assert response.status_code == 200
    return {"X-CSRF-Token": response.json()["csrfToken"]}


def test_processing_duplicate_does_not_call_provider_again(api):
    client, sessions = api
    chat = _start(client, student_auth(client))

    async def scenario():
        provider = CountingProvider(gate=asyncio.Event())
        _use(provider)
        async with _async_client() as http:
            headers = await _async_login(http)
            body = {"turnIndex": 1, "transcript": "학교 갔어", "clientRequestId": rid()}
            url = f"/api/hoya/chat/sessions/{chat['sessionId']}/turns"
            original = asyncio.create_task(http.post(url, headers=headers, json=body))
            await asyncio.wait_for(provider.started.wait(), 5)
            # 원래 요청이 제공자를 기다리는 동안 같은 요청이 다시 온다.
            duplicate = await http.post(url, headers=headers, json=body)
            assert duplicate.status_code == 202 and duplicate.json()["status"] == "PROCESSING"
            assert provider.calls == 1
            provider.gate.set()
            finished = await original
            assert finished.status_code == 200
            recovered = await http.post(url, headers=headers, json=body)
            assert recovered.status_code == 200 and recovered.json() == finished.json()
            return provider.calls

    assert asyncio.run(scenario()) == 1
    assert _turn_count(sessions) == 1


def test_concurrent_duplicate_requests_call_provider_once(api):
    client, sessions = api
    chat = _start(client, student_auth(client))

    async def scenario():
        provider = CountingProvider(gate=asyncio.Event())
        _use(provider)
        async with _async_client() as http:
            headers = await _async_login(http)
            body = {"turnIndex": 1, "transcript": "수박 먹었어", "clientRequestId": rid()}
            url = f"/api/hoya/chat/sessions/{chat['sessionId']}/turns"
            requests = [asyncio.create_task(http.post(url, headers=headers, json=body)) for _ in range(5)]
            await asyncio.wait_for(provider.started.wait(), 5)
            await asyncio.sleep(0.05)
            provider.gate.set()
            results = await asyncio.gather(*requests)
            assert all(result.status_code in {200, 202} for result in results), [result.status_code for result in results]
            # 202를 받은 쪽도 같은 요청으로 다시 물으면 같은 결과를 받는다.
            recovered = await http.post(url, headers=headers, json=body)
            assert recovered.status_code == 200
            assert all(result.json() == recovered.json() for result in results if result.status_code == 200)
            return provider.calls

    assert asyncio.run(scenario()) == 1
    assert _turn_count(sessions) == 1


def test_reservation_race_is_resolved_by_unique_constraint(api, monkeypatch):
    """조회와 예약 사이에 다른 요청(다른 worker)이 먼저 예약한 경우: unique 제약이 막고 제공자는 불리지 않는다."""
    client, sessions = api
    provider = CountingProvider()
    _use(provider)
    headers = student_auth(client)
    chat = _start(client, headers)
    request_id = rid()
    _processing_row(sessions, chat["sessionId"], request_id, transcript="안녕")
    # 이 요청의 조회 시점에는 다른 요청의 예약이 아직 보이지 않았던 것처럼 만든다.
    real_request, real_turns = hoya_api._by_request, hoya_api._turns
    seen = {"request": 0, "turns": 0}

    def first_miss(db, session, value):
        seen["request"] += 1
        return None if seen["request"] == 1 else real_request(db, session, value)

    def first_empty(db, session_id):
        seen["turns"] += 1
        return [] if seen["turns"] == 1 else real_turns(db, session_id)

    monkeypatch.setattr(hoya_api, "_by_request", first_miss)
    monkeypatch.setattr(hoya_api, "_turns", first_empty)
    response = _turn(client, headers, chat["sessionId"], 1, "안녕", request_id=request_id)
    assert response.status_code == 202 and provider.calls == 0 and _turn_count(sessions) == 1
    monkeypatch.setattr(hoya_api, "_by_request", real_request)
    monkeypatch.setattr(hoya_api, "_turns", real_turns)
    # 다른 요청 ID로 같은 turn을 가로채려 해도 500이 아니라 409다.
    assert _turn(client, headers, chat["sessionId"], 1, "안녕").status_code == 409


# ---------------------------------------------------------------- 멈춘 예약

def test_stale_processing_is_finished_with_demo_without_provider(api):
    client, sessions = api
    provider = CountingProvider()
    _use(provider)
    headers = student_auth(client)
    chat = _start(client, headers)
    request_id = rid()
    _processing_row(sessions, chat["sessionId"], request_id, age=timedelta(minutes=5))
    # 서버가 멈춰 PROCESSING이 남은 경우: 같은 요청 재시도가 제공자 없이 DEMO로 마무리한다.
    response = _turn(client, headers, chat["sessionId"], 1, "학교 갔어", request_id=request_id)
    assert response.status_code == 200 and response.json()["text"].startswith("학교 다녀왔구나")
    assert provider.calls == 0
    with sessions() as db:
        turn = db.scalar(select(HoyaChatTurn))
        assert (turn.status, turn.provider, turn.fallback_reason) == ("COMPLETED", "DEMO_FALLBACK", "STALE_PROCESSING")
    assert _turn(client, headers, chat["sessionId"], 2, "다음 말").status_code == 200


def test_stale_processing_does_not_block_new_utterance(api):
    """멈춘 예약을 보낸 브라우저가 사라져도, 새 발화가 들어오면 이전 turn을 DEMO로 마무리하고 대화를 잇는다."""
    client, sessions = api
    provider = CountingProvider()
    _use(provider)
    headers = student_auth(client)
    chat = _start(client, headers)
    _processing_row(sessions, chat["sessionId"], rid(), age=timedelta(minutes=5))
    response = _turn(client, headers, chat["sessionId"], 2, "수박 먹었어")
    assert response.status_code == 200 and response.json()["turnIndex"] == 2
    assert provider.calls == 1  # 새 발화에 대해서만 제공자를 부른다.
    with sessions() as db:
        rows = db.scalars(select(HoyaChatTurn).order_by(HoyaChatTurn.turn_index)).all()
        assert [(row.status, row.fallback_reason) for row in rows] == [("COMPLETED", "STALE_PROCESSING"), ("COMPLETED", None)]


def test_fresh_processing_blocks_new_utterance_without_provider_call(api):
    client, sessions = api
    provider = CountingProvider()
    _use(provider)
    headers = student_auth(client)
    chat = _start(client, headers)
    _processing_row(sessions, chat["sessionId"], rid())
    assert _turn(client, headers, chat["sessionId"], 2, "다음 말").status_code == 409
    assert provider.calls == 0


def test_fresh_processing_is_not_treated_as_stale(api):
    client, sessions = api
    headers = student_auth(client)
    chat = _start(client, headers)
    request_id = rid()
    _processing_row(sessions, chat["sessionId"], request_id, transcript="학교")
    assert _turn(client, headers, chat["sessionId"], 1, "학교", request_id=request_id).status_code == 202


# ---------------------------------------------------------------- 마지막 turn

def test_final_turn_response_loss_retry(api, monkeypatch):
    client, sessions = api
    monkeypatch.setattr(api_module.settings, "hoya_chat_max_turns", 2)
    provider = CountingProvider()
    _use(provider)
    headers = student_auth(client)
    chat = _start(client, headers)
    _turn(client, headers, chat["sessionId"], 1, "안녕")
    request_id = rid()
    final = _turn(client, headers, chat["sessionId"], 2, "수박", request_id=request_id)
    calls = provider.calls
    retry = _turn(client, headers, chat["sessionId"], 2, "수박", request_id=request_id)
    assert retry.status_code == 200 and retry.json() == final.json() and retry.json()["sessionComplete"] is True
    assert provider.calls == calls and _turn_count(sessions) == 2
    with sessions() as db:
        assert db.get(HoyaChatSession, chat["sessionId"]).status == "completed"


# ---------------------------------------------------------------- 개발 DB 구조 이전

def test_legacy_dev_table_is_upgraded_without_losing_rows(tmp_path):
    from sqlalchemy import inspect, text
    from app.db import Base, make_engine
    from app.hoya.schema_compat import upgrade_hoya_chat_schema
    engine = make_engine(f"sqlite:///{(tmp_path / 'legacy.db').as_posix()}")
    Base.metadata.create_all(engine, tables=[table for name, table in Base.metadata.tables.items() if name != "hoya_chat_turns"])
    with engine.begin() as connection:
        # PR #4 초기 버전의 표 구조
        connection.exec_driver_sql(
            "CREATE TABLE hoya_chat_turns (id VARCHAR(36) PRIMARY KEY, session_id VARCHAR(36) REFERENCES hoya_chat_sessions(id), "
            "turn_index INTEGER, child_transcript VARCHAR, hoya_text VARCHAR, recognizer VARCHAR NOT NULL, "
            "speech_evidence VARCHAR NOT NULL, strategy VARCHAR NOT NULL, target_words JSON, provider VARCHAR NOT NULL, "
            "model_name VARCHAR, fallback_reason VARCHAR, created_at DATETIME, UNIQUE (session_id, turn_index))")
        connection.exec_driver_sql(
            "INSERT INTO hoya_chat_turns VALUES ('t1', 's1', 1, '안녕', '그랬구나!', 'demo_script', 'NO_SPEECH', "
            "'WAIT_OR_SIMPLIFY', '[]', 'DEMO', NULL, NULL, '2026-09-29 00:00:00')")
    assert upgrade_hoya_chat_schema(engine) is True
    assert upgrade_hoya_chat_schema(engine) is False
    inspector = inspect(engine)
    assert {"client_request_id", "status", "session_complete", "updated_at"} <= {c["name"] for c in inspector.get_columns("hoya_chat_turns")}
    assert "hoya_chat_turns_legacy" not in inspector.get_table_names()
    with engine.connect() as connection:
        row = connection.execute(text("SELECT id, hoya_text, status, provider FROM hoya_chat_turns")).one()
    assert tuple(row) == ("t1", "그랬구나!", "COMPLETED", "DEMO")
    engine.dispose()


def test_b7dd929_table_gets_fingerprint_column_without_losing_rows(tmp_path):
    """client_request_id는 있지만 request_fingerprint가 없는 구조도 최신으로 간주하지 않는다."""
    from sqlalchemy import inspect, text
    from app.db import Base, make_engine
    from app.hoya.schema_compat import upgrade_hoya_chat_schema
    engine = make_engine(f"sqlite:///{(tmp_path / 'b7dd929.db').as_posix()}")
    Base.metadata.create_all(engine)
    with engine.begin() as connection:
        connection.exec_driver_sql("ALTER TABLE hoya_chat_turns DROP COLUMN request_fingerprint")
        connection.exec_driver_sql(
            "INSERT INTO hoya_chat_turns (id, session_id, turn_index, client_request_id, status, session_complete, "
            "child_transcript, hoya_text, recognizer, speech_evidence, strategy, target_words, provider, created_at, updated_at) "
            "VALUES ('t1', 's1', 1, 'request-abcdefghijkl', 'COMPLETED', 0, '안녕', '그랬구나!', 'demo_script', "
            "'NO_SPEECH', 'WAIT_OR_SIMPLIFY', '[]', 'DEMO', '2026-09-29 00:00:00', '2026-09-29 00:00:00')")
    assert "request_fingerprint" not in {c["name"] for c in inspect(engine).get_columns("hoya_chat_turns")}
    assert upgrade_hoya_chat_schema(engine) is True
    assert upgrade_hoya_chat_schema(engine) is False
    assert "request_fingerprint" in {c["name"] for c in inspect(engine).get_columns("hoya_chat_turns")}
    with engine.connect() as connection:
        row = connection.execute(text("SELECT client_request_id, hoya_text, request_fingerprint FROM hoya_chat_turns")).one()
    assert tuple(row) == ("request-abcdefghijkl", "그랬구나!", None)
    engine.dispose()


def test_current_schema_and_missing_table_are_left_alone(tmp_path):
    from app.db import Base, make_engine
    from app.hoya.schema_compat import upgrade_hoya_chat_schema
    engine = make_engine(f"sqlite:///{(tmp_path / 'empty.db').as_posix()}")
    assert upgrade_hoya_chat_schema(engine) is False
    Base.metadata.create_all(engine)
    assert upgrade_hoya_chat_schema(engine) is False
    engine.dispose()


# ---------------------------------------------------------------- 요청 ID와 요청 내용(fingerprint)

def _post(client, headers, session_id, body):
    return client.post(f"/api/hoya/chat/sessions/{session_id}/turns", headers=headers, json=body)


def test_null_transcript_request_id_cannot_be_reused_for_real_text(api):
    client, _ = api
    provider = CountingProvider()
    _use(provider)
    headers = student_auth(client)
    chat = _start(client, headers)
    request_id = rid()
    first = _turn(client, headers, chat["sessionId"], 1, None, request_id=request_id)
    assert first.status_code == 200
    # None도 정확한 값이다: None == None은 재시도, None != "학교 갔어"는 다른 요청.
    assert _turn(client, headers, chat["sessionId"], 1, None, request_id=request_id).json() == first.json()
    reused = _turn(client, headers, chat["sessionId"], 1, "학교 갔어", request_id=request_id)
    assert reused.status_code == 409 and reused.json()["detail"] == "REQUEST_ID_REUSED"
    assert provider.calls == 1


def test_changed_alternatives_recognizer_or_acoustic_is_rejected(api):
    client, sessions = api
    provider = CountingProvider()
    _use(provider)
    headers = student_auth(client)
    chat = _start(client, headers)
    body = {"turnIndex": 1, "transcript": "학교 갔어", "clientRequestId": rid(), "alternatives": ["학교 갔어"],
            "recognizer": "demo_script", "acoustic": {"durationMs": 900, "meanRmsDb": -30}}
    first = _post(client, headers, chat["sessionId"], body)
    assert first.status_code == 200
    for change in ({"alternatives": ["학교 갔어", "학교 가써"]}, {"recognizer": "web_speech"},
                   {"acoustic": {"durationMs": 901, "meanRmsDb": -30}}, {"acoustic": {"durationMs": 900}}):
        response = _post(client, headers, chat["sessionId"], {**body, **change})
        assert response.status_code == 409 and response.json()["detail"] == "REQUEST_ID_REUSED", change
    assert _post(client, headers, chat["sessionId"], body).json() == first.json()
    assert provider.calls == 1 and _turn_count(sessions) == 1


def test_fingerprint_ignores_json_key_order_and_whitespace(api):
    client, _ = api
    provider = CountingProvider()
    _use(provider)
    headers = student_auth(client)
    chat = _start(client, headers)
    request_id = rid()
    url = f"/api/hoya/chat/sessions/{chat['sessionId']}/turns"
    first = client.post(url, headers=headers, json={"turnIndex": 1, "transcript": "수박", "clientRequestId": request_id,
                                                   "acoustic": {"meanRmsDb": -30, "durationMs": 900}})
    raw = ('{ "acoustic" : {"durationMs": 900, "meanRmsDb": -30},\n "clientRequestId": "%s", '
           '"transcript": "수박", "turnIndex": 1 }' % request_id)
    again = client.post(url, headers={**headers, "Content-Type": "application/json"}, content=raw.encode("utf-8"))
    assert again.status_code == 200 and again.json() == first.json() and provider.calls == 1


def test_fingerprint_contains_no_identity_and_is_cleared_by_retention(api):
    from app import maintenance
    from app.hoya.api import request_fingerprint
    from app.hoya.schemas import HoyaChatTurnInput
    client, sessions = api
    headers = student_auth(client)
    chat = _start(client, headers)
    request_id = rid()
    _turn(client, headers, chat["sessionId"], 1, "학교 갔어", request_id=request_id)
    expected = request_fingerprint(HoyaChatTurnInput(turn_index=1, transcript="학교 갔어", client_request_id=request_id))
    other_id = request_fingerprint(HoyaChatTurnInput(turn_index=1, transcript="학교 갔어", client_request_id=rid()))
    # 요청 ID·세션·아동은 fingerprint 재료가 아니다. 같은 내용이면 같은 값이다.
    assert expected == other_id and len(expected) == 64
    with sessions() as db:
        turn = db.scalar(select(HoyaChatTurn))
        assert turn.request_fingerprint == expected
        turn.created_at = now() - timedelta(days=91)
        db.commit()
        assert maintenance.purge_expired_chat_text(db, 90) == 1
        turn = db.scalar(select(HoyaChatTurn))
        assert (turn.child_transcript, turn.hoya_text, turn.request_fingerprint) == (None, None, None)
