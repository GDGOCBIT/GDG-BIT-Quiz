import re
import time

from fastapi import APIRouter, Depends, HTTPException

from ..auth import mint_participant_token
from ..db import Store
from ..deps import current_participant, get_hub, get_store
from ..schemas import AnswerSubmit, JoinRequest, SyncRequest
from ..scoring import server_points
from ..ws_hub import RoomHub

router = APIRouter(prefix="/api/v1/quiz", tags=["quiz"])

CODE_RE = re.compile(r"^[A-Z0-9]{4,10}$", re.I)


@router.get("/by-code/{code}")
async def public_info(code: str, store: Store = Depends(get_store)):
    if not CODE_RE.match(code.strip()):
        raise HTTPException(status_code=400, detail="Invalid code")
    quiz = await store.get_quiz_by_code(code.strip())
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    return {
        "quiz": {
            "title": quiz["title"],
            "description": quiz["description"],
            "status": quiz["status"],
        },
        "participant_count": await store.participant_count(quiz["id"]),
    }


@router.post("/join", status_code=201)
async def join(body: JoinRequest, store: Store = Depends(get_store)):
    quiz = await store.get_quiz_by_code(body.code.strip())
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    if quiz["status"] == "ended":
        raise HTTPException(status_code=409, detail="This quiz has ended")
    if quiz["status"] == "draft":
        raise HTTPException(status_code=409, detail="This quiz isn't open yet")
    name, stream = body.name.strip(), body.stream.strip()
    if not name or not stream:
        raise HTTPException(status_code=400, detail="Enter your name and stream")
    p = await store.join_quiz(quiz["id"], name[:40], stream[:40])
    return {
        "participant_token": mint_participant_token(p["id"], quiz["id"]),
        "participant": {"id": p["id"], "name": p["name"], "stream": p["stream"]},
        "quiz": {"id": quiz["id"], "title": quiz["title"], "status": quiz["status"]},
    }


@router.get("/bundle")
async def bundle(
    me: dict = Depends(current_participant),
    store: Store = Depends(get_store),
):
    quiz = await store.get_quiz(me["quiz_id"])
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    questions = await store.list_questions(me["quiz_id"])
    fresh = await store.get_participant(me["id"])
    board, total, _ = await store.leaderboard(me["quiz_id"], limit=10)
    return {
        "server_now_ms": int(time.time() * 1000),
        "quiz": {
            "id": quiz["id"],
            "title": quiz["title"],
            "description": quiz["description"],
            "status": quiz["status"],
            "current_index": quiz["current_index"],
            "question_started_at_ms": quiz["question_started_at_ms"],
        },
        "me": {
            "id": fresh["id"],
            "name": fresh["name"],
            "stream": fresh["stream"],
            "score": fresh["score"],
            "rank": await store.rank_of(me["quiz_id"], fresh["score"]),
        },
        "questions": [
            {
                "id": q["id"],
                "position": q["position"],
                "text": q["text"],
                "options": q["options"],
                "correct_index": q["correct_index"],
                "seconds": q["seconds"],
            }
            for q in questions
        ],
        "leaderboard": {"top10": board, "total_participants": total},
    }


@router.get("/leaderboard")
async def leaderboard(
    me: dict = Depends(current_participant),
    store: Store = Depends(get_store),
):
    fresh = await store.get_participant(me["id"])
    board, total, _ = await store.leaderboard(me["quiz_id"], limit=10)
    return {
        "server_now_ms": int(time.time() * 1000),
        "top10": board,
        "total_participants": total,
        "my_rank": await store.rank_of(me["quiz_id"], fresh["score"]),
        "my_score": fresh["score"],
    }


async def _apply_answer(store: Store, hub: RoomHub, me: dict, sub: AnswerSubmit):
    questions = await store.list_questions(me["quiz_id"])
    q = next((x for x in questions if x["id"] == sub.question_id), None)
    if q is None:
        raise HTTPException(status_code=404, detail="Question not found")
    if sub.choice >= len(q["options"]):
        raise HTTPException(status_code=400, detail="Invalid answer")
    is_correct = sub.choice == q["correct_index"]

    points = server_points(q["seconds"], sub.ms_taken, sub.points) if is_correct else 0
    stored, accepted = await store.record_answer(
        me["id"], q["id"], sub.choice, is_correct, points, sub.ms_taken or 0
    )
    fresh = await store.get_participant(me["id"])
    result = {
        "question_id": q["id"],
        "accepted": accepted,
        "correct": bool(stored["is_correct"]),
        "points": stored["points"],
        "my_score": fresh["score"],
        "my_rank": await store.rank_of(me["quiz_id"], fresh["score"]),
    }
    if accepted:
        board, total, _ = await store.leaderboard(me["quiz_id"], limit=10)
        event = {
            "type": "leaderboard.update",
            "top10": board,
            "total_participants": total,
            "server_now_ms": int(time.time() * 1000),
        }
        await hub.broadcast_quiz(me["quiz_id"], event)
        await hub.broadcast_admin(
            me["quiz_id"],
            {
                **event,
                "answer": {
                    "participant": fresh["name"],
                    "correct": bool(stored["is_correct"]),
                    "points": stored["points"],
                    "question_id": q["id"],
                },
            },
        )
    return result


@router.post("/answer")
async def answer(
    sub: AnswerSubmit,
    me: dict = Depends(current_participant),
    store: Store = Depends(get_store),
    hub: RoomHub = Depends(get_hub),
):
    return await _apply_answer(store, hub, me, sub)


@router.post("/sync")
async def sync(
    body: SyncRequest,
    me: dict = Depends(current_participant),
    store: Store = Depends(get_store),
    hub: RoomHub = Depends(get_hub),
):
    results = [await _apply_answer(store, hub, me, sub) for sub in body.answers]
    fresh = await store.get_participant(me["id"])
    return {"results": results, "my_score": fresh["score"]}
