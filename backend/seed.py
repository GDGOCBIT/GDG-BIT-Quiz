import asyncio
import json
import sys

sys.path.insert(0, ".")

from app.config import get_settings
from app.db import Store


async def main(path: str):
    data = json.loads(open(path).read())
    store = Store(get_settings().database_url)
    await store.connect()
    try:
        quiz = await store.create_quiz(data["title"], data.get("description", ""))
        for q in data["questions"]:
            await store.add_question(
                quiz["id"],
                q["text"],
                q["options"],
                q["correct_index"],
                q.get("seconds", 20),
            )
        print(f"title:     {quiz['title']}")
        print(f"quiz id:   {quiz['id']}")
        print(f"join code: {quiz['join_code']}")
        print(f"questions: {len(data['questions'])}")
        print()
        print("Next: open the admin dashboard, find this quiz, and click Open → Start.")
    finally:
        await store.close()


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: uv run seed.py <questions.json>", file=sys.stderr)
        sys.exit(1)
    asyncio.run(main(sys.argv[1]))
