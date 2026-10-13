import asyncio
import os

import asyncpg
import pytest

DATABASE_URL: str = os.environ.get(
    "DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5432/quizlive",
)


@pytest.fixture(scope="session", autouse=True)
def set_test_env():
    os.environ.setdefault("DATABASE_URL", DATABASE_URL)
    os.environ.setdefault("AUTH_SECRET", "test-secret-0123456789abcdef-test")
    os.environ.setdefault("ADMIN_PASSWORD", "test-admin")


@pytest.fixture(autouse=True)
async def clean_tables():
    conn = await asyncpg.connect(DATABASE_URL)
    try:
        from pathlib import Path

        schema = (Path(__file__).parent.parent / "schema.sql").read_text()
        await conn.execute(schema)
        await conn.execute(
            "TRUNCATE TABLE answers, participants, questions, quizzes CASCADE"
        )
    finally:
        await conn.close()
