from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.deps import require_hr

router = APIRouter(prefix="/hr", tags=["hr"])


@router.get("/candidates", response_model=list[schemas.CandidateListItem])
def list_candidates(user: models.User = Depends(require_hr), db: Session = Depends(get_db)):
    """
    HR sees only students who have a completed (or in-progress) assessment —
    i.e. candidates who have actually submitted evidence, never an open roster
    of every student account.
    """
    projects = (
        db.query(models.Project)
        .filter(models.Project.status == models.ProjectStatus.analyzed)
        .all()
    )
    out = []
    for p in projects:
        student = p.owner
        assessment_status = p.assessment.status.value if p.assessment else "not_started"
        top_skills = []
        if p.assessment and p.assessment.report:
            top_skills = [
                s["skill"] for s in p.assessment.report.skill_summary
                if s.get("status") == "Demonstrated"
            ][:3]
        out.append(schemas.CandidateListItem(
            student_id=student.id,
            full_name=student.full_name,
            email=student.email,
            project_id=p.id,
            repo_name=p.repo_name,
            project_status=p.status.value,
            assessment_status=assessment_status,
            top_skills=top_skills,
        ))
    return out


@router.get("/candidates/{project_id}/evidence", response_model=schemas.CodeEvidenceOut)
def candidate_evidence(project_id: str, user: models.User = Depends(require_hr), db: Session = Depends(get_db)):
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project or not project.evidence:
        raise HTTPException(status_code=404, detail="Evidence not found")
    return project.evidence


@router.get("/candidates/{project_id}/report", response_model=schemas.EvidenceReportOut)
def candidate_report(project_id: str, user: models.User = Depends(require_hr), db: Session = Depends(get_db)):
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project or not project.assessment or not project.assessment.report:
        raise HTTPException(status_code=404, detail="Evidence report not yet available for this candidate")
    return project.assessment.report


@router.get("/candidates/{project_id}/assessment", response_model=schemas.AssessmentOut)
def candidate_assessment(project_id: str, user: models.User = Depends(require_hr), db: Session = Depends(get_db)):
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project or not project.assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")
    visible = [q for q in project.assessment.questions if not q.rejected]
    project.assessment.questions = visible
    return project.assessment


@router.post("/invite", status_code=201)
def invite_candidate(payload: schemas.InviteRequest, user: models.User = Depends(require_hr), db: Session = Depends(get_db)):
    project = db.query(models.Project).filter(models.Project.id == payload.project_id).first()
    if not project or project.owner_id != payload.student_id:
        raise HTTPException(status_code=404, detail="Candidate project not found")

    invitation = models.InterviewInvitation(
        hr_user_id=user.id,
        student_id=payload.student_id,
        project_id=payload.project_id,
        message=payload.message,
    )
    db.add(invitation)
    db.commit()
    return {"status": "sent", "invitation_id": invitation.id}
