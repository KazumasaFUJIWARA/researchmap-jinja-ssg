"""Load optional local env file and expose secret/config helpers for updater scripts."""

import os
from pathlib import Path

_ENV_LOADED = False


def load_env() -> None:
    global _ENV_LOADED
    if _ENV_LOADED:
        return
    env_path = Path(__file__).parent / ".env"
    if env_path.exists():
        for line in env_path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))
    _ENV_LOADED = True


def get_openalex_mailto() -> str:
    load_env()
    return os.environ.get("OPENALEX_MAILTO", "mypage-updater/1.0")


def get_researchmap_api_key() -> str | None:
    load_env()
    return os.environ.get("RESEARCHMAP_API_KEY") or None
