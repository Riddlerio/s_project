"""시연 데이터가 있는 로컬 서버의 쿠키 인증·5라운드 API를 확인한다."""

import sys
import uuid

import httpx


def main(base_url: str) -> None:
    with httpx.Client(base_url=base_url, timeout=20) as client:
        assert client.get("/api/system/info").status_code == 200
        assert client.get("/api/dashboard/overview").status_code == 401
        login = client.post("/api/auth/login", json={"username": "HERO01", "password": "speechhero"})
        login.raise_for_status()
        assert login.json()["role"] == "STUDENT"
        csrf = {"X-CSRF-Token": login.json()["csrfToken"]}
        assert client.get("/api/me/home").status_code == 200
        assert client.get("/api/dashboard/overview").status_code == 403
        assert client.post("/api/me/character/tap").status_code == 403
        assert client.post("/api/me/character/tap", headers=csrf).status_code == 200

        started = client.post("/api/activities", headers=csrf, json={"game": "magic_beam", "mode": "demo"})
        started.raise_for_status()
        data = started.json()
        assert len(data["rounds"]) == 5
        item = data["firstItem"]
        for index in range(1, 6):
            response = client.post(f"/api/activities/{data['sessionId']}/utterances", headers=csrf,
                                   json={"roundIndex": index, "itemId": item["itemId"], "attemptIndex": 1,
                                         "acoustic": {"durationMs": 5000, "voicedMs": 4000, "activeMs": 4000,
                                                      "bestRunMs": 4000, "fricationMs": 4000,
                                                      "sustainSegmentsMs": [1600, 1600, 1600],
                                                      "onsetFricationMs": 500, "voicedAfterFricationMs": 300}})
            response.raise_for_status()
            result = response.json()
            assert any(event["type"] == "ROUND_CLEAR" for event in result["events"])
            item = result["nextItem"]
        assert result["sessionComplete"]
        complete = client.post(f"/api/play/sessions/{data['sessionId']}/complete", headers=csrf,
                               json={"elapsedSec": 300})
        complete.raise_for_status()

        therapist = client.post("/api/auth/login", json={"username": "demo", "password": "speechhero"})
        therapist.raise_for_status()
        assert therapist.json()["role"] == "THERAPIST"
        timeline = client.get(f"/api/sessions/{data['sessionId']}/timeline")
        timeline.raise_for_status()
        assert {row["round_index"] for row in timeline.json()["observations"]} == {1, 2, 3, 4, 5}
        print("[OK] 쿠키 인증, CSRF, 역할 접근, 5라운드, 임상 관찰")

        # 치료사 회기 계획: 근거 context → 제안 → 초안 → 승인 → 승인본 수정 거부.
        therapist_csrf = {"X-CSRF-Token": therapist.json()["csrfToken"]}
        child_id = client.get("/api/children").json()[0]["id"]
        client.get(f"/api/children/{child_id}/planning-context").raise_for_status()
        proposal = client.post(f"/api/children/{child_id}/session-plan-proposal", headers=therapist_csrf)
        proposal.raise_for_status()
        form = proposal.json()["proposal"]["form"]
        plan = client.post(f"/api/children/{child_id}/session-plans", headers=therapist_csrf, json=form)
        plan.raise_for_status()
        client.post(f"/api/session-plans/{plan.json()['id']}/approve", headers=therapist_csrf).raise_for_status()
        assert client.patch(f"/api/session-plans/{plan.json()['id']}", headers=therapist_csrf, json=form).status_code == 409
        print(f"[OK] 치료사 회기 계획 제안({proposal.json()['status']})·초안·승인·승인본 불변")

        # 호야와 대화하기(DEMO 제공자): 시작 → 자동 turn → 종료.
        login = client.post("/api/auth/login", json={"username": "HERO01", "password": "speechhero"})
        login.raise_for_status()
        csrf = {"X-CSRF-Token": login.json()["csrfToken"]}
        chat = client.post("/api/hoya/chat/sessions", headers=csrf, json={"mode": "demo"})
        chat.raise_for_status()
        chat_id = chat.json()["sessionId"]
        for index, text in enumerate(["학교 갔어.", "미술 수업 했어.", None], 1):
            body = {"turnIndex": index, "transcript": text, "clientRequestId": str(uuid.uuid4())}
            turn = client.post(f"/api/hoya/chat/sessions/{chat_id}/turns", headers=csrf, json=body)
            turn.raise_for_status()
            assert turn.json()["text"] and "틀렸" not in turn.json()["text"]
            # 응답을 잃은 경우처럼 같은 요청을 다시 보내면 저장된 답이 그대로 온다.
            again = client.post(f"/api/hoya/chat/sessions/{chat_id}/turns", headers=csrf, json=body)
            assert again.status_code == 200 and again.json() == turn.json()
        assert client.post(f"/api/hoya/chat/sessions/{chat_id}/turns", headers=csrf,
                           json={"turnIndex": 3, "transcript": "또", "clientRequestId": str(uuid.uuid4())}).status_code == 409
        client.post(f"/api/hoya/chat/sessions/{chat_id}/complete", headers=csrf).raise_for_status()
        print("[OK] 호야와 대화하기 DEMO 흐름(같은 요청 재시도 포함)")


if __name__ == "__main__":
    try:
        main(sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8000")
    except Exception as exc:
        print(f"[FAIL] {exc}", file=sys.stderr)
        raise SystemExit(1) from exc
