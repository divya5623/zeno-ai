"""
Builds the final evidence report. Deliberately NOT a single LLM call that
"scores the repo" — it's a deterministic rollup of the per-question,
per-evidence evaluations already produced by answer_eval.py, with the LLM
used only to write short, evidence-cited skill labels/rationales from that
already-verified structured data.
"""
import json
from app.llm.provider import get_llm_client

STATUS_RANK = {
    "Demonstrated": 3,
    "Partially Demonstrated": 2,
    "Needs Review": 1,
    "Not Verified From Available Evidence": 0,
}

SYSTEM_PROMPT = """You write a skill evidence summary from already-verified, structured \
assessment data (questions, grounded code symbols, and their evaluation statuses). Do not \
re-judge correctness — the statuses are final. Your job is only to group related evidence into \
named skill areas (e.g. "API design (FastAPI)", "Error handling", "Test coverage") and write a \
short, factual rationale citing the evidence.

Never use "expert", "cheater", or claim automatic hiring decisions or that any line was detected \
as AI-generated. Use only these status words: Demonstrated, Partially Demonstrated, Needs Review, \
Not Verified From Available Evidence, Evidence Available (for evidence with no assessment yet), \
Assessment Pending.

Respond with ONLY valid JSON:
{"skill_summary": [{"skill": "...", "status": "...", "evidence": ["symbol_id", ...], "rationale": "..."}],
 "overall_notes": "1-2 factual sentences, no overall score or verdict"}
"""


def generate_evidence_report(evidence: dict, questions: list[dict]) -> dict:
    structured_input = {
        "dependencies": [d["name"] for d in evidence.get("dependencies", [])][:20],
        "test_execution": evidence.get("test_execution", {}),
        "endpoint_count": len(evidence.get("endpoints", [])),
        "function_count": len(evidence.get("functions", [])),
        "questions": [
            {
                "text": q["text"],
                "grounded_in": q["grounded_in"],
                "status": (q.get("evaluation") or {}).get("status", "Assessment Pending"),
                "rationale": (q.get("evaluation") or {}).get("rationale", ""),
            }
            for q in questions
            if not q.get("rejected")
        ],
    }

    client = get_llm_client()
    try:
        result = client.complete_json(
            SYSTEM_PROMPT,
            json.dumps(structured_input)[:12000],
            max_tokens=1500,
        )
    except ValueError:
        result = _fallback_report(structured_input)

    skill_summary = result.get("skill_summary") or []
    if not skill_summary:
        result = _fallback_report(structured_input)

    return result


def _fallback_report(structured_input: dict) -> dict:
    """Deterministic, evidence-cited fallback if the LLM call fails — never
    silently returns nothing."""
    summary = []
    for q in structured_input["questions"]:
        summary.append({
            "skill": q["text"][:60],
            "status": q["status"],
            "evidence": q["grounded_in"],
            "rationale": q["rationale"] or "No rationale recorded.",
        })
    return {
        "skill_summary": summary,
        "overall_notes": "Automated summary generation was unavailable; showing per-question "
                          "evidence directly.",
    }
