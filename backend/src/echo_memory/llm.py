"""OpenAI-compatible chat client with model fallback, and bring-your-own-model support.

The server has a default model (Groq's free tier). A visitor can instead pick a provider, model and key in
the studio; those arrive as request headers, are used for that request only, and are never stored or logged.
"""

from __future__ import annotations

import json
import logging
import re
import time
from dataclasses import dataclass
from typing import Any
from urllib.parse import urlsplit

from .config import settings

log = logging.getLogger(__name__)

# Providers with an OpenAI-compatible chat endpoint. `models` are suggestions; any model id works.
PROVIDERS: dict[str, dict[str, Any]] = {
    "groq": {"label": "Groq", "base": "https://api.groq.com/openai/v1", "keys": "https://console.groq.com/keys",
             "models": ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "qwen/qwen3.8-27b"]},
    "openai": {"label": "OpenAI", "base": "https://api.openai.com/v1", "keys": "https://platform.openai.com/api-keys",
               "models": []},
    "anthropic": {"label": "Anthropic", "base": "https://api.anthropic.com/v1/", "keys": "https://console.anthropic.com/settings/keys",
                  "models": ["claude-sonnet-5-5", "claude-haiku-5-5", "claude-opus-5-5"]},
    "gemini": {"label": "Google Gemini", "base": "https://generativelanguage.googleapis.com/v1beta/openai/",
               "keys": "https://aistudio.google.com/apikey", "models": []},
    "openrouter": {"label": "OpenRouter", "base": "https://openrouter.ai/api/v1", "keys": "https://openrouter.ai/keys",
                   "models": []},
    "nvidia": {"label": "NVIDIA NIM", "base": "https://integrate.api.nvidia.com/v1", "keys": "https://build.nvidia.com",
               "models": []},
    "together": {"label": "Together AI", "base": "https://api.together.xyz/v1", "keys": "https://api.together.ai/settings/api-keys",
                 "models": []},
    "custom": {"label": "Any OpenAI-compatible endpoint", "base": "", "keys": "", "models": []},
}


@dataclass(frozen=True)
class LLMConfig:
    base_url: str
    api_key: str | None
    model: str
    fallback: str | None = None
    provider: str = "echo"

    @property
    def label(self) -> str:
        return self.model


def default() -> LLMConfig:
    s = settings()
    return LLMConfig(base_url=s.llm_base_url, api_key=s.api_key, model=s.llm_model, fallback=s.llm_fallback_model)


class ConfigError(ValueError):
    pass


def _check_base(url: str) -> None:
    """A user-supplied endpoint must be public https (no reaching into our own network)."""
    from .fetch import FetchError, _check_host

    p = urlsplit(url)
    if p.scheme != "https":
        raise ConfigError("the endpoint must use https")
    try:
        _check_host(url)
    except FetchError as e:
        raise ConfigError(str(e)) from e


def from_headers(headers: Any) -> LLMConfig:
    """The studio's model choice, from X-Echo-LLM-* headers. No headers: the server default."""
    provider = (headers.get("x-echo-llm-provider") or "").strip().lower()
    if not provider or provider == "echo":
        return default()
    if provider not in PROVIDERS:
        raise ConfigError(f"unknown provider {provider!r}")
    key = (headers.get("x-echo-llm-key") or "").strip() or None
    model = (headers.get("x-echo-llm-model") or "").strip()
    base = PROVIDERS[provider]["base"] or (headers.get("x-echo-llm-base") or "").strip()
    if provider == "custom":
        if not base:
            raise ConfigError("give the endpoint's base URL")
        _check_base(base)
    if not key:
        raise ConfigError(f"add your {PROVIDERS[provider]['label']} API key")
    if not model:
        model = (PROVIDERS[provider]["models"] or [""])[0]
    if not model:
        raise ConfigError("choose a model")
    return LLMConfig(base_url=base, api_key=key, model=model, provider=provider)


def available(cfg: LLMConfig | None = None) -> bool:
    return bool((cfg or default()).api_key)


_clients: dict[tuple[str, str], Any] = {}


def client(cfg: LLMConfig):
    from openai import OpenAI

    k = (cfg.base_url, cfg.api_key or "")
    if k not in _clients:
        if len(_clients) > 64:  # bring-your-own keys: don't keep many clients around
            _clients.clear()
        _clients[k] = OpenAI(api_key=cfg.api_key, base_url=cfg.base_url, timeout=45, max_retries=1)
    return _clients[k]


def chat(messages: list[dict], tools: list[dict] | None = None, json_mode: bool = False,
         temperature: float = 0.2, max_tokens: int = 1400, cfg: LLMConfig | None = None) -> Any:
    """One completion. Tries the configured model, then its fallback."""
    cfg = cfg or default()
    last: Exception | None = None
    for model in dict.fromkeys(m for m in [cfg.model, cfg.fallback] if m):
        try:
            kw: dict[str, Any] = {"model": model, "messages": messages, "temperature": temperature,
                                  "max_tokens": max_tokens}
            if tools:
                kw["tools"] = tools
                kw["tool_choice"] = "auto"
            if "gpt-oss" in model and "groq.com" in cfg.base_url:  # reasoning models: keep tool loops snappy
                kw["extra_body"] = {"reasoning_effort": "low"}
            if json_mode:
                kw["response_format"] = {"type": "json_object"}
            return client(cfg).chat.completions.create(**kw).choices[0].message
        except Exception as e:  # rate limit, model retired, tool-call parse error...
            log.warning("LLM call failed on %s (%s): %s", model, cfg.provider, type(e).__name__)
            last = e
    raise RuntimeError(f"LLM unavailable: {_clean(last)}")


def _clean(e: Exception | None) -> str:
    """Error text for the UI, with anything that looks like a key removed."""
    msg = str(e or "unknown error")
    msg = re.sub(r"(sk|gsk|nvapi|AIza|sk-ant|sk-or)[-_A-Za-z0-9]{8,}", "[key]", msg)
    return msg[:300]


def test(cfg: LLMConfig) -> dict[str, Any]:
    t0 = time.time()
    try:
        msg = chat([{"role": "user", "content": "Reply with the single word: ready"}], max_tokens=40, cfg=cfg)
        return {"ok": True, "model": cfg.model, "ms": int((time.time() - t0) * 1000), "reply": (msg.content or "").strip()[:40]}
    except Exception as e:  # noqa: BLE001
        return {"ok": False, "model": cfg.model, "error": _clean(e)}


def list_models(cfg: LLMConfig) -> list[str]:
    try:
        return sorted(m.id for m in client(cfg).models.list().data)[:400]
    except Exception as e:  # noqa: BLE001
        raise ConfigError(_clean(e)) from e


def parse_json(text: str) -> Any:
    text = text.strip()
    m = re.search(r"```(?:json)?\s*(.*?)```", text, re.S)
    if m:
        text = m.group(1)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        m = re.search(r"\{.*\}|\[.*\]", text, re.S)
        if m:
            return json.loads(m.group(0))
        raise
