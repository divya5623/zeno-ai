from fastapi import APIRouter
from typing import List, Dict, Any

router = APIRouter(prefix="/api/v1/studysets", tags=["Study Sets & Flashcards"])

MOCK_STUDY_SETS = [
    {
        "id": "set-pythagoras",
        "title": "Pythagorean Theorem & Trigonometry Fundamentals",
        "topic": "Mathematics",
        "type": "FLASHCARDS",
        "card_count": 8,
        "cards": [
            {"front": "State the Pythagorean Theorem formula.", "back": "$a^2 + b^2 = c^2$, where $c$ is the hypotenuse."},
            {"front": "What is the smallest primitive Pythagorean triple?", "back": "$(3, 4, 5)$."},
            {"front": "How do you derive $\\sin^2(\\theta) + \\cos^2(\\theta) = 1$ from Pythagoras?", "back": "Divide $a^2 + b^2 = c^2$ by $c^2$ to get $(a/c)^2 + (b/c)^2 = 1$."},
            {"front": "Does the Pythagorean Theorem hold in spherical geometry?", "back": "No, it only holds strictly in flat Euclidean geometry."}
        ]
    },
    {
        "id": "set-calculus",
        "title": "Differential Calculus & Derivatives",
        "topic": "Calculus",
        "type": "QUIZ",
        "card_count": 5,
        "cards": [
            {"front": "What is the derivative of $\\ln(x)$?", "back": "$\\frac{1}{x}$ for $x > 0$."},
            {"front": "State the Product Rule for differentiation.", "back": "$\\frac{d}{dx}[u \\cdot v] = u'v + uv'$."}
        ]
    }
]

@router.get("", response_model=List[Dict[str, Any]])
def get_study_sets():
    """
    List user study sets including flashcards, quizzes, and summaries.
    """
    return MOCK_STUDY_SETS
