from typing import Literal

from pydantic import BaseModel, Field


class QuizCreate(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    description: str = Field(default="", max_length=300)


class QuestionCreate(BaseModel):
    text: str = Field(min_length=1, max_length=500)
    options: list[str] = Field(min_length=2, max_length=4)
    correct_index: int = Field(ge=0, le=3)
    seconds: Literal[10, 20, 30] = 20


class QuestionBulk(BaseModel):
    questions: list[QuestionCreate] = Field(min_length=1, max_length=200)


class ControlAction(BaseModel):
    action: Literal["open", "start", "next", "end"]


class AdminLogin(BaseModel):
    password: str = Field(min_length=1)


class JoinRequest(BaseModel):
    code: str = Field(min_length=4, max_length=10)
    name: str = Field(min_length=1, max_length=40)
    stream: str = Field(min_length=1, max_length=40)


class AnswerSubmit(BaseModel):
    question_id: str
    choice: int = Field(ge=0, le=3)

    ms_taken: int | None = Field(default=None, ge=0, le=3_600_000)

    points: int = Field(default=0, ge=0, le=150)
    is_correct: bool | None = None


class SyncRequest(BaseModel):
    answers: list[AnswerSubmit] = Field(min_length=1, max_length=50)
