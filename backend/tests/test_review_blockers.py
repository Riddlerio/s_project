"""PR #3 독립 리뷰 blocker 회귀 테스트."""

import json
from pathlib import Path

import pytest
from sqlalchemy.orm.attributes import flag_modified

from app.games.rounds import GAME_ROUNDS, RE_ONSET_END_HOLD_MS, RE_ONSET_PAUSE_MS
from app.models import TrainingSession
from test_api_flow import api, student_auth
from test_hardening import _jump, _past_legacy, _start


ROOT = Path(__file__).resolve().parents[2]


def _mutate(sessions, session_id, change):
    with sessions() as db:
        session = db.get(TrainingSession, session_id)
        state = json.loads(json.dumps(session.runtime_state))
        change(state, session)
        session.runtime_state = state
        flag_modified(session, "runtime_state")  # False→0처럼 ==로 같은 값도 저장한다.
        db.commit()


def _activity_post(client, headers, started):
    return client.post(f"/api/activities/{started['sessionId']}/utterances", headers=headers,
                       json={"roundIndex": 1, "itemId": started["firstItem"]["itemId"], "attemptIndex": 1,
                             "acoustic": {"durationMs": 1300, "activeMs": 1200, "bestRunMs": 1200, "fricationMs": 1200}})


# ---------------------------------------------------------------- B1. 손상된 세션 상태

ACTIVITY_DAMAGE = {
    "missing level": lambda state, _s: state["currentItem"].pop("level"),
    "missing game": lambda state, _s: state["currentItem"].pop("game"),
    "game mismatch": lambda state, _s: state["currentItem"].update(game="sky_climb"),
    "currentItem null": lambda state, _s: state.update(currentItem=None),
    "currentItem list": lambda state, _s: state.update(currentItem=[]),
    "roundDefinition not dict": lambda state, _s: state.update(roundDefinition=[]),
    "roundAttempt string": lambda state, _s: state.update(roundAttempt="1"),
    "unknown game": lambda state, _s: state.update(activityGame="unknown"),
    "round 0": lambda state, _s: state.update(roundIndex=0),
    "round 6": lambda state, _s: state.update(roundIndex=6),
    "bad datetime": lambda state, _s: state.update(roundStartedAt="yesterday"),
    "difficultyDecreased int": lambda state, _s: state.update(difficultyDecreased=0),
}


@pytest.mark.parametrize("name", list(ACTIVITY_DAMAGE))
def test_malformed_activity_state_returns_409(api, name):
    client, sessions = api
    headers = student_auth(client)
    started = _start(client, headers, "magic_beam", "demo")
    _mutate(sessions, started["sessionId"], ACTIVITY_DAMAGE[name])
    assert client.get(f"/api/activities/{started['sessionId']}", headers=headers).status_code == 409
    assert _activity_post(client, headers, started).status_code == 409


def test_corrupted_plan_behind_valid_state_is_409_not_500(api):
    client, sessions = api
    headers = student_auth(client)
    started = _start(client, headers, "magic_beam", "demo")
    with sessions() as db:
        from app.models import TrainingPlan
        session = db.get(TrainingSession, started["sessionId"])
        plan = db.get(TrainingPlan, session.plan_id)
        plan.plan_json = {"stages": []}  # 다음 라운드 항목을 읽을 때 IndexError가 난다.
        db.commit()
    assert _activity_post(client, headers, started).status_code == 409
    with sessions() as db:  # 거부된 요청은 저장되지 않는다.
        assert db.get(TrainingSession, started["sessionId"]).runtime_state["roundIndex"] == 1


@pytest.mark.parametrize("damage", [
    lambda state, _s: state.update(xp="lots"),
    lambda state, _s: state.update(stageIndex=None),
    lambda state, _s: state.update(activityGame="unknown"),
])
def test_corrupted_state_on_completion_returns_409(api, damage):
    client, sessions = api
    headers = student_auth(client)
    started = _start(client, headers, "magic_beam", "demo")
    _mutate(sessions, started["sessionId"], damage)
    assert client.post(f"/api/play/sessions/{started['sessionId']}/complete", headers=headers, json={}).status_code == 409


def test_corrupted_completed_summary_returns_409(api):
    client, sessions = api
    headers = student_auth(client)
    started = _start(client, headers, "magic_beam", "demo")
    with sessions() as db:
        session = db.get(TrainingSession, started["sessionId"])
        session.status = "completed"
        session.summary_json = {"totalXp": "many"}
        db.commit()
    assert client.post(f"/api/play/sessions/{started['sessionId']}/complete", headers=headers, json={}).status_code == 409


