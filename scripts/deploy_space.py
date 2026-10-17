"""Deploy the Echo API (FalkorDB embedded) to a free Hugging Face Docker Space.

    hf auth login                                   # once, with a write token
    cd backend && uv run python ../scripts/deploy_space.py [space-name]

Reads GROQ_API_KEY from ../.env and stores it as a Space secret. Prints the API URL.
"""

import os
import sys
import tempfile
from pathlib import Path

from huggingface_hub import HfApi

ROOT = Path(__file__).resolve().parent.parent
BACKEND = ROOT / "backend"

SPACE_README = """---
title: Echo memory API
emoji: 🔁
colorFrom: yellow
colorTo: gray
sdk: docker
app_port: 7860
pinned: false
short_description: Agent memory on FalkorDB that counts independent origins
---

The API behind Echo (FalkorDB embedded in the container). Health: `/api/health`, MCP: `/mcp/`.
Source and docs: see the GitHub repository linked from the Echo site.
"""


def env_value(key: str) -> str | None:
    if os.environ.get(key):
        return os.environ[key]
    env = ROOT / ".env"
    if env.exists():
        for line in env.read_text().splitlines():
            if line.startswith(f"{key}="):
                return line.split("=", 1)[1].strip() or None
    return None


def main() -> None:
    name = sys.argv[1] if len(sys.argv) > 1 else "echo-memory"
    api = HfApi()
    user = api.whoami()["name"]
    repo = f"{user}/{name}"
    api.create_repo(repo, repo_type="space", space_sdk="docker", exist_ok=True)

    secrets = {"GROQ_API_KEY": env_value("GROQ_API_KEY")}
    for k in ("LLM_MODEL", "LLM_FALLBACK_MODEL"):
        if env_value(k):
            secrets[k] = env_value(k)
    for k, v in secrets.items():
        if v:
            api.add_space_secret(repo, k, v)

    with tempfile.TemporaryDirectory() as tmp:
        (Path(tmp) / "README.md").write_text(SPACE_README)
        api.upload_folder(
            repo_id=repo,
            repo_type="space",
            folder_path=str(BACKEND),
            ignore_patterns=[".venv/*", "**/__pycache__/*", "*.pyc", "eval_results.json", ".env", "README.md"],
            commit_message="Deploy Echo API",
        )
        api.upload_file(path_or_fileobj=str(Path(tmp) / "README.md"), path_in_repo="README.md",
                        repo_id=repo, repo_type="space", commit_message="Space card")

    host = f"https://{user.lower()}-{name.lower()}.hf.space"
    print(f"Space: https://huggingface.co/spaces/{repo}")
    print(f"API:   {host}   (first build takes a few minutes; check {host}/api/health)")


if __name__ == "__main__":
    main()
