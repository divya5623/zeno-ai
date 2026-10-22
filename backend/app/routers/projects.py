from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session

from app.database import get_db, SessionLocal
from app import models, schemas
from app.deps import require_student, get_current_user, get_owned_project
from app.analysis import github_fetcher, ast_analyzer, sandbox

router = APIRouter(prefix="/projects", tags=["projects"])


@router.post("", response_model=schemas.ProjectOut, status_code=201)
def submit_project(
    payload: schemas.ProjectCreate,
    background_tasks: BackgroundTasks,
    user: models.User = Depends(require_student),
    db: Session = Depends(get_db),
):
    project = models.Project(owner_id=user.id, github_url=payload.github_url,
                              status=models.ProjectStatus.pending)
    db.add(project)
    db.commit()
    db.refresh(project)

    background_tasks.add_task(run_analysis_pipeline, project.id)
    return project


@router.get("", response_model=list[schemas.ProjectOut])
def list_my_projects(user: models.User = Depends(require_student), db: Session = Depends(get_db)):
    return (
        db.query(models.Project)
        .filter(models.Project.owner_id == user.id)
        .order_by(models.Project.created_at.desc())
        .all()
    )


@router.get("/{project_id}", response_model=schemas.ProjectOut)
def get_project(project_id: str, user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    # Students may only view their own project; HR viewing is via /hr/candidates/{id}
    if user.role == models.UserRole.student and project.owner_id != user.id:
        raise HTTPException(status_code=403, detail="You do not own this project")
    return project


@router.get("/{project_id}/evidence", response_model=schemas.CodeEvidenceOut)
def get_evidence(project_id: str, user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if user.role == models.UserRole.student and project.owner_id != user.id:
        raise HTTPException(status_code=403, detail="You do not own this project")
    if not project.evidence:
        raise HTTPException(status_code=404, detail="Analysis not yet complete")
    return project.evidence


def run_analysis_pipeline(project_id: str):
    """
    Runs out-of-request (BackgroundTasks for MVP; swap for a real job queue —
    Celery/RQ — before production so a server restart can't drop an
    in-flight analysis).
    """
    db: Session = SessionLocal()
    try:
        project = db.query(models.Project).filter(models.Project.id == project_id).first()
        if not project:
            return

        project.status = models.ProjectStatus.fetching
        db.commit()

        fetch_result = github_fetcher.fetch_repo(project.github_url)
        if not fetch_result.success:
            project.status = models.ProjectStatus.failed
            project.error_message = fetch_result.error
            db.commit()
            return

        project.repo_name = fetch_result.repo_name
        project.status = models.ProjectStatus.analyzing
        db.commit()

        try:
            analysis = ast_analyzer.analyze_repo(fetch_result.local_path)

            if analysis.file_count == 0:
                project.status = models.ProjectStatus.failed
                project.error_message = "No Python files found. SkillBridge MVP supports Python projects only."
                db.commit()
                return

            sandbox_result = sandbox.run_tests_in_sandbox(fetch_result.local_path, analysis.test_files)

            evidence = models.CodeEvidence(
                project_id=project.id,
                file_count=analysis.file_count,
                total_lines=analysis.total_lines,
                languages=analysis.languages,
                dependencies=analysis.dependencies,
                functions=analysis.functions,
                classes=analysis.classes,
                endpoints=analysis.endpoints,
                test_files=analysis.test_files,
                test_execution={
                    "ran": sandbox_result.ran,
                    "passed": sandbox_result.passed,
                    "failed": sandbox_result.failed,
                    "timed_out": sandbox_result.timed_out,
                    "output": sandbox_result.output[-2000:],
                },
                imports_summary=analysis.imports_summary,
                raw_snippets=analysis.raw_snippets,
            )
            db.add(evidence)

            assessment = models.Assessment(project_id=project.id, status=models.AssessmentStatus.not_started)
            db.add(assessment)

            project.status = models.ProjectStatus.analyzed
            project.analyzed_at = datetime.utcnow()
            db.commit()
        finally:
            github_fetcher.cleanup(fetch_result.local_path)

    except Exception as e:
        project.status = models.ProjectStatus.failed
        project.error_message = f"Analysis failed: {e}"
        db.commit()
    finally:
        db.close()
