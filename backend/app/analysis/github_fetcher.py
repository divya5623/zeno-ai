"""
Fetches a public GitHub repo to a temp directory for analysis.

Security notes:
- The repo is untrusted input. We never `exec`/`import` anything from it in
  this process. We only read file bytes and parse them with Python's `ast`
  module (parse-only, no execution) in ast_analyzer.py.
- Clone is shallow (depth=1) and size-capped to avoid resource exhaustion.
- Only .py files (plus a short allowlist of manifest files) are read.
"""
import os
import shutil
import tempfile
import subprocess
from dataclasses import dataclass
from urllib.parse import urlparse

from app.config import get_settings

settings = get_settings()

ALLOWED_MANIFESTS = {"requirements.txt", "pyproject.toml", "setup.py", "Pipfile"}


@dataclass
class FetchResult:
    success: bool
    local_path: str = ""
    repo_name: str = ""
    error: str = ""


def parse_github_url(url: str) -> tuple[str, str]:
    parsed = urlparse(url)
    if parsed.netloc.lower() != "github.com":
        raise ValueError("Not a github.com URL")
    parts = [p for p in parsed.path.split("/") if p]
    if len(parts) < 2:
        raise ValueError("URL must be github.com/<owner>/<repo>")
    owner, repo = parts[0], parts[1].removesuffix(".git")
    return owner, repo


def fetch_repo(github_url: str) -> FetchResult:
    try:
        owner, repo = parse_github_url(github_url)
    except ValueError as e:
        return FetchResult(success=False, error=str(e))

    clone_url = f"https://github.com/{owner}/{repo}.git"
    tmp_dir = tempfile.mkdtemp(prefix="skillbridge_repo_")

    try:
        proc = subprocess.run(
            ["git", "clone", "--depth", "1", "--single-branch", clone_url, tmp_dir],
            capture_output=True,
            text=True,
            timeout=60,
        )
        if proc.returncode != 0:
            shutil.rmtree(tmp_dir, ignore_errors=True)
            return FetchResult(success=False, error=f"Clone failed: {proc.stderr[:300]}")

        # Enforce size cap
        total_size = sum(
            os.path.getsize(os.path.join(dp, f))
            for dp, _, files in os.walk(tmp_dir)
            for f in files
        )
        if total_size > settings.max_repo_size_mb * 1024 * 1024:
            shutil.rmtree(tmp_dir, ignore_errors=True)
            return FetchResult(
                success=False,
                error=f"Repository exceeds {settings.max_repo_size_mb}MB limit for MVP analysis",
            )

        # Strip .git to remove hooks/history — we never need them and they're
        # an unnecessary attack surface to have sitting on disk.
        shutil.rmtree(os.path.join(tmp_dir, ".git"), ignore_errors=True)

        return FetchResult(success=True, local_path=tmp_dir, repo_name=f"{owner}/{repo}")
    except subprocess.TimeoutExpired:
        shutil.rmtree(tmp_dir, ignore_errors=True)
        return FetchResult(success=False, error="Clone timed out")
    except Exception as e:
        shutil.rmtree(tmp_dir, ignore_errors=True)
        return FetchResult(success=False, error=f"Unexpected error: {e}")


def cleanup(local_path: str):
    shutil.rmtree(local_path, ignore_errors=True)
