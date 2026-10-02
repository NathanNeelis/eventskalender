from pathlib import Path
from urllib.parse import quote_plus

from pydantic_settings import BaseSettings, SettingsConfigDict

ENV_FILE = Path(__file__).resolve().parents[2] / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ENV_FILE, extra="ignore")

    mongodb_host: str = "localhost"
    mongodb_port: int = 27017
    mongodb_database: str = "events"
    mongodb_username: str | None = None
    mongodb_password: str | None = None

    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]
    colleague_seed_count: int = 30

    @property
    def mongodb_uri(self) -> str:
        auth = ""
        if self.mongodb_username:
            auth = quote_plus(self.mongodb_username)
            if self.mongodb_password:
                auth += ":" + quote_plus(self.mongodb_password)
            auth += "@"
        query = "?authSource=admin" if self.mongodb_username else ""
        return f"mongodb://{auth}{self.mongodb_host}:{self.mongodb_port}/{query}"


settings = Settings()
