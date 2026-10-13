from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql://postgres:postgres@localhost:5432/quizlive"

    auth_secret: str = "change-me-to-a-32-char-random-string"

    admin_password: str = "change-me"

    cors_origins: str = "*"

    def cors_list(self):
        if self.cors_origins.strip() == "*":
            return ["*"]
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings():
    return Settings()
