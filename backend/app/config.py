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

    # Local LLM for the chat agent
    ollama_url: str = "http://localhost:11434"
    ollama_model: str = "gpt-oss:20b"
    ollama_think: str = "low"  # gpt-oss reasoning effort: low / medium / high
    ollama_num_ctx: int = 16384
    timezone: str = "Europe/Amsterdam"

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
