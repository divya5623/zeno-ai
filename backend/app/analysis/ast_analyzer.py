"""
Static analysis engine.

CRITICAL SECURITY PROPERTY: this module only ever calls `ast.parse()` on
submitted source. It never calls `exec`, `eval`, `import_module`, or runs the
file as a subprocess of the API process. Dynamic execution (tests only) is
handled exclusively by sandbox.py, in an isolated subprocess with resource
limits — never here.

Output is a flat, structured `CodeEvidence` dict. This dict — not the raw
repo — is what the LLM ever sees. Every question the LLM later generates
must cite a symbol_id present in this evidence, or it gets rejected
(see llm/question_gen.py).
"""
import ast
import os
import re
from dataclasses import dataclass, field
from typing import Any

from app.config import get_settings

settings = get_settings()

ROUTE_DECORATOR_METHODS = {"get", "post", "put", "delete", "patch", "options", "head"}
IGNORE_DIRS = {".git", "node_modules", "venv", ".venv", "__pycache__", "dist", "build", ".tox"}


def _symbol_id(kind: str, name: str, file: str) -> str:
    return f"{kind}:{name}:{file}"


def _relpath(root: str, path: str) -> str:
    return os.path.relpath(path, root).replace("\\", "/")


def _cyclomatic_complexity(node: ast.AST) -> int:
    """Simple McCabe-style complexity: 1 + count of branching nodes."""
    complexity = 1
    for n in ast.walk(node):
        if isinstance(n, (ast.If, ast.For, ast.While, ast.Try, ast.With,
                           ast.BoolOp, ast.ExceptHandler)):
            complexity += 1
        if isinstance(n, ast.BoolOp):
            complexity += len(n.values) - 1
    return complexity


def _extract_calls(node: ast.AST) -> list[str]:
    calls = []
    for n in ast.walk(node):
        if isinstance(n, ast.Call):
            f = n.func
            if isinstance(f, ast.Name):
                calls.append(f.id)
            elif isinstance(f, ast.Attribute):
                calls.append(f.attr)
    # de-dupe, keep order
    seen = set()
    out = []
    for c in calls:
        if c not in seen:
            seen.add(c)
            out.append(c)
    return out[:25]


def _decorator_name(dec: ast.AST) -> str:
    if isinstance(dec, ast.Call):
        dec = dec.func
    if isinstance(dec, ast.Attribute):
        return dec.attr
    if isinstance(dec, ast.Name):
        return dec.id
    return ""


def _route_from_decorator(dec: ast.AST) -> dict | None:
    """Detect Flask/FastAPI-style @app.get('/path') or @router.post('/path')."""
    if not isinstance(dec, ast.Call):
        return None
    method_name = _decorator_name(dec)
    if method_name.lower() not in ROUTE_DECORATOR_METHODS:
        return None
    path = None
    if dec.args and isinstance(dec.args[0], ast.Constant) and isinstance(dec.args[0].value, str):
        path = dec.args[0].value
    return {"method": method_name.upper(), "path": path or "?"}


@dataclass
class AnalysisOutput:
    file_count: int = 0
    total_lines: int = 0
    languages: dict = field(default_factory=dict)
    dependencies: list = field(default_factory=list)
    functions: list = field(default_factory=list)
    classes: list = field(default_factory=list)
    endpoints: list = field(default_factory=list)
    test_files: list = field(default_factory=list)
    imports_summary: dict = field(default_factory=dict)
    raw_snippets: dict = field(default_factory=dict)
    parse_errors: list = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "file_count": self.file_count,
            "total_lines": self.total_lines,
            "languages": self.languages,
            "dependencies": self.dependencies,
            "functions": self.functions,
            "classes": self.classes,
            "endpoints": self.endpoints,
            "test_files": self.test_files,
            "imports_summary": self.imports_summary,
            "raw_snippets": self.raw_snippets,
        }


