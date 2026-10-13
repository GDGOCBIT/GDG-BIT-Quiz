import os

os.environ.setdefault("AUTH_SECRET", "test-secret-0123456789abcdef-test")
os.environ.setdefault("ADMIN_PASSWORD", "test-admin")
os.environ.setdefault(
    "DATABASE_URL",
    os.environ.get(
        "DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/quizlive"
    ),
)

from app import config

config.get_settings.cache_clear()

from app.main import create_app
from fastapi.testclient import TestClient


def make_client():
    config.get_settings.cache_clear()
    client = TestClient(create_app())
    client.__enter__()
    return client


def admin_headers(client: TestClient):
    r = client.post("/api/v1/admin/login", json={"password": "test-admin"})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


def test_healthz():
    client = make_client()
    r = client.get("/healthz")
    assert r.status_code == 200
    assert r.json()["ok"] is True


def test_full_quiz_flow():
    client = make_client()
    h = admin_headers(client)

    r = client.post("/api/v1/admin/quizzes", json={"title": "GDG Quiz"}, headers=h)
    assert r.status_code == 201, r.text
    quiz = r.json()["quiz"]
    assert quiz["status"] == "draft"
    assert len(quiz["join_code"]) == 6

    r = client.post(
        f"/api/v1/admin/quizzes/{quiz['id']}/questions/bulk",
        json={
            "questions": [
                {
                    "text": "2+2?",
                    "options": ["3", "4"],
                    "correct_index": 1,
                    "seconds": 20,
                },
                {
                    "text": "Sky color?",
                    "options": ["Blue", "Green"],
                    "correct_index": 0,
                    "seconds": 10,
                },
            ]
        },
        headers=h,
    )
    assert r.status_code == 201, r.text
    assert len(r.json()["questions"]) == 2

    for action in ("open", "start"):
        r = client.post(
            f"/api/v1/admin/quizzes/{quiz['id']}/control",
            json={"action": action},
            headers=h,
        )
        assert r.status_code == 200, (action, r.text)

    info = client.get(f"/api/v1/quiz/by-code/{quiz['join_code']}").json()
    assert info["quiz"]["status"] == "active"

    r = client.post(
        "/api/v1/quiz/join",
        json={"code": quiz["join_code"], "name": "Asha", "stream": "CSE"},
    )
    assert r.status_code == 201, r.text
    token = r.json()["participant_token"]
    ph = {"Authorization": f"Bearer {token}"}

    r = client.get("/api/v1/quiz/bundle", headers=ph)
    assert r.status_code == 200, r.text
    bundle = r.json()
    assert len(bundle["questions"]) == 2
    assert bundle["questions"][0]["correct_index"] == 1
    assert bundle["me"]["score"] == 0

    q1 = bundle["questions"][0]
    r = client.post(
        "/api/v1/quiz/answer",
        headers=ph,
        json={
            "question_id": q1["id"],
            "choice": 1,
            "ms_taken": 0,
            "points": 150,
        },
    )
    assert r.status_code == 200, r.text
    assert r.json()["correct"] is True
    assert r.json()["points"] == 150

    r = client.post(
        "/api/v1/quiz/answer",
        headers=ph,
        json={
            "question_id": q1["id"],
            "choice": 0,
            "ms_taken": 0,
            "points": 0,
        },
    )
    assert r.json()["accepted"] is False
    assert r.json()["points"] == 150

    r = client.get("/api/v1/quiz/leaderboard", headers=ph)
    assert r.status_code == 200, r.text
    assert r.json()["my_score"] == 150
    assert r.json()["top10"][0]["name"] == "Asha"

    q2 = bundle["questions"][1]
    r = client.post(
        "/api/v1/quiz/sync",
        headers=ph,
        json={
            "answers": [
                {"question_id": q2["id"], "choice": 0, "ms_taken": 5000, "points": 125},
            ]
        },
    )
    assert r.status_code == 200, r.text
    assert r.json()["my_score"] == 150 + 125


