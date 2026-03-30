#!/usr/bin/env python3
"""
BookStack API validation utility for SLOW MVP.

Validates:
- token auth
- pages listing
- keyword search
- basic tag-filtered search strategy using query composition
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import Dict, Tuple
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen


def load_env_file(path: Path) -> Dict[str, str]:
    env: Dict[str, str] = {}
    if not path.exists():
        return env
    for line in path.read_text().splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        env[key.strip()] = value.strip()
    return env


def get_config() -> Tuple[str, str, str]:
    env_file_values = load_env_file(Path(".env"))
    app_url = os.getenv("APP_URL", env_file_values.get("APP_URL", "http://localhost:6875")).rstrip("/")
    token_id = os.getenv("BOOKSTACK_API_TOKEN_ID", env_file_values.get("BOOKSTACK_API_TOKEN_ID", ""))
    token_secret = os.getenv(
        "BOOKSTACK_API_TOKEN_SECRET",
        env_file_values.get("BOOKSTACK_API_TOKEN_SECRET", ""),
    )
    if not token_id or not token_secret:
        raise ValueError("Missing BOOKSTACK_API_TOKEN_ID or BOOKSTACK_API_TOKEN_SECRET in .env")
    return app_url, token_id, token_secret


def call_json(url: str, token_id: str, token_secret: str) -> dict:
    headers = {
        "Authorization": f"Token {token_id}:{token_secret}",
        "Content-Type": "application/json",
    }
    req = Request(url=url, headers=headers, method="GET")
    with urlopen(req, timeout=20) as response:
        raw = response.read().decode("utf-8")
        return json.loads(raw)


def run() -> int:
    try:
        app_url, token_id, token_secret = get_config()
    except ValueError as err:
        print(f"[ERROR] {err}")
        return 1

    checks = [
        ("List resources", f"{app_url}/api/pages?count=10"),
        ("Keyword search", f"{app_url}/api/search?{urlencode({'query': 'resource'})}"),
        (
            "Tag strategy filter (country/category/type)",
            f"{app_url}/api/search?{urlencode({'query': 'country:\"Sierra Leone\" category:savings type:document'})}",
        ),
    ]

    print("==> BookStack API validation")
    for label, url in checks:
        try:
            payload = call_json(url, token_id, token_secret)
            count = len(payload.get("data", []))
            print(f"[OK] {label}: returned {count} records")
        except HTTPError as err:
            print(f"[ERROR] {label}: HTTP {err.code}")
            return 1
        except URLError as err:
            print(f"[ERROR] {label}: {err.reason}")
            return 1
        except Exception as err:  # defensive for malformed payloads
            print(f"[ERROR] {label}: {err}")
            return 1

    print("==> Validation passed")
    return 0


if __name__ == "__main__":
    sys.exit(run())
