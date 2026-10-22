from fastapi import APIRouter, HTTPException
from app.schemas import (
    HumanizeRequest, HumanizeResponse,
    AIDetectorRequest, AIDetectorResponse,
    PlagiarismRequest, PlagiarismResponse,
    CitationRequest, CitationResponse,
    GrammarRequest, GrammarResponse
)
from app.services.ai_engine import ai_engine

router = APIRouter(prefix="/api/v1/writing", tags=["AI Writing Suite"])

@router.post("/humanize", response_model=HumanizeResponse)
async def humanize(req: HumanizeRequest):
    """
    Rewrites formulaic AI text with organic syntax variations, high burstiness,
    and academic rhythm to bypass AI detectors while maintaining rigor.
    """
    return ai_engine.humanize_text(text=req.text, tone=req.tone or "academic")

@router.post("/ai-detector", response_model=AIDetectorResponse)
async def detect_ai(req: AIDetectorRequest):
    """
    Evaluates perplexity, burstiness, and sentence probability distributions
    to output an AI likelihood score and sentence highlights.
    """
    return ai_engine.detect_ai(text=req.text)

@router.post("/plagiarism-checker", response_model=PlagiarismResponse)
async def check_plagiarism(req: PlagiarismRequest):
    """
    Cross-checks text against academic indexes using n-gram overlap and semantic vectors.
    """
    return ai_engine.check_plagiarism(text=req.text)

@router.post("/citation-generator", response_model=CitationResponse)
async def generate_citation(req: CitationRequest):
    """
    Generates bibliographic citations in APA 7, MLA 9, Chicago 17, Harvard, and BibTeX.
    """
    return ai_engine.generate_citations(req=req)

@router.post("/grammar-checker", response_model=GrammarResponse)
async def check_grammar(req: GrammarRequest):
    """
    Detects grammatical errors, homophone issues, and offers conciseness enhancements.
    """
    return ai_engine.check_grammar(text=req.text)
