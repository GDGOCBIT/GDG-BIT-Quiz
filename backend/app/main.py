import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from .auth import verify_admin_token, verify_participant_token
from .config import get_settings
from .db import Store
from .deps import get_hub, get_store
from .routers import admin as admin_router
from .routers import play as play_router
from .schemas import AnswerSubmit
from .scoring import server_points
from .ws_hub import RoomHub, recv_json_with_timeout


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    store = Store(settings.database_url)
    await store.connect()
    app.state.store = store
    app.state.hub = RoomHub()
    yield
    await store.close()


def create_app():
    settings = get_settings()
    app = FastAPI(
        title="QuizLive API",
        version="1.0.0",
        description=(
            "Live quiz competition backend — bulk-load questions once, "
            "score client-side, sync over WebSockets."
        ),
        lifespan=lifespan,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_list(),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(admin_router.router)
    app.include_router(play_router.router)

    @app.get("/healthz", tags=["ops"])
    async def healthz():
        return {"ok": True, "server_now_ms": int(time.time() * 1000)}

    @app.websocket("/ws/play")
    async def ws_play(ws: WebSocket):
        await ws.accept()
        store: Store = ws.app.state.store
        hub: RoomHub = ws.app.state.hub
        try:
            hello = await recv_json_with_timeout(ws, 5.0)
            token = (hello or {}).get("token", "")
            if (hello or {}).get("type") != "hello" or not token:
                await ws.close(code=4401, reason="auth required")
                return
            claims = verify_participant_token(token)
            me = await store.get_participant(claims["pid"]) if claims else None
            if not me or (claims and me["quiz_id"] != claims["qid"]):
                await ws.close(code=4401, reason="invalid token")
                return

            hub.join_quiz(me["quiz_id"], ws)
            board, total, _ = await store.leaderboard(me["quiz_id"], limit=10)
            fresh = await store.get_participant(me["id"])
            await hub.send(
                ws,
                {
                    "type": "welcome",
                    "me": {
                        "score": fresh["score"],
                        "rank": await store.rank_of(me["quiz_id"], fresh["score"]),
                    },
                    "top10": board,
                    "total_participants": total,
                    "server_now_ms": int(time.time() * 1000),
                },
            )

            while True:
                try:
                    msg = await ws.receive_json()
                except WebSocketDisconnect:
                    break
                except Exception:
                    continue
                if not isinstance(msg, dict):
                    continue

                kind = msg.get("type")

                if kind == "ping":
                    await hub.send(
                        ws,
                        {
                            "type": "pong",
                            "server_now_ms": int(time.time() * 1000),
                        },
                    )

                elif kind in ("answer.submit", "sync"):
                    subs = msg.get("answers", [msg.get("answer", msg)])
                    if isinstance(subs, dict):
                        subs = [subs]

                    results = []
                    questions = await store.list_questions(me["quiz_id"])

                    for raw in subs[:50]:
                        try:
                            sub = AnswerSubmit.model_validate(
                                {
                                    "question_id": raw.get("question_id", ""),
                                    "choice": raw.get("choice", 0),
                                    "ms_taken": raw.get("ms_taken"),
                                    "points": raw.get("points", 0),
                                }
                            )
                        except Exception:
                            continue

                        q = next(
                            (x for x in questions if x["id"] == sub.question_id), None
                        )
                        if q is None or sub.choice >= len(q["options"]):
                            continue

                        is_correct = sub.choice == q["correct_index"]
                        pts = (
                            server_points(q["seconds"], sub.ms_taken, sub.points)
                            if is_correct
                            else 0
                        )
                        stored, accepted = await store.record_answer(
                            me["id"],
                            q["id"],
                            sub.choice,
                            is_correct,
                            pts,
                            sub.ms_taken or 0,
                        )
                        me = await store.get_participant(me["id"])
                        results.append(
                            {
                                "question_id": q["id"],
                                "accepted": accepted,
                                "correct": bool(stored["is_correct"]),
                                "points": stored["points"],
                                "my_score": me["score"],
                            }
                        )

                        if accepted:
                            b2, t2, _ = await store.leaderboard(me["quiz_id"], limit=10)
                            ev = {
                                "type": "leaderboard.update",
                                "top10": b2,
                                "total_participants": t2,
                                "server_now_ms": int(time.time() * 1000),
                            }
                            await hub.broadcast_quiz(me["quiz_id"], ev)
                            await hub.broadcast_admin(me["quiz_id"], ev)

                    fresh = await store.get_participant(me["id"])
                    await hub.send(
                        ws,
                        {
                            "type": "answer.result",
                            "results": results,
                            "my_score": fresh["score"],
                        },
                    )

                elif kind == "leaderboard.get":
                    b3, t3, _ = await store.leaderboard(me["quiz_id"], limit=10)
                    me3 = await store.get_participant(me["id"])
                    await hub.send(
                        ws,
                        {
                            "type": "leaderboard.update",
                            "top10": b3,
                            "total_participants": t3,
                            "my_score": me3["score"],
                            "server_now_ms": int(time.time() * 1000),
                        },
                    )

        finally:
            hub.leave(ws)

    @app.websocket("/ws/admin/{quiz_id}")
    async def ws_admin(ws: WebSocket, quiz_id: str):
        await ws.accept()
        hub: RoomHub = ws.app.state.hub
        try:
            hello = await recv_json_with_timeout(ws, 5.0)
            token = (hello or {}).get("token", "")
            if (hello or {}).get("type") != "hello" or not verify_admin_token(token):
                await ws.close(code=4401, reason="admin auth required")
                return
            hub.join_admin(quiz_id, ws)
            await hub.send(
                ws,
                {
                    "type": "welcome",
                    "server_now_ms": int(time.time() * 1000),
                },
            )
            while True:
                try:
                    await ws.receive_text()
                except WebSocketDisconnect:
                    break
                except Exception:
                    continue
        finally:
            hub.leave(ws)

    return app


app = create_app()
