import io
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from typing import Optional
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas import ExamPrepResponse, GradeMockRequest, GradeMockResponse
from app.services.ai_engine import ai_engine

router = APIRouter(prefix="/api/v1/exam-prep", tags=["Exam Prep & RAG"])

@router.post("/upload", response_model=ExamPrepResponse)
async def upload_exam_material(
    file: UploadFile = File(...),
    subject: Optional[str] = Form("General STEM"),
    db: Session = Depends(get_db)
):
    """
    Ingest syllabus, past papers, or lecture slides (PDF, DOCX, TXT).
    Extracts text, builds knowledge chunks, and returns an adaptive Study Plan,
    High-Yield Exam Topic Predictions, and interactive Mock Exams.
    """
    filename = file.filename or "uploaded_study_material.pdf"
    content_bytes = await file.read()
    extracted_text = ""
    page_count = 1

    # Extract text if PDF using PyMuPDF (fitz)
    if filename.lower().endswith(".pdf"):
        try:
            import fitz  # PyMuPDF
            doc = fitz.open(stream=content_bytes, filetype="pdf")
            page_count = len(doc)
            pages_text = [page.get_text() for page in doc]
            extracted_text = "\n".join(pages_text)
        except Exception as e:
            print(f"[ExamPrep] PyMuPDF extraction failed: {e}")
            extracted_text = content_bytes.decode("utf-8", errors="ignore")
    else:
        extracted_text = content_bytes.decode("utf-8", errors="ignore")

    if not extracted_text.strip():
        extracted_text = f"Syllabus on {subject}: Fundamental theorems, problem sets, and derivations."

    response = ai_engine.generate_exam_prep(
        filename=filename,
        text_content=extracted_text,
        page_count=page_count
    )

    return response

@router.post("/grade-mock", response_model=GradeMockResponse)
async def grade_mock_exam(req: GradeMockRequest):
    """
    Grades user answers against the mock exam questions,
    providing score calculation, percentage, and rationale.
    """
    total_score = 0
    max_score = sum(q.marks for q in req.questions)
    feedback = []

    for q in req.questions:
        user_choice = req.answers.get(str(q.id))
        is_correct = (user_choice == q.correct_option)
        earned = q.marks if is_correct else 0
        total_score += earned

        feedback.append({
            "question_id": q.id,
            "user_choice": user_choice,
            "correct_option": q.correct_option,
            "is_correct": is_correct,
            "marks_awarded": earned,
            "explanation": q.explanation
        })

    pct = round((total_score / max_score) * 100, 1) if max_score > 0 else 0.0

    return GradeMockResponse(
        total_score=total_score,
        max_score=max_score,
        percentage=pct,
        feedback=feedback
    )