def test_valid_sessions_still_work_and_cross_calls_stay_409(api):
    client, sessions = api
    headers = student_auth(client)
    past = _start(client, headers, "magic_beam", "demo")
    _past_legacy(sessions, past["sessionId"])
    activity = _start(client, headers, "magic_beam", "demo")
    assert _activity_post(client, headers, activity).status_code == 200
    assert client.post(f"/api/activities/{past['sessionId']}/utterances", headers=headers,
                       json={"roundIndex": 1, "itemId": past["firstItem"]["itemId"], "acoustic": {}}).status_code == 409
    missing = "00000000-0000-0000-0000-000000000000"
    assert client.post(f"/api/play/sessions/{missing}/complete", headers=headers, json={}).status_code == 404
    assert client.get(f"/api/activities/{missing}", headers=headers).status_code == 404


def test_valid_completion_still_works(api):
    client, _ = api
    headers = student_auth(client)
    started = _start(client, headers, "magic_beam", "demo")
    first = client.post(f"/api/play/sessions/{started['sessionId']}/complete", headers=headers, json={})
    assert first.status_code == 200
    assert client.post(f"/api/play/sessions/{started['sessionId']}/complete", headers=headers, json={}).json() == first.json()


# ---------------------------------------------------------------- B2. 브라우저 요약 → 서버 평가

FIXTURE = json.loads((ROOT / "shared" / "re_onset_mic_cases.json").read_text(encoding="utf-8"))


def test_re_onset_pause_range_is_shorter_than_browser_grace():
    sky_r4 = GAME_ROUNDS["sky_climb"][3]
    assert sky_r4.rule == "RE_ONSET" and sky_r4.end_hold_ms == RE_ONSET_END_HOLD_MS == FIXTURE["endHoldMs"]
    assert list(RE_ONSET_PAUSE_MS) == FIXTURE["pauseRangeMs"]
    assert RE_ONSET_PAUSE_MS[1] < RE_ONSET_END_HOLD_MS


@pytest.mark.parametrize("case", FIXTURE["cases"], ids=[case["name"] for case in FIXTURE["cases"]])
def test_browser_generated_sky_climb_r4_summaries_through_api(api, case):
    """프론트 MicUtterancePipeline이 frame에서 만든 요약(fixture)을 그대로 서버에 보내 평가한다."""
    client, sessions = api
    headers = student_auth(client)
    started = _start(client, headers, "sky_climb")
    item = _jump(sessions, started["sessionId"], 4)
    attempt = 1
    for acoustic, expected in zip(case["acoustics"], case["utterances"]):
        response = client.post(f"/api/activities/{started['sessionId']}/utterances", headers=headers,
                               json={"roundIndex": 4, "itemId": item["itemId"], "attemptIndex": attempt, "acoustic": acoustic})
        assert response.status_code == 200, response.text
        events = {event["type"] for event in response.json()["events"]}
        assert expected in events, (case["name"], events)
        assert "LISTEN_AGAIN" not in events or expected == "LISTEN_AGAIN"  # 정상 재발성은 음질 불량이 되지 않는다.
        attempt = response.json()["nextAttemptIndex"]
    assert len(case["acoustics"]) == len(case["utterances"])


def test_pause_longer_than_range_is_not_accepted_inside_one_utterance(api):
    client, sessions = api
    headers = student_auth(client)
    started = _start(client, headers, "sky_climb")
    item = _jump(sessions, started["sessionId"], 4)
    acoustic = {**FIXTURE["cases"][0]["acoustics"][0], "maxPauseMs": RE_ONSET_PAUSE_MS[1] + 100,
                "pauseTotalMs": RE_ONSET_PAUSE_MS[1] + 100}
    response = client.post(f"/api/activities/{started['sessionId']}/utterances", headers=headers,
                           json={"roundIndex": 4, "itemId": item["itemId"], "attemptIndex": 1, "acoustic": acoustic})
    assert "TARGET_RETRY" in {event["type"] for event in response.json()["events"]}


# ---------------------------------------------------------------- B3. DEMO 계정은 DEMO 모드에서만

from app import main as api_module  # noqa: E402
from app.models import Account, Child, Therapist, TrainingGoal  # noqa: E402
from app.security import hash_password  # noqa: E402


