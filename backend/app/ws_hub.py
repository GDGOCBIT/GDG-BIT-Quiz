import asyncio
import json
import logging

from fastapi import WebSocket

log = logging.getLogger(__name__)


class RoomHub:
    def __init__(self):
        self.quiz_rooms: dict[str, set[WebSocket]] = {}
        self.admin_rooms: dict[str, set[WebSocket]] = {}

    def join_quiz(self, quiz_id: str, ws: WebSocket):
        self.quiz_rooms.setdefault(quiz_id, set()).add(ws)

    def join_admin(self, quiz_id: str, ws: WebSocket):
        self.admin_rooms.setdefault(quiz_id, set()).add(ws)

    def leave(self, ws: WebSocket):
        for room in (self.quiz_rooms, self.admin_rooms):
            for members in room.values():
                members.discard(ws)

    async def send(self, ws: WebSocket, event: dict):
        try:
            await ws.send_text(json.dumps(event))
        except Exception:
            self.leave(ws)

    async def broadcast_quiz(self, quiz_id: str, event: dict):
        dead: list[WebSocket] = []
        for ws in list(self.quiz_rooms.get(quiz_id, set())):
            try:
                await ws.send_text(json.dumps(event))
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.leave(ws)

    async def broadcast_admin(self, quiz_id: str, event: dict):
        dead: list[WebSocket] = []
        for ws in list(self.admin_rooms.get(quiz_id, set())):
            try:
                await ws.send_text(json.dumps(event))
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.leave(ws)


async def recv_json_with_timeout(ws: WebSocket, timeout_s: float = 5.0):
    try:
        raw = await asyncio.wait_for(ws.receive_text(), timeout=timeout_s)
    except (asyncio.TimeoutError, Exception):
        return None
    try:
        msg = json.loads(raw)
    except ValueError:
        return None
    return msg if isinstance(msg, dict) else None
