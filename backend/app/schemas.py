from datetime import datetime
from typing import List, Optional, Dict, Any, Union
from pydantic import BaseModel, Field

# --- Solver Schemas ---

class SolveRequest(BaseModel):
    prompt: str = Field(..., description="Problem description, text query, or LaTeX formula")
    mode: Optional[str] = Field("solver", description="Mode: 'solver', 'whiteboard', or 'flashcards'")
    image_base64: Optional[str] = Field(None, description="Optional base64 encoded image string")
    subject: Optional[str] = Field("Mathematics", description="Subject area")

class StepDetail(BaseModel):
    step_number: int
    title: str
    formula_latex: str
    explanation: str
    tip: Optional[str] = None

class CanvasNodeData(BaseModel):
    id: str
    type: str  # STEP, FORMULA, GRAPH, DIAGRAM, SUMMARY
    title: str
    content: str
    x: float
    y: float
    width: float = 320.0
    height: float = 200.0
    color: str = "emerald"
    params: Optional[Dict[str, Any]] = None

class CanvasEdgeData(BaseModel):
    id: str
    from_node: str
    to_node: str
    label: Optional[str] = None
    style: Optional[str] = "curved"

class VisualizationData(BaseModel):
    nodes: List[CanvasNodeData] = []
    edges: List[CanvasEdgeData] = []
    graph_equation: Optional[str] = None
    default_zoom: float = 0.9

class SolveResponse(BaseModel):
    latex_solution: str
    step_by_step: List[StepDetail]
    visualization_data: VisualizationData
    related_concepts: List[str]
    summary: str
    execution_time_ms: float = 0.0

# --- Live Notes Schemas ---

class LiveNoteMessage(BaseModel):
    type: str  # 'transcript', 'note_update', 'ping', 'error'
    text: Optional[str] = None
    is_final: Optional[bool] = False
    timestamp_ms: Optional[int] = 0
    notes: Optional[str] = None
    summary: Optional[str] = None
    diagram: Optional[str] = None

class LiveNoteSessionCreate(BaseModel):
    title: str = "Live Lecture Notes"

class LiveNoteSessionResponse(BaseModel):
    id: str
    title: str
    status: str
    duration_seconds: int
    raw_transcript: str
    formatted_notes: str
    created_at: datetime

    class Config:
        from_attributes = True

# --- Exam Prep Schemas ---

class StudyPlanDay(BaseModel):
    day: int
    focus: str
    hours: float
    topics: List[str]
    tasks: List[str]

class ExamTopicPrediction(BaseModel):
    topic: str
    likelihood_percentage: int
    importance: str  # 'CRITICAL', 'HIGH', 'MEDIUM'
    expected_question_type: str  # 'Long Derivation', 'Multiple Choice', 'Problem Solving'
    key_concepts: List[str]

class MockExamQuestion(BaseModel):
    id: int
    question: str
    options: List[str]
    correct_option: int
    explanation: str
    marks: int
    topic: str

class ExamPrepResponse(BaseModel):
    filename: str
    page_count: int
    study_plan: List[StudyPlanDay]
    exam_predictions: List[ExamTopicPrediction]
    mock_exam: List[MockExamQuestion]
    summary: str

class GradeMockRequest(BaseModel):
    answers: Dict[str, int]
    questions: List[MockExamQuestion]

class GradeMockResponse(BaseModel):
    total_score: int
    max_score: int
    percentage: float
    feedback: List[Dict[str, Any]]

# --- Writing Suite Schemas ---

class HumanizeRequest(BaseModel):
    text: str
    tone: Optional[str] = "academic"
    readability_level: Optional[str] = "college"

class HumanizeResponse(BaseModel):
    original_text: str
    humanized_text: str
    readability_score: float
    perplexity_score: float
    word_count: int

class SentenceAnalysis(BaseModel):
    sentence: str
    ai_probability: float
    perplexity: float
    is_flagged: bool

class AIDetectorRequest(BaseModel):
    text: str

class AIDetectorResponse(BaseModel):
    overall_ai_score: float
    verdict: str  # "Human Written", "Likely AI-Generated", "Mixed / AI-Assisted"
    burstiness_score: float
    perplexity_score: float
    sentence_breakdown: List[SentenceAnalysis]

class PlagiarismRequest(BaseModel):
    text: str

class PlagiarismMatch(BaseModel):
    matched_text: str
    similarity_percentage: float
    source_title: str
    source_url: Optional[str] = None

class PlagiarismResponse(BaseModel):
    originality_score: float
    similarity_score: float
    matches: List[PlagiarismMatch]
    total_sources_checked: int

class CitationRequest(BaseModel):
    source_type: str = "journal"  # journal, book, website, paper
    title: str
    authors: List[str]
    year: Optional[str] = "2024"
    publisher: Optional[str] = None
    url: Optional[str] = None
    style: Optional[str] = "apa7"  # apa7, mla9, chicago, harvard

class CitationResponse(BaseModel):
    style: str
    formatted_citation: str
    in_text_citation: str
    bibtex: str

class GrammarIssue(BaseModel):
    original_phrase: str
    replacement: str
    explanation: str
    type: str  # 'spelling', 'grammar', 'style', 'clarity'
    start_index: int
    end_index: int

class GrammarRequest(BaseModel):
    text: str

class GrammarResponse(BaseModel):
    corrected_text: str
    issues: List[GrammarIssue]
    readability_score: float
    total_corrections: int

# --- Canvas Whiteboard Schemas ---

class CanvasStateSaveRequest(BaseModel):
    title: str = "Lesson Canvas"
    zoom: float = 1.0
    pan_x: float = 0.0
    pan_y: float = 0.0
    nodes: List[Dict[str, Any]] = []
    edges: List[Dict[str, Any]] = []

class CanvasStateResponse(BaseModel):
    id: str
    title: str
    zoom: float
    pan_x: float
    pan_y: float
    nodes: List[Dict[str, Any]]
    edges: List[Dict[str, Any]]
    updated_at: datetime
