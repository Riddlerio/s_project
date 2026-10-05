"""치료사 박자 설정의 권한·범위·감사·기존 DB 및 회기 호환을 확인한다."""
import pytest
from sqlalchemy import select, text

from app.db import Base, make_engine
from app.game_settings.models import ChildGameSettings
from app.models import Account, AuditEvent, Child, Therapist, TrainingSession
from app.security import hash_password
from test_api_flow import api, auth, start_activity, student_auth
from test_daegu_crossing import GOOD, send


def child_id(sessions):
    with sessions() as db:
        return db.scalar(select(Child.id).where(Child.play_code == "HERO01"))


def endpoint(sessions):
    return f"/api/therapist/children/{child_id(sessions)}/game-settings"


def body(bpm=84, faster=True):
    return {"daeguCrossing": {"startBpm": bpm, "allowFaster": faster}}


def test_default_read_is_not_a_write_and_update_has_attribution_and_audit(api):
    client, sessions = api
    headers = auth(client)
    url = endpoint(sessions)
    response = client.get(url)
    assert response.status_code == 200
    assert response.json() == {"daeguCrossing": {"startBpm": 84, "allowFaster": True,
                                                "updatedAt": None, "updatedBy": None}}
    with sessions() as db:
        assert not db.scalars(select(ChildGameSettings)).all()
    response = client.put(url, headers=headers, json=body(76, False))
    assert response.status_code == 200, response.text
    saved = response.json()["daeguCrossing"]
    assert saved["startBpm"] == 76 and saved["allowFaster"] is False
    assert saved["updatedAt"].endswith("+00:00") and saved["updatedBy"]
    assert client.get(url).json() == response.json()
    assert client.put(url, headers=headers, json=body(76, False)).json() == response.json()
    with sessions() as db:
        row = db.get(ChildGameSettings, child_id(sessions))
        audits = db.scalars(select(AuditEvent).where(AuditEvent.action == "GAME_SETTINGS_UPDATE")).all()
        assert len(audits) == 1
        assert audits[0].actor_id == row.updated_by
        assert audits[0].resource_id == row.child_id and audits[0].result == "SUCCESS"
        assert saved["updatedBy"] == db.get(Therapist, row.updated_by).display_name
    for bpm in (85, 100):
        result = client.put(url, headers=headers, json=body(bpm))
        assert result.status_code == 200 and result.json()["daeguCrossing"]["startBpm"] == bpm


@pytest.mark.parametrize("payload", [body(75), body(101), body(84.0), body("84"), body(True),
                                     body(84, 1), body(84, "false"), body(84, None),
                                     {"daeguCrossing": {"startBpm": 84}},
                                     {**body(), "timingScore": 100},
                                     {"daeguCrossing": {**body()["daeguCrossing"], "updatedBy": "spoof"}}])
def test_invalid_settings_are_422_without_changes_or_audit(api, payload):
    client, sessions = api
    headers = auth(client)
    response = client.put(endpoint(sessions), headers=headers, json=payload)
    assert response.status_code == 422, response.text
    with sessions() as db:
        assert not db.scalars(select(ChildGameSettings)).all()
        assert not db.scalars(select(AuditEvent).where(AuditEvent.action == "GAME_SETTINGS_UPDATE")).all()


def test_auth_csrf_roles_and_foreign_child_use_existing_guards(api):
    client, sessions = api
    url = endpoint(sessions)
    assert client.get(url).status_code == 401
    assert client.put(url, json=body()).status_code == 401
    student = student_auth(client)
    assert client.get(url).status_code == 403
    assert client.put(url, headers=student, json=body()).status_code == 403
    headers = auth(client)
    assert client.put(url, json=body()).status_code == 403
    assert client.put(url, headers={**headers, "Origin": "https://untrusted.invalid"}, json=body()).status_code == 403
    with sessions() as db:
        salt = "cd" * 16
        other = Therapist(username="rhythm-other", display_name="다른 치료사", password_salt=salt,
                          password_hash=hash_password("validpass", salt))
        db.add(other)
        db.flush()
        db.add(Account(username=other.username, password_salt=salt, password_hash=other.password_hash,
                       role="THERAPIST", therapist_id=other.id))
        db.commit()
        other_id = other.id
    login = client.post("/api/auth/login", json={"username": "rhythm-other", "password": "validpass"})
    other_headers = {"X-CSRF-Token": login.json()["csrfToken"]}
    assert client.get(url).status_code == 404
    assert client.put(url, headers=other_headers, json=body()).status_code == 404
    assert client.get("/api/therapist/children/absent/game-settings").status_code == 404
    with sessions() as db:
        denied = db.scalars(select(AuditEvent).where(AuditEvent.actor_id == other_id,
                                                     AuditEvent.action == "ACCESS_DENIED")).all()
        assert len(denied) == 3
        assert not db.scalars(select(ChildGameSettings)).all()


