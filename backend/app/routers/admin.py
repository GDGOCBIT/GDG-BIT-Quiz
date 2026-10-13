import time

from fastapi import APIRouter, Depends, HTTPException, Request

from ..auth import mint_admin_token
from ..config import get_settings
from ..db import Store, now_ms
from ..deps import get_hub, get_store, require_admin
from ..schemas import (
    AdminLogin,
    ControlAction,
    QuestionBulk,
    QuestionCreate,
    QuizCreate,
)
from ..ws_hub import RoomHub

router = APIRouter(prefix="/api/v1/admin", tags=["admin"])


@router.post("/login")
async def login(body: AdminLogin):
    if body.password != get_settings().admin_password:
        raise HTTPException(status_code=401, detail="Wrong password")
    return {"token": mint_admin_token()}


@router.get("/quizzes")
async def list_quizzes(
    store: Store = Depends(get_store), _a: None = Depends(require_admin)
):
    return {"quizzes": await store.list_quizzes()}


@router.post("/quizzes", status_code=201)
async def create_quiz(
    body: QuizCreate,
    store: Store = Depends(get_store),
    _a: None = Depends(require_admin),
):
    quiz = await store.create_quiz(body.title.strip(), (body.description or "").strip())
    return {"quiz": quiz}


@router.delete("/quizzes")
async def delete_quiz(
    id: str,
    store: Store = Depends(get_store),
    _a: None = Depends(require_admin),
):
    quiz = await store.get_quiz(id)
    if not quiz:
        raise HTTPException(status_code=404, detail="Not found")
    if quiz["status"] in ("lobby", "active"):
        raise HTTPException(status_code=409, detail="End the quiz before deleting it")
    await store.delete_quiz(id)
    return {"ok": True}


@router.get("/quizzes/{qid}/questions")
async def list_questions(
    qid: str,
    store: Store = Depends(get_store),
    _a: None = Depends(require_admin),
):
    if not await store.get_quiz(qid):
        raise HTTPException(status_code=404, detail="Not found")
    return {"questions": await store.list_questions(qid)}


@router.post("/quizzes/{qid}/questions", status_code=201)
async def add_question(
    qid: str,
    body: QuestionCreate,
    store: Store = Depends(get_store),
    _a: None = Depends(require_admin),
):
    quiz = await store.get_quiz(qid)
    if not quiz:
        raise HTTPException(status_code=404, detail="Not found")
    if quiz["status"] != "draft":
        raise HTTPException(
            status_code=409, detail="Questions can only be added before the quiz opens"
        )
    if body.correct_index >= len(body.options):
        raise HTTPException(status_code=400, detail="Correct answer index out of range")
    q = await store.add_question(
        qid,
        body.text.strip(),
        [o.strip() for o in body.options],
        body.correct_index,
        body.seconds,
    )
    return {"question": q}


@router.post("/quizzes/{qid}/questions/bulk", status_code=201)
async def add_questions_bulk(
    qid: str,
    body: QuestionBulk,
    store: Store = Depends(get_store),
    _a: None = Depends(require_admin),
):
    quiz = await store.get_quiz(qid)
    if not quiz:
        raise HTTPException(status_code=404, detail="Not found")
    if quiz["status"] != "draft":
        raise HTTPException(
            status_code=409, detail="Questions can only be added before the quiz opens"
        )
    out = []
    for item in body.questions:
        if item.correct_index >= len(item.options):
            raise HTTPException(
                status_code=400, detail="Correct answer index out of range"
            )
        out.append(
            await store.add_question(
                qid,
                item.text.strip(),
                [o.strip() for o in item.options],
                item.correct_index,
                item.seconds,
            )
        )
    return {"questions": out}


@router.delete("/questions/{question_id}")
async def delete_question(
    question_id: str,
    store: Store = Depends(get_store),
    _a: None = Depends(require_admin),
):
    await store.delete_question(question_id)
    return {"ok": True}


@router.post("/quizzes/{qid}/control")
async def control(
    qid: str,
    body: ControlAction,
    request: Request,
    store: Store = Depends(get_store),
    hub: RoomHub = Depends(get_hub),
    _a: None = Depends(require_admin),
):
    quiz = await store.get_quiz(qid)
    if not quiz:
        raise HTTPException(status_code=404, detail="Not found")
    questions = await store.list_questions(qid)
    action = body.action

    if action == "open":
        if quiz["status"] != "draft":
            raise HTTPException(status_code=409, detail="Quiz already opened")
        if not questions:
            raise HTTPException(
                status_code=409, detail="Add at least one question first"
            )
        quiz = await store.update_quiz(qid, status="lobby")
    elif action == "start":
        if quiz["status"] not in ("lobby", "draft"):
            raise HTTPException(status_code=409, detail="Quiz already started")
        if not questions:
            raise HTTPException(
                status_code=409, detail="Add at least one question first"
            )
        quiz = await store.update_quiz(
            qid, status="active", current_index=0, question_started_at_ms=now_ms()
        )
    elif action == "next":
        if quiz["status"] != "active":
            raise HTTPException(status_code=409, detail="Quiz is not running")
        nxt = quiz["current_index"] + 1
        if nxt >= len(questions):
            quiz = await store.update_quiz(qid, status="ended")
        else:
            quiz = await store.update_quiz(
                qid, current_index=nxt, question_started_at_ms=now_ms()
            )
    elif action == "end":
        if quiz["status"] not in ("lobby", "active"):
            raise HTTPException(status_code=409, detail="Quiz is not running")
        quiz = await store.update_quiz(qid, status="ended")

    event = {
        "type": "quiz.state",
        "quiz": {
            "status": quiz["status"],
            "current_index": quiz["current_index"],
            "question_started_at_ms": quiz["question_started_at_ms"],
            "total_questions": len(questions),
        },
        "server_now_ms": int(time.time() * 1000),
    }
    await hub.broadcast_quiz(qid, event)
    await hub.broadcast_admin(qid, event)
    return {"quiz": quiz}


@router.get("/quizzes/{qid}/live")
async def live(
    qid: str,
    store: Store = Depends(get_store),
    _a: None = Depends(require_admin),
):
    quiz = await store.get_quiz(qid)
    if not quiz:
        raise HTTPException(status_code=404, detail="Not found")
    questions = await store.list_questions(qid)
    board, total, _ = await store.leaderboard(qid, limit=50)
    current = None
    if quiz["status"] == "active" and quiz["current_index"] < len(questions):
        q = questions[quiz["current_index"]]
        current = {
            "index": quiz["current_index"],
            "text": q["text"],
            "options": q["options"],
            "seconds": q["seconds"],
            "correct_index": q["correct_index"],
            "question_started_at_ms": quiz["question_started_at_ms"],
            "answered": await store.answered_count(q["id"]),
        }
    return {
        "quiz": quiz,
        "server_now_ms": int(time.time() * 1000),
        "total_questions": len(questions),
        "participant_count": total,
        "current": current,
        "leaderboard": board,
        "stats": await store.answer_stats(qid),
    }