def test_duplicate_name_gets_suffix():
    client = make_client()
    h = admin_headers(client)
    r = client.post("/api/v1/admin/quizzes", json={"title": "Dupe Test"}, headers=h)
    quiz = r.json()["quiz"]
    client.post(
        f"/api/v1/admin/quizzes/{quiz['id']}/questions",
        json={"text": "Q?", "options": ["A", "B"], "correct_index": 0},
        headers=h,
    )
    client.post(
        f"/api/v1/admin/quizzes/{quiz['id']}/control",
        json={"action": "open"},
        headers=h,
    )

    def _join(name: str):
        return client.post(
            "/api/v1/quiz/join",
            json={"code": quiz["join_code"], "name": name, "stream": "CSE"},
        ).json()["participant"]["name"]

    first = _join("Alice")
    second = _join("alice")
    assert first == "Alice"
    assert second == "alice (2)"


def test_ws_answer_and_leaderboard_push():
    client = make_client()
    h = admin_headers(client)

    quiz = client.post(
        "/api/v1/admin/quizzes", json={"title": "WS Quiz"}, headers=h
    ).json()["quiz"]
    client.post(
        f"/api/v1/admin/quizzes/{quiz['id']}/questions",
        json={"text": "1+1?", "options": ["2", "3"], "correct_index": 0, "seconds": 20},
        headers=h,
    )
    client.post(
        f"/api/v1/admin/quizzes/{quiz['id']}/control",
        json={"action": "open"},
        headers=h,
    )
    client.post(
        f"/api/v1/admin/quizzes/{quiz['id']}/control",
        json={"action": "start"},
        headers=h,
    )

    token = client.post(
        "/api/v1/quiz/join",
        json={"code": quiz["join_code"], "name": "Dev", "stream": "ECE"},
    ).json()["participant_token"]
    bundle = client.get(
        "/api/v1/quiz/bundle", headers={"Authorization": f"Bearer {token}"}
    ).json()
    qid = bundle["questions"][0]["id"]

    with client.websocket_connect("/ws/play") as ws:
        ws.send_json({"type": "hello", "token": token})
        welcome = ws.receive_json()
        assert welcome["type"] == "welcome"
        assert "top10" in welcome

        ws.send_json(
            {"type": "answer.submit", "question_id": qid, "choice": 0, "ms_taken": 1000}
        )

        seen_result = False
        for _ in range(5):
            msg = ws.receive_json()
            if msg["type"] == "answer.result":
                assert msg["results"][0]["correct"] is True
                assert msg["results"][0]["points"] > 0
                seen_result = True
                break
        assert seen_result, "answer.result never received"


def test_admin_live_snapshot():
    client = make_client()
    h = admin_headers(client)

    quiz = client.post(
        "/api/v1/admin/quizzes",
        json={"title": "Live Snap", "description": "test"},
        headers=h,
    ).json()["quiz"]
    client.post(
        f"/api/v1/admin/quizzes/{quiz['id']}/questions",
        json={
            "text": "Q?",
            "options": ["A", "B", "C"],
            "correct_index": 2,
            "seconds": 30,
        },
        headers=h,
    )
    for action in ("open", "start"):
        client.post(
            f"/api/v1/admin/quizzes/{quiz['id']}/control",
            json={"action": action},
            headers=h,
        )

    r = client.get(f"/api/v1/admin/quizzes/{quiz['id']}/live", headers=h)
    assert r.status_code == 200, r.text
    snap = r.json()
    assert snap["quiz"]["status"] == "active"
    assert snap["total_questions"] == 1
    assert snap["current"]["text"] == "Q?"
    assert snap["current"]["correct_index"] == 2


def test_schema_columns():
    from pathlib import Path

    schema = (Path(__file__).resolve().parent.parent / "schema.sql").read_text().lower()
    must_contain = [
        "quizzes (",
        "questions (",
        "participants (",
        "answers (",
        "join_code",
        "options_json",
        "correct_index",
        "question_started_at_ms",
        "created_at_ms",
        "answered_at_ms",
        "ms_taken",
        "is_correct",
    ]
    for token in must_contain:
        assert token in schema, f"schema.sql missing: {token!r}"
