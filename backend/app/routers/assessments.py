from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.deps import require_student, get_current_user
from app.llm import question_gen, answer_eval, report_gen

router = APIRouter(prefix="/assessments", tags=["assessments"])


def _get_owned_assessment(project_id: str, user: models.User, db: Session) -> models.Assessment:
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.owner_id != user.id:
        raise HTTPException(status_code=403, detail="You do not own this project")
    if not project.assessment:
        raise HTTPException(status_code=404, detail="No assessment exists for this project yet")
    return project.assessment


@router.post("/{project_id}/start", response_model=schemas.AssessmentOut)
def start_assessment(project_id: str, user: models.User = Depends(require_student), db: Session = Depends(get_db)):
    assessment = _get_owned_assessment(project_id, user, db)
    project = assessment.project

    if not project.evidence:
        raise HTTPException(status_code=409, detail="Project analysis is not complete yet")

    if assessment.status != models.AssessmentStatus.not_started:
        return assessment

    evidence_dict = _evidence_to_dict(project.evidence)
    generated = question_gen.generate_questions(evidence_dict)

    if not generated:
        raise HTTPException(
            status_code=422,
            detail="Could not generate code-grounded questions from this project's evidence. "
                   "Try a project with more functions/classes, or check the LLM provider config.",
        )

    for i, q in enumerate(generated):
        db.add(models.Question(
            assessment_id=assessment.id,
            sequence=i,
            text=q["text"],
            grounded_in=q["grounded_in"],
        ))
    assessment.status = models.AssessmentStatus.in_progress
    db.commit()
    db.refresh(assessment)
    return assessment


@router.get("/{project_id}", response_model=schemas.AssessmentOut)
def get_assessment(project_id: str, user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if user.role == models.UserRole.student and project.owner_id != user.id:
        raise HTTPException(status_code=403, detail="You do not own this project")
    if not project.assessment:
        raise HTTPException(status_code=404, detail="No assessment exists for this project yet")
    visible_questions = [q for q in project.assessment.questions if not q.rejected]
    project.assessment.questions = visible_questions
    return project.assessment


@router.post("/{project_id}/answer", response_model=schemas.QuestionOut)
def submit_answer(
    project_id: str,
    payload: schemas.AnswerSubmit,
    user: models.User = Depends(require_student),
    db: Session = Depends(get_db),
):
    assessment = _get_owned_assessment(project_id, user, db)
    question = db.query(models.Question).filter(
        models.Question.id == payload.question_id,
        models.Question.assessment_id == assessment.id,
    ).first()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found in this assessment")
    if question.answer_text:
        raise HTTPException(status_code=409, detail="This question has already been answered")

    evidence_dict = _evidence_to_dict(assessment.project.evidence)
    grounded_snippets = {
        sid: evidence_dict.get("raw_snippets", {}).get(sid, "") for sid in question.grounded_in
    }

    evaluation = answer_eval.evaluate_answer(question.text, grounded_snippets, payload.answer_text)

    question.answer_text = payload.answer_text
    question.answer_submitted_at = datetime.utcnow()
    question.evaluation = evaluation
    db.commit()

    # Adaptive follow-up: only for the original question in a chain (avoid infinite chains)
    if not question.is_follow_up:
        follow_up_text = question_gen.generate_follow_up(
            {"text": question.text, "grounded_in": question.grounded_in},
            payload.answer_text,
            evidence_dict,
        )
        if follow_up_text:
            max_seq = max((q.sequence for q in assessment.questions), default=0)
            follow_up = models.Question(
                assessment_id=assessment.id,
                sequence=max_seq + 1,
                text=follow_up_text,
                grounded_in=question.grounded_in,
                is_follow_up=True,
                parent_question_id=question.id,
            )
            db.add(follow_up)
            db.commit()

    db.refresh(question)
    return question


@router.post("/{project_id}/complete", response_model=schemas.EvidenceReportOut)
def complete_assessment(project_id: str, user: models.User = Depends(require_student), db: Session = Depends(get_db)):
    assessment = _get_owned_assessment(project_id, user, db)
    unanswered = [q for q in assessment.questions if not q.rejected and not q.answer_text]
    if unanswered:
        raise HTTPException(status_code=409, detail=f"{len(unanswered)} question(s) still unanswered")

    if assessment.report:
        return assessment.report

    evidence_dict = _evidence_to_dict(assessment.project.evidence)
    questions_dict = [
        {"text": q.text, "grounded_in": q.grounded_in, "evaluation": q.evaluation, "rejected": q.rejected}
        for q in assessment.questions
    ]
    report_data = report_gen.generate_evidence_report(evidence_dict, questions_dict)

    report = models.EvidenceReport(
        assessment_id=assessment.id,
        project_id=assessment.project_id,
        skill_summary=report_data.get("skill_summary", []),
        overall_notes=report_data.get("overall_notes"),
    )
    db.add(report)
    assessment.status = models.AssessmentStatus.completed
    assessment.completed_at = datetime.utcnow()
    db.commit()
    db.refresh(report)
    return report


def _evidence_to_dict(evidence: models.CodeEvidence) -> dict:
    return {
        "dependencies": evidence.dependencies,
        "functions": evidence.functions,
        "classes": evidence.classes,
        "endpoints": evidence.endpoints,
        "test_files": evidence.test_files,
        "test_execution": evidence.test_execution,
        "raw_snippets": evidence.raw_snippets,
    }