def _regular_accounts(sessions):
    """샘플이 아닌 일반 치료사·아동 계정을 만든다."""
    salt = "44" * 16
    with sessions() as db:
        therapist = Therapist(username="realtherapist", display_name="치료사", password_salt=salt,
                              password_hash=hash_password("strongpass1", salt))
        db.add(therapist)
        db.flush()
        child = Child(child_code="C-9001", hero_name="진짜용사", therapist_id=therapist.id, play_code="REAL01", is_seed=False)
        db.add(child)
        db.flush()
        db.add(TrainingGoal(child_id=child.id, version=1))  # 실제 아동 등록(add_child)처럼 목표를 둔다.
        db.add(Account(username="realtherapist", password_salt=salt, password_hash=therapist.password_hash,
                       role="THERAPIST", therapist_id=therapist.id))
        db.add(Account(username="REAL01", password_salt=salt, password_hash=hash_password("strongpass2", salt),
                       role="STUDENT", child_id=child.id))
        db.commit()


def test_demo_login_is_disabled_in_production_config(api, monkeypatch):
    client, _ = api
    monkeypatch.setattr(api_module.settings, "seed_demo_data", False)
    assert client.get("/api/config/public").json() == {"demoModeEnabled": False}
    for role in ("THERAPIST", "STUDENT"):
        assert client.post("/api/auth/demo-login", json={"role": role}).status_code == 404
    assert client.get("/api/auth/me").status_code == 401


def test_demo_login_works_in_demo_config_without_password(api):
    client, _ = api
    assert client.get("/api/config/public").json() == {"demoModeEnabled": True}
    therapist = client.post("/api/auth/demo-login", json={"role": "THERAPIST"})
    assert therapist.status_code == 200 and therapist.json()["role"] == "THERAPIST"
    assert "password" not in therapist.text.lower() and "speechhero" not in therapist.text
    assert client.get("/api/dashboard/overview").status_code == 200
    student = client.post("/api/auth/demo-login", json={"role": "STUDENT"})
    assert student.status_code == 200 and student.json()["role"] == "STUDENT"
    assert "speechhero" not in student.text
    assert client.get(f"/api/play/children/{student.json()['username']}/profile").status_code == 200
    assert client.post("/api/auth/demo-login", json={"role": "ADMIN"}).status_code == 422


def test_existing_demo_accounts_cannot_log_in_when_demo_mode_is_off(api, monkeypatch):
    client, _ = api
    # DEMO 모드에서 만든 기존 세션도 DEMO 모드를 끄면 더는 쓸 수 없다.
    assert client.post("/api/auth/login", json={"username": "demo", "password": "speechhero"}).status_code == 200
    assert client.get("/api/auth/me").status_code == 200
    monkeypatch.setattr(api_module.settings, "seed_demo_data", False)
    assert client.get("/api/auth/me").status_code == 401
    wrong = client.post("/api/auth/login", json={"username": "demo", "password": "not-it"})
    for username in ("demo", "HERO01", "HERO02"):
        response = client.post("/api/auth/login", json={"username": username, "password": "speechhero"})
        assert response.status_code == 401
        assert response.json()["detail"] == wrong.json()["detail"]  # 일반 실패와 같은 문구


def test_regular_accounts_still_log_in_when_demo_mode_is_off(api, monkeypatch):
    client, sessions = api
    _regular_accounts(sessions)
    monkeypatch.setattr(api_module.settings, "seed_demo_data", False)
    therapist = client.post("/api/auth/login", json={"username": "realtherapist", "password": "strongpass1"})
    assert therapist.status_code == 200 and therapist.json()["role"] == "THERAPIST"
    assert client.get("/api/dashboard/overview").status_code == 200
    student = client.post("/api/auth/login", json={"username": "REAL01", "password": "strongpass2"})
    assert student.status_code == 200 and student.json()["role"] == "STUDENT"
    assert client.get("/api/me/home").status_code == 200