def test_start_snapshot_claim_and_completed_record_keep_original_rhythm(api):
    client, sessions = api
    headers = auth(client)
    url = endpoint(sessions)
    assert client.put(url, headers=headers, json=body(92, False)).status_code == 200
    student = student_auth(client)
    first = start_activity(client, student, "daegu_crossing")
    original = {"startBpm": 92, "allowFaster": False}
    assert first["rhythm"] == original and set(first["rhythm"]) == {"startBpm", "allowFaster"}
    headers = auth(client)
    assert client.put(url, headers=headers, json=body(100, True)).status_code == 200
    student = student_auth(client)
    sid = first["sessionId"]
    assert client.get(f"/api/activities/{sid}").json()["rhythm"] == original
    claim = client.post(f"/api/activities/{sid}/claim", headers=student, json={}).json()
    assert claim["rhythm"] == original
    lease = {**student, "X-Activity-Lease": claim["leaseToken"]}
    current = claim
    for _ in range(10):
        current = send(client, lease, sid, current, GOOD)
        assert "rhythm" not in current  # 새 필드는 시작·스냅숏에만 붙는다.
    assert current["sessionComplete"]
    completed = client.post(f"/api/play/sessions/{sid}/complete", headers=lease, json={"elapsedSec": 60})
    assert completed.status_code == 200
    assert set(completed.json()) == {"totalAttempts", "durationSec", "sessionComplete"}
    with sessions() as db:
        assert db.get(TrainingSession, sid).runtime_state["rhythm"] == original
    new = start_activity(client, student, "daegu_crossing")
    assert new["rhythm"] == {"startBpm": 100, "allowFaster": True}


def test_legacy_session_without_rhythm_stays_missing_and_default_is_only_for_new_start(api):
    client, sessions = api
    student = student_auth(client)
    started = start_activity(client, student, "daegu_crossing")
    assert started["rhythm"] == {"startBpm": 84, "allowFaster": True}
    with sessions() as db:
        row = db.get(TrainingSession, started["sessionId"])
        row.runtime_state = {key: value for key, value in row.runtime_state.items() if key != "rhythm"}
        db.commit()
    headers = auth(client)
    client.put(endpoint(sessions), headers=headers, json=body(100, False)).raise_for_status()
    student = student_auth(client)
    url = f"/api/activities/{started['sessionId']}"
    assert "rhythm" not in client.get(url).json()
    claimed = client.post(url + "/claim", headers=student, json={})
    assert claimed.status_code == 200 and "rhythm" not in claimed.json()
    with sessions() as db:
        assert "rhythm" not in db.get(TrainingSession, started["sessionId"]).runtime_state


@pytest.mark.parametrize("game", ["magic_beam", "sky_climb", "monster_adventure", "conversation_quest"])
def test_other_games_keep_their_existing_payload_and_state(api, game):
    client, sessions = api
    student = student_auth(client)
    started = start_activity(client, student, game)
    sid = started["sessionId"]
    assert "rhythm" not in started
    assert "rhythm" not in client.get(f"/api/activities/{sid}").json()
    claimed = client.post(f"/api/activities/{sid}/claim", headers=student, json={})
    assert claimed.status_code == 200 and "rhythm" not in claimed.json()
    with sessions() as db:
        assert "rhythm" not in db.get(TrainingSession, sid).runtime_state


def test_create_all_adds_only_new_table_to_existing_database(tmp_path):
    engine = make_engine(f"sqlite:///{(tmp_path / 'old.db').as_posix()}")
    old_tables = [table for table in Base.metadata.sorted_tables if table.name != "child_game_settings"]
    Base.metadata.create_all(engine, tables=old_tables)
    with engine.begin() as connection:
        before = dict(connection.execute(text("SELECT name, sql FROM sqlite_master WHERE type='table'")).all())
        connection.execute(text("INSERT INTO therapists (id, username, password_hash, password_salt, display_name, created_at) "
                                "VALUES ('kept', 'kept', 'hash', 'salt', '보존 대상', '2026-10-05')"))
    Base.metadata.create_all(engine)
    Base.metadata.create_all(engine)  # 재시작에도 안전하다.
    with engine.connect() as connection:
        after = dict(connection.execute(text("SELECT name, sql FROM sqlite_master WHERE type='table'")).all())
        assert set(after) - set(before) == {"child_game_settings"}
        assert all(after[name] == sql for name, sql in before.items())
        assert connection.execute(text("SELECT display_name FROM therapists WHERE id='kept'")).scalar_one() == "보존 대상"
    engine.dispose()
