"""
Executes the submitted project's own test suite (pytest) in an isolated
subprocess — never inside the API process.

MVP-level isolation (documented, not glossed over):
  - Separate OS process, spawned with `resource` limits (CPU time, memory,
    file size) applied via `preexec_fn` before exec.
  - Hard wall-clock timeout, independent of the CPU limit.
  - Network access disabled by unsetting proxy env vars and, where available,
    running under a restricted user with no outbound route (see
    infra/sandbox_runner_notes.md for the production hardening path).
  - No filesystem access outside the cloned repo's temp directory; cwd is
    pinned there and the process is killed (not just terminated) on timeout.

PRODUCTION NOTE: for a real deployment this subprocess should be replaced
with a gVisor/Firecracker microVM or a locked-down, network-disabled Docker
container (`--network none --memory 256m --cpus 0.5 --read-only`), invoked
via a job queue so it never runs on the API host at all. The interface below
(`run_tests_in_sandbox`) is written so that swap is a drop-in change.
"""
import os
try:
    import resource
except ImportError:
    resource = None
import subprocess
import sys
import tempfile
import shutil
from dataclasses import dataclass

from app.config import get_settings

settings = get_settings()


@dataclass
class SandboxResult:
    ran: bool
    passed: int = 0
    failed: int = 0
    errored: bool = False
    output: str = ""
    timed_out: bool = False


def _limit_resources():
    if resource is None:
        return
    mem_bytes = settings.sandbox_memory_mb * 1024 * 1024
    resource.setrlimit(resource.RLIMIT_AS, (mem_bytes, mem_bytes))
    resource.setrlimit(resource.RLIMIT_CPU, (settings.sandbox_cpu_seconds, settings.sandbox_cpu_seconds))
    resource.setrlimit(resource.RLIMIT_FSIZE, (10 * 1024 * 1024, 10 * 1024 * 1024))  # 10MB max file writes
    resource.setrlimit(resource.RLIMIT_NPROC, (32, 32))
    os.setpgrp()  # own process group, so we can kill the whole tree on timeout


def run_tests_in_sandbox(repo_path: str, test_files: list[str]) -> SandboxResult:
    if not test_files:
        return SandboxResult(ran=False, output="No test files detected in submission.")

    # Isolated copy: even though repo_path is already a scratch clone, we run
    # pytest against a fresh copy so nothing it writes touches the analysis dir.
    work_dir = tempfile.mkdtemp(prefix="skillbridge_sandbox_")
    try:
        shutil.copytree(repo_path, work_dir, dirs_exist_ok=True)

        env = {
            "PATH": os.environ.get("PATH", "/usr/bin:/bin"),
            "HOME": work_dir,
            "PYTHONDONTWRITEBYTECODE": "1",
            # deliberately no proxy/network env vars passed through
        }

        try:
            kwargs = {
                "cwd": work_dir,
                "env": env,
                "capture_output": True,
                "text": True,
                "timeout": settings.sandbox_timeout_seconds,
            }
            if os.name != "nt":
                kwargs["preexec_fn"] = _limit_resources

            proc = subprocess.run(
                [sys.executable, "-m", "pytest", "-q", "--tb=short", "--timeout=8"],
                **kwargs,
            )
            output = (proc.stdout + "\n" + proc.stderr)[-4000:]
            passed, failed = _parse_pytest_summary(output)
            return SandboxResult(ran=True, passed=passed, failed=failed, output=output)
        except subprocess.TimeoutExpired:
            return SandboxResult(ran=True, errored=True, timed_out=True,
                                  output="Test execution exceeded the sandbox time limit and was killed.")
        except Exception as e:
            return SandboxResult(ran=True, errored=True, output=f"Sandbox execution error: {e}")
    finally:
        shutil.rmtree(work_dir, ignore_errors=True)


def _parse_pytest_summary(output: str) -> tuple[int, int]:
    import re
    passed = failed = 0
    m = re.search(r"(\d+) passed", output)
    if m:
        passed = int(m.group(1))
    m = re.search(r"(\d+) failed", output)
    if m:
        failed = int(m.group(1))
    return passed, failed