def test_demo_account_detection():
    from types import SimpleNamespace
    from app.demo import is_demo_account

    class FakeDb:
        def __init__(self, rows):
            self.rows = rows

        def get(self, _model, key):
            return self.rows.get(key)

        def scalar(self, _query):
            return None

    db = FakeDb({"seed": SimpleNamespace(is_seed=True), "real": SimpleNamespace(is_seed=False),
                 "t-demo": SimpleNamespace(id="t-demo", username="demo"), "t-real": SimpleNamespace(id="t-real", username="kim")})
    assert is_demo_account(db, SimpleNamespace(role="STUDENT", child_id="seed", username="HERO01"))
    assert not is_demo_account(db, SimpleNamespace(role="STUDENT", child_id="real", username="REAL01"))
    assert is_demo_account(db, SimpleNamespace(role="THERAPIST", therapist_id="t-demo", username="demo"))
    assert not is_demo_account(db, SimpleNamespace(role="THERAPIST", therapist_id="t-real", username="kim"))
    assert not is_demo_account(db, SimpleNamespace(role="ADMIN", child_id=None, therapist_id=None, username="admin"))


# ---------------------------------------------------------------- B4. 정적 프런트엔드 응답의 HTTP 보안 헤더

from app import static_site  # noqa: E402

STATIC_HEADERS = ("Content-Security-Policy", "X-Frame-Options", "X-Content-Type-Options", "Referrer-Policy")


@pytest.fixture
def dist(tmp_path, monkeypatch):
    root = tmp_path / "dist"
    (root / "assets").mkdir(parents=True)
    (root / "index.html").write_text('<!doctype html><html><head><meta charset="UTF-8"/></head><body><div id="root"></div>'
                                     '<script type="module" src="/assets/app.js"></script></body></html>', encoding="utf-8")
    (root / "assets" / "app.js").write_text("console.log('hoya')", encoding="utf-8")
    (tmp_path / "secret.txt").write_text("outside", encoding="utf-8")
    monkeypatch.setattr(api_module.settings, "frontend_dist", str(root))
    return root


def _assert_frontend_headers(response):
    for name in STATIC_HEADERS:
        assert name in response.headers, name
    csp = response.headers["Content-Security-Policy"]
    assert "frame-ancestors 'none'" in csp
    assert "script-src 'self'" in csp and "default-src 'self'" in csp
    assert response.headers["X-Frame-Options"] == "DENY"
    assert response.headers["X-Content-Type-Options"] == "nosniff"


@pytest.mark.parametrize("path", ["/", "/play/home", "/play/activity/abc", "/therapist/login"])
def test_spa_html_responses_have_security_headers(api, dist, path):
    client, _ = api
    response = client.get(path)
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/html")
    assert '<div id="root">' in response.text
    _assert_frontend_headers(response)
    assert response.headers["Cache-Control"] == "no-store"


def test_static_assets_and_missing_files(api, dist):
    client, _ = api
    asset = client.get("/assets/app.js")
    assert asset.status_code == 200 and "hoya" in asset.text
    _assert_frontend_headers(asset)
    assert "immutable" in asset.headers["Cache-Control"]
    missing = client.get("/assets/missing.js")
    assert missing.status_code == 404
    _assert_frontend_headers(missing)
    assert client.get("/..%2Fsecret.txt").status_code == 404
    assert client.get("/%2e%2e/secret.txt").status_code == 404


def test_api_paths_are_not_served_as_html(api, dist):
    client, _ = api
    response = client.get("/api/unknown")
    assert response.status_code == 404
    assert response.headers["content-type"].startswith("application/json")
    assert response.headers["Content-Security-Policy"] == api_module.settings.content_security_policy
    info = client.get("/api/system/info")
    assert info.status_code == 200 and "frame-ancestors 'none'" in info.headers["Content-Security-Policy"]


def test_without_dist_frontend_paths_are_404(api):
    client, _ = api
    assert client.get("/").status_code == 404


def test_header_csp_matches_build_meta_policy():
    directives = json.loads((ROOT / "shared" / "frontend_csp.json").read_text(encoding="utf-8"))["directives"]
    assert static_site.FRONTEND_CSP == "; ".join(directives) + "; frame-ancestors 'none'"
    assert not any("unsafe-eval" in item or item.startswith("script-src") and "unsafe-inline" in item for item in directives)


def test_built_dist_if_present_has_no_demo_credentials():
    """npm.cmd run build 결과가 있으면 배포 파일에 DEMO 자격 증명이 없는지 확인한다."""
    root = ROOT / "dist"
    if not (root / "index.html").is_file():
        pytest.skip("dist가 없습니다. npm.cmd run build 후 실행됩니다.")
    for path in root.rglob("*"):
        if path.is_file():
            text = path.read_bytes().decode("latin1")
            assert "speechhero" not in text and "HERO01" not in text, path