def _parse_requirements(root: str) -> list[dict]:
    deps = []
    req_path = os.path.join(root, "requirements.txt")
    if os.path.exists(req_path):
        with open(req_path, "r", errors="ignore") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                m = re.match(r"^([A-Za-z0-9_.\-\[\]]+)\s*([=<>!~]+.*)?$", line)
                if m:
                    deps.append({"name": m.group(1), "version": (m.group(2) or "").strip()})
    pyproject = os.path.join(root, "pyproject.toml")
    if os.path.exists(pyproject) and not deps:
        with open(pyproject, "r", errors="ignore") as f:
            content = f.read()
        for m in re.finditer(r'^\s*"?([A-Za-z0-9_\-]+)"?\s*=\s*"?([\^~>=<0-9.,\s]*)"?', content, re.MULTILINE):
            name = m.group(1)
            if name.lower() in ("python", "name", "version", "description"):
                continue
            deps.append({"name": name, "version": (m.group(2) or "").strip()})
    return deps[:100]


def analyze_repo(root: str) -> AnalysisOutput:
    out = AnalysisOutput()
    out.dependencies = _parse_requirements(root)

    py_files = []
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in IGNORE_DIRS and not d.startswith(".")]
        for fn in filenames:
            if fn.endswith(".py"):
                py_files.append(os.path.join(dirpath, fn))

    py_files = py_files[: settings.max_files_analyzed]
    out.file_count = len(py_files)

    for filepath in py_files:
        rel = _relpath(root, filepath)
        is_test_file = bool(re.search(r"(^|/)tests?(/|_).*\.py$|test_.*\.py$|.*_test\.py$", rel))
        try:
            with open(filepath, "r", errors="ignore") as f:
                source = f.read()
        except OSError:
            continue

        out.total_lines += len(source.splitlines())

        if is_test_file:
            out.test_files.append(rel)

        try:
            tree = ast.parse(source, filename=rel)
        except SyntaxError as e:
            out.parse_errors.append(f"{rel}: {e}")
            continue

        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    top = alias.name.split(".")[0]
                    out.imports_summary[top] = out.imports_summary.get(top, 0) + 1
            elif isinstance(node, ast.ImportFrom) and node.module:
                top = node.module.split(".")[0]
                out.imports_summary[top] = out.imports_summary.get(top, 0) + 1

        for node in ast.walk(tree):
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                # skip test functions from "functions" evidence — they get
                # represented via test_execution instead
                if is_test_file:
                    continue
                sid = _symbol_id("function", node.name, rel)
                fn_evidence = {
                    "id": sid,
                    "name": node.name,
                    "file": rel,
                    "lineno": node.lineno,
                    "args": [a.arg for a in node.args.args],
                    "docstring": (ast.get_docstring(node) or "")[:300],
                    "calls": _extract_calls(node),
                    "complexity": _cyclomatic_complexity(node),
                    "is_async": isinstance(node, ast.AsyncFunctionDef),
                    "decorators": [_decorator_name(d) for d in node.decorator_list],
                }
                out.functions.append(fn_evidence)
                out.raw_snippets[sid] = ast.get_source_segment(source, node) or ""

                for dec in node.decorator_list:
                    route = _route_from_decorator(dec)
                    if route:
                        out.endpoints.append({
                            **route,
                            "file": rel,
                            "function": node.name,
                            "id": _symbol_id("endpoint", f"{route['method']}:{route['path']}", rel),
                        })

            elif isinstance(node, ast.ClassDef):
                sid = _symbol_id("class", node.name, rel)
                methods = [
                    n.name for n in node.body
                    if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef))
                ]
                bases = [b.id for b in node.bases if isinstance(b, ast.Name)]
                cls_evidence = {
                    "id": sid,
                    "name": node.name,
                    "file": rel,
                    "lineno": node.lineno,
                    "methods": methods,
                    "bases": bases,
                    "docstring": (ast.get_docstring(node) or "")[:300],
                }
                out.classes.append(cls_evidence)
                out.raw_snippets[sid] = (ast.get_source_segment(source, node) or "")[:1500]

    out.languages = {"python": out.file_count}
    return out


def build_symbol_index(evidence: dict) -> set[str]:
    """All valid symbol ids a generated question is allowed to cite."""
    ids = set()
    for f in evidence.get("functions", []):
        ids.add(f["id"])
    for c in evidence.get("classes", []):
        ids.add(c["id"])
    for e in evidence.get("endpoints", []):
        ids.add(e["id"])
    return ids
