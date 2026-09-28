"""실행 중인 API에 대해 데모 세션과 치료사 루프를 확인한다."""

import sys

import httpx


def main(base_url: str) -> None:
    with httpx.Client(base_url=base_url, timeout=20) as client:
        def request(method, path, *, token=None, **kwargs):
            response = client.request(method, path, headers={"Authorization": f"Bearer {token}"} if token else None, **kwargs)
            response.raise_for_status()
            print(f"[OK] {method} {path}: {response.status_code}")
            return response.json() if response.content else None

        info = request("GET", "/api/system/info")
        assert "demo" in info["modes"]
        auth = request("POST", "/api/auth/login", json={"username": "demo", "password": "speechhero"})
        token = auth["token"]
        overview = request("GET", "/api/dashboard/overview", token=token)
        assert len(overview["activeChildren"]) >= 3
        child = next(c for c in overview["activeChildren"] if c["child_code"] == "C-0001")
        detail = request("GET", f"/api/children/{child['id']}", token=token)
        assert detail["currentGoal"]
        progress = request("GET", f"/api/children/{child['id']}/progress", token=token)
        assert len(progress["sessions"]) >= 4
        started = request("POST", "/api/play/start", json={"playCode": "HERO01", "mode": "demo"})
        item = started["firstItem"]
        attempt = 1
        play_headers = {"X-Play-Token": started["playToken"]}
        for step in range(80):
            transcript = None if item["game"] == "magic_beam" else "따과" if item["displayText"] == "사과" and attempt <= 3 and step < 4 else item["displayText"]
            voiced = item.get("beamTargetMs", 1500) + 250 if item["game"] == "magic_beam" else 900
            response = client.post(f"/api/play/sessions/{started['sessionId']}/utterances", headers=play_headers, json={"itemId": item["itemId"], "attemptIndex": attempt, "transcript": transcript, "recognizer": "demo_script", "acoustic": {"durationMs": voiced, "voicedMs": voiced, "meanRmsDb": -20, "peakRmsDb": -12, "meanHfRatio": 0.2, "onsetLatencyMs": 100}, "elapsedSec": step * 8})
            response.raise_for_status()
            data = response.json()
            if data["sessionComplete"]:
                print(f"[OK] 세션 완료: {step + 1}회 발화")
                break
            item, attempt = data["nextItem"], data["nextAttemptIndex"]
        else:
            raise AssertionError("80회 안에 세션이 완료되지 않았습니다")
        summary = client.post(f"/api/play/sessions/{started['sessionId']}/complete", headers=play_headers, json={"elapsedSec": (step + 1) * 8})
        summary.raise_for_status()
        assert "totalXp" in summary.json()
        print("[OK] 세션 요약")
        session_detail = request("GET", f"/api/sessions/{started['sessionId']}", token=token)
        assert session_detail["session"]["status"] == "completed"
        assert session_detail["utterances"] and session_detail["decisions"] and session_detail["events"]
        utterance_id = session_detail["utterances"][0]["id"]
        feedback = request("POST", f"/api/utterances/{utterance_id}/feedback", token=token,
                           json={"action": "note", "note": "API smoke 확인"})
        assert feedback["feedback"]["action"] == "note"
        recs = request("GET", f"/api/children/{child['id']}/recommendations?status=pending", token=token)
        assert recs
        accepted = request("POST", f"/api/recommendations/{recs[0]['id']}/decision", token=token, json={"action": "accept", "note": "API smoke 확인"})
        assert accepted["newGoal"]["version"] > detail["currentGoal"]["version"]
        assert accepted["recommendation"]["status"] == "accepted"
        next_start = request("POST", "/api/play/start", json={"playCode": "HERO01", "mode": "demo"})
        assert next_start["firstItem"]["level"] == accepted["newGoal"]["level"]
        unauth = client.get("/api/dashboard/overview")
        assert unauth.status_code == 401
        print("[OK] 비인증 요청 401")


if __name__ == "__main__":
    try:
        main(sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8000")
    except Exception as exc:
        print(f"[FAIL] {exc}", file=sys.stderr)
        raise SystemExit(1) from exc
