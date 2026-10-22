from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.database import get_db
from app.auth import decode_access_token
from app import models

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def get_current_user(
    token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)
) -> models.User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    payload = decode_access_token(token)
    if payload is None:
        raise credentials_exception
    user_id = payload.get("sub")
    if user_id is None:
        raise credentials_exception
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if user is None:
        raise credentials_exception
    return user


def require_student(user: models.User = Depends(get_current_user)) -> models.User:
    if user.role != models.UserRole.student:
        raise HTTPException(status_code=403, detail="Student account required")
    return user


def require_hr(user: models.User = Depends(get_current_user)) -> models.User:
    if user.role != models.UserRole.hr:
        raise HTTPException(status_code=403, detail="HR account required")
    return user


def get_owned_project(project_id: str, user: models.User, db: Session) -> models.Project:
    """
    Row-level ownership check, enforced in the app layer to mirror what DB-level
    RLS policies would do in Postgres/Supabase (see infra/rls_policies.sql).
    """
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.owner_id != user.id:
        raise HTTPException(status_code=403, detail="You do not own this project")
    return project
