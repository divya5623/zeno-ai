"""
Provider-independent LLM client. Every other module in app/llm/ talks to
`LLMClient.complete_json(...)` — nothing else in the codebase imports a
vendor SDK directly. Swapping providers means editing only this file.
"""
import json
import abc
from app.config import get_settings

settings = get_settings()


class LLMClient(abc.ABC):
    @abc.abstractmethod
    def complete_json(self, system: str, user: str, max_tokens: int = 1500) -> dict:
        """Send a prompt, return parsed JSON. Raises ValueError on bad output."""
        ...


class AnthropicClient(LLMClient):
    def __init__(self):
        import anthropic
        self._client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

    def complete_json(self, system: str, user: str, max_tokens: int = 1500) -> dict:
        resp = self._client.messages.create(
            model=settings.llm_model,
            max_tokens=max_tokens,
            system=system,
            messages=[{"role": "user", "content": user}],
        )
        text = "".join(block.text for block in resp.content if block.type == "text")
        return _parse_json_response(text)


class MockClient(LLMClient):
    """
    Deterministic stand-in used for local dev / hackathon demo without API keys.
    It still respects the grounding contract (real symbol ids pulled from the
    evidence digest embedded in the prompt) so the demo flow works end-to-end
    without a real LLM configured — just with generic question text.
    """

    def complete_json(self, system: str, user: str, max_tokens: int = 1500) -> dict:
        if "follow-up" in system.lower() or "follow_up" in system.lower():
            return {"follow_up": None}
        if "generate" in system.lower() and "question" in system.lower():
            ids = _extract_symbol_ids(user)[:3]
            if not ids:
                return {"questions": []}
            questions = [
                {
                    "text": f"Walk through what `{sid.split(':')[1]}` in {sid.split(':')[2]} "
                             "does and why you implemented it that way. "
                             "(Mock question — set ANTHROPIC_API_KEY for real, adaptive questions.)",
                    "grounded_in": [sid],
                }
                for sid in ids
            ]
            return {"questions": questions}
        if "evaluate" in system.lower():
            return {
                "status": "Needs Review",
                "rationale": "Mock evaluation — configure a real LLM provider for grounded scoring.",
                "confidence": 0.0,
            }
        return {"skill_summary": [], "overall_notes": "Mock report — configure a real LLM provider."}


def _extract_symbol_ids(prompt_text: str) -> list[str]:
    """Pull `"id": "function:..."` style values out of the embedded evidence JSON."""
    import re
    return re.findall(r'"id":\s*"((?:function|class|endpoint):[^"]+)"', prompt_text)


def _parse_json_response(text: str) -> dict:
    text = text.strip()
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
    try:
        return json.loads(text.strip())
    except json.JSONDecodeError as e:
        raise ValueError(f"LLM did not return valid JSON: {e}\nRaw: {text[:500]}")


def get_llm_client() -> LLMClient:
    if settings.llm_provider == "anthropic" and settings.anthropic_api_key:
        return AnthropicClient()
    return MockClient()
