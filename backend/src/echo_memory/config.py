"""Runtime settings, read from the environment (and .env when present)."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=(".env", "../.env"), extra="ignore")

    # FalkorDB. FALKORDB_URL wins when set (e.g. falkor://user:pass@host:port for FalkorDB Cloud).
    falkordb_url: str | None = None
    falkordb_host: str = "localhost"
    falkordb_port: int = 6379
    falkordb_password: str | None = None
    graph_prefix: str = "echo"

    # LLM: any OpenAI-compatible endpoint. Defaults to Groq.
    groq_api_key: str | None = None
    llm_api_key: str | None = None
    llm_base_url: str = "https://api.groq.com/openai/v1"
    llm_model: str = "openai/gpt-oss-120b"
    llm_fallback_model: str = "llama-3.3-70b-versatile"

    # Embeddings run locally (fastembed / ONNX). Falls back to hashed bag-of-words.
    embed_model: str = "BAAI/bge-small-en-v1.5"
    embed_dim: int = 384
    disable_fastembed: bool = False

    # Scoring knobs.
    verify_min_origins: int = 2
    max_lineage_depth: int = 8

    cors_origins: str = "*"
    seed_on_start: bool = True
    allow_live_fetch: bool = True

    @property
    def api_key(self) -> str | None:
        return self.llm_api_key or self.groq_api_key


@lru_cache
def settings() -> Settings:
    return Settings()
