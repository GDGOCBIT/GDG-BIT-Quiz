import json
import secrets
import time
import uuid
from pathlib import Path

import asyncpg

CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"


def generate_join_code():
    return "".join(secrets.choice(CODE_ALPHABET) for _ in range(6))


def now_ms():
    return int(time.time() * 1000)


def new_id():
    return uuid.uuid4().hex


SCHEMA_PATH = Path(__file__).resolve().parent.parent / "schema.sql"


class Store:
    def __init__(self, database_url: str):
        self.database_url = database_url
        self._pool: asyncpg.Pool | None = None

    async def connect(self):
        self._pool = await asyncpg.create_pool(
            self.database_url,
            min_size=2,
            max_size=10,
            statement_cache_size=0,
        )

        async with self._pool.acquire() as conn:
            await conn.execute(SCHEMA_PATH.read_text())

    async def close(self):
        if self._pool:
            await self._pool.close()
            self._pool = None

    @property
    def pool(self):
        assert self._pool is not None, "Store.connect() was not called"
        return self._pool

    async def _fetchrow(self, sql: str, *args):
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(sql, *args)
            return dict(row) if row else None

    async def _fetch(self, sql: str, *args):
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(sql, *args)
            return [dict(r) for r in rows]

    async def _execute(self, sql: str, *args):
        async with self.pool.acquire() as conn:
            await conn.execute(sql, *args)

    async def _fetchval(self, sql: str, *args):
        async with self.pool.acquire() as conn:
            return await conn.fetchval(sql, *args)

    @staticmethod
    def _question(row: dict):
        d = dict(row)
        d["options"] = json.loads(d.pop("options_json"))
        return d

    async def create_quiz(self, title: str, description: str = ""):
        for _ in range(5):
            qid, code = new_id(), generate_join_code()
            try:
                await self._execute(
                    "INSERT INTO quizzes"
                    "(id,join_code,title,description,status,"
                    " current_index,question_started_at_ms,created_at_ms)"
                    " VALUES($1,$2,$3,$4,'draft',0,NULL,$5)",
                    qid,
                    code,
                    title,
                    description,
                    now_ms(),
                )
                return await self.get_quiz(qid)
            except asyncpg.UniqueViolationError:
                continue
        raise RuntimeError("Could not allocate a unique join code — try again")

    async def get_quiz(self, qid: str):
        return await self._fetchrow("SELECT * FROM quizzes WHERE id=$1", qid)

    async def get_quiz_by_code(self, code: str):
        return await self._fetchrow(
            "SELECT * FROM quizzes WHERE join_code=$1", code.upper()
        )

    async def list_quizzes(self):
        return await self._fetch(
            "SELECT q.*,"
            " (SELECT COUNT(*) FROM questions    WHERE quiz_id=q.id) AS question_count,"
            " (SELECT COUNT(*) FROM participants WHERE quiz_id=q.id) AS participant_count"
            " FROM quizzes q ORDER BY q.created_at_ms DESC"
        )

    async def update_quiz(self, qid: str, **fields):
        allowed = {
            "status",
            "current_index",
            "question_started_at_ms",
            "title",
            "description",
        }
        sets = [(k, v) for k, v in fields.items() if k in allowed]
        if sets:
            cols = ", ".join(f"{k}=${i + 1}" for i, (k, _) in enumerate(sets))
            vals = [v for _, v in sets]
            await self._execute(
                f"UPDATE quizzes SET {cols} WHERE id=${len(sets) + 1}",
                *vals,
                qid,
            )
        return await self.get_quiz(qid)

    async def delete_quiz(self, qid: str):
        await self._execute("DELETE FROM quizzes WHERE id=$1", qid)

    async def add_question(
        self,
        quiz_id: str,
        text: str,
        options: list[str],
        correct_index: int,
        seconds: int,
    ):
        pos = (
            await self._fetchval(
                "SELECT COALESCE(MAX(position), -1) FROM questions WHERE quiz_id=$1",
                quiz_id,
            )
        ) + 1
        qid = new_id()
        await self._execute(
            "INSERT INTO questions"
            "(id,quiz_id,position,text,options_json,correct_index,seconds)"
            " VALUES($1,$2,$3,$4,$5,$6,$7)",
            qid,
            quiz_id,
            pos,
            text,
            json.dumps(options),
            correct_index,
            seconds,
        )
        return await self.get_question(qid)

    async def get_question(self, qid: str):
        row = await self._fetchrow("SELECT * FROM questions WHERE id=$1", qid)
        return self._question(row) if row else None

    async def list_questions(self, quiz_id: str):
        rows = await self._fetch(
            "SELECT * FROM questions WHERE quiz_id=$1 ORDER BY position ASC",
            quiz_id,
        )
        return [self._question(r) for r in rows]

    async def delete_question(self, qid: str):
        await self._execute("DELETE FROM questions WHERE id=$1", qid)

    async def join_quiz(self, quiz_id: str, name: str, stream: str):
        dupes = await self._fetchval(
            "SELECT COUNT(*) FROM participants"
            " WHERE quiz_id=$1 AND LOWER(name)=LOWER($2)",
            quiz_id,
            name,
        )
        display = f"{name} ({int(dupes) + 1})" if dupes else name
        pid = new_id()
        await self._execute(
            "INSERT INTO participants(id,quiz_id,name,stream,score,created_at_ms)"
            " VALUES($1,$2,$3,$4,0,$5)",
            pid,
            quiz_id,
            display,
            stream,
            now_ms(),
        )
        return await self.get_participant(pid)

    async def get_participant(self, pid: str):
        return await self._fetchrow("SELECT * FROM participants WHERE id=$1", pid)

    async def participant_count(self, quiz_id: str):
        return int(
            await self._fetchval(
                "SELECT COUNT(*) FROM participants WHERE quiz_id=$1", quiz_id
            )
        )

    async def record_answer(
        self,
        participant_id: str,
        question_id: str,
        choice: int,
        is_correct: bool,
        points: int,
        ms_taken: int,
    ):
        aid = new_id()
        accepted = True

        async with self.pool.acquire() as conn:
            try:
                async with conn.transaction():
                    await conn.execute(
                        "INSERT INTO answers"
                        "(id,participant_id,question_id,choice,"
                        " is_correct,points,ms_taken,answered_at_ms)"
                        " VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
                        aid,
                        participant_id,
                        question_id,
                        choice,
                        is_correct,
                        points if is_correct else 0,
                        ms_taken,
                        now_ms(),
                    )
            except asyncpg.UniqueViolationError:
                accepted = False

            stored = dict(
                await conn.fetchrow(
                    "SELECT * FROM answers WHERE participant_id=$1 AND question_id=$2",
                    participant_id,
                    question_id,
                )
            )

            if accepted and stored["is_correct"]:
                await conn.execute(
                    "UPDATE participants SET score = score + $1 WHERE id=$2",
                    stored["points"],
                    participant_id,
                )

        return stored, accepted

    async def get_answer(self, participant_id: str, question_id: str):
        return await self._fetchrow(
            "SELECT * FROM answers WHERE participant_id=$1 AND question_id=$2",
            participant_id,
            question_id,
        )

    async def leaderboard(self, quiz_id: str, limit: int = 10):
        rows = await self._fetch(
            "SELECT id,name,stream,score FROM participants"
            " WHERE quiz_id=$1 ORDER BY score DESC, created_at_ms ASC LIMIT $2",
            quiz_id,
            limit,
        )

        rank, last = 0, None
        board: list[dict] = []
        for i, p in enumerate(rows):
            if last is None or p["score"] != last:
                rank = i + 1
                last = p["score"]
            board.append({**p, "rank": rank})
        total = await self.participant_count(quiz_id)
        return board, total, {}

    async def rank_of(self, quiz_id: str, score: int):
        better = await self._fetchval(
            "SELECT COUNT(*) FROM participants WHERE quiz_id=$1 AND score>$2",
            quiz_id,
            score,
        )
        return int(better) + 1

    async def answer_stats(self, quiz_id: str):
        return await self._fetch(
            "SELECT a.question_id,"
            "       COUNT(*) AS total,"
            "       SUM(CASE WHEN a.is_correct THEN 1 ELSE 0 END) AS correct"
            " FROM answers a"
            " JOIN participants p ON p.id = a.participant_id"
            " WHERE p.quiz_id=$1"
            " GROUP BY a.question_id",
            quiz_id,
        )

    async def answered_count(self, question_id: str):
        return int(
            await self._fetchval(
                "SELECT COUNT(*) FROM answers WHERE question_id=$1", question_id
            )
        )
