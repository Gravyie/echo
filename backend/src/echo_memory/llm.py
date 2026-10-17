"""OpenAI-compatible chat client (Groq by default) with model fallback."""

from __future__ import annotations

import json
import logging
import re
from typing import Any

from .config import settings

log = logging.getLogger(__name__)
_client = None


def available() -> bool:
    return bool(settings().api_key)


def client():
    global _client
    if _client is None:
        from openai import OpenAI

        _client = OpenAI(api_key=settings().api_key, base_url=settings().llm_base_url, timeout=45, max_retries=1)
    return _client


def chat(messages: list[dict], tools: list[dict] | None = None, json_mode: bool = False,
         temperature: float = 0.2, max_tokens: int = 1400) -> Any:
    """One completion. Tries the primary model, then the fallback model."""
    s = settings()
    last: Exception | None = None
    for model in dict.fromkeys([s.llm_model, s.llm_fallback_model]):
        try:
            kw: dict[str, Any] = {"model": model, "messages": messages, "temperature": temperature,
                                  "max_tokens": max_tokens}
            if tools:
                kw["tools"] = tools
                kw["tool_choice"] = "auto"
            if json_mode:
                kw["response_format"] = {"type": "json_object"}
            return client().chat.completions.create(**kw).choices[0].message
        except Exception as e:  # rate limit, model retired, tool-call parse error...
            log.warning("LLM call failed on %s: %s", model, e)
            last = e
    raise RuntimeError(f"LLM unavailable: {last}")


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
