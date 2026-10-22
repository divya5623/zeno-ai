import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Float, Boolean, DateTime, Text, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.database import Base

def gen_uuid():
    return str(uuid.uuid4())

class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    email = Column(String(255), unique=True, index=True, nullable=False)
    name = Column(String(255), nullable=True)
    hashed_password = Column(String(255), nullable=False)
    tier = Column(String(50), default="FREE")  # FREE, PRO, ENTERPRISE
    quota_remaining = Column(Integer, default=50)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    study_sets = relationship("StudySet", back_populates="user", cascade="all, delete-orphan")
    whiteboards = relationship("CanvasWhiteboard", back_populates="user", cascade="all, delete-orphan")
    live_sessions = relationship("LiveNoteSession", back_populates="user", cascade="all, delete-orphan")
    documents = relationship("Document", back_populates="user", cascade="all, delete-orphan")

class StudySet(Base):
    __tablename__ = "study_sets"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    topic = Column(String(255), nullable=False)
    type = Column(String(50), nullable=False, index=True)  # FLASHCARDS, QUIZ, STUDY_GUIDE, EXAM_PREDICTOR
    payload = Column(JSON, nullable=False)  # JSON cards, quiz questions, or study roadmap
    is_public = Column(Boolean, default=False)
    view_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="study_sets")

class CanvasWhiteboard(Base):
    __tablename__ = "canvas_whiteboards"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), default="Untitled Lesson")
    zoom_level = Column(Float, default=1.0)
    pan_x = Column(Float, default=0.0)
    pan_y = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="whiteboards")
    nodes = relationship("CanvasNode", back_populates="whiteboard", cascade="all, delete-orphan")
    edges = relationship("CanvasEdge", back_populates="whiteboard", cascade="all, delete-orphan")

class CanvasNode(Base):
    __tablename__ = "canvas_nodes"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    whiteboard_id = Column(String(36), ForeignKey("canvas_whiteboards.id", ondelete="CASCADE"), nullable=False, index=True)
    node_type = Column(String(50), nullable=False)  # STEP, FORMULA, GRAPH, DIAGRAM, CALLOUT, SUMMARY
    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)
    pos_x = Column(Float, default=0.0)
    pos_y = Column(Float, default=0.0)
    width = Column(Float, default=320.0)
    height = Column(Float, default=200.0)
    color_theme = Column(String(50), default="emerald")
    parameters = Column(JSON, nullable=True)  # Interactive graph sliders or equations
    order_index = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    whiteboard = relationship("CanvasWhiteboard", back_populates="nodes")

class CanvasEdge(Base):
    __tablename__ = "canvas_edges"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    whiteboard_id = Column(String(36), ForeignKey("canvas_whiteboards.id", ondelete="CASCADE"), nullable=False, index=True)
    source_node_id = Column(String(36), nullable=False)
    target_node_id = Column(String(36), nullable=False)
    label = Column(String(255), nullable=True)
    style = Column(String(50), default="curved")

    whiteboard = relationship("CanvasWhiteboard", back_populates="edges")

class Document(Base):
    __tablename__ = "documents"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    filename = Column(String(255), nullable=False)
    file_type = Column(String(50), nullable=False)
    file_size = Column(Integer, default=0)
    storage_path = Column(String(500), nullable=False)
    page_count = Column(Integer, default=1)
    processed = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="documents")
    chunks = relationship("DocumentChunk", back_populates="document", cascade="all, delete-orphan")

class DocumentChunk(Base):
    __tablename__ = "document_chunks"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    document_id = Column(String(36), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)
    chunk_index = Column(Integer, nullable=False)
    page_number = Column(Integer, nullable=True)
    text_content = Column(Text, nullable=False)
    token_count = Column(Integer, default=0)
    embedding = Column(JSON, nullable=True)  # Stored as JSON array or vector

    document = relationship("Document", back_populates="chunks")

class LiveNoteSession(Base):
    __tablename__ = "live_note_sessions"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), default="Live Lecture Notes")
    status = Column(String(50), default="RECORDING")  # RECORDING, PROCESSING, COMPLETED
    duration_seconds = Column(Integer, default=0)
    raw_transcript = Column(Text, default="")
    formatted_notes = Column(Text, default="")
    key_concepts = Column(JSON, nullable=True)
    diagram_svg = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="live_sessions")
    transcript_chunks = relationship("TranscriptChunk", back_populates="session", cascade="all, delete-orphan")

class TranscriptChunk(Base):
    __tablename__ = "transcript_chunks"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    session_id = Column(String(36), ForeignKey("live_note_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    timestamp_ms = Column(Integer, default=0)
    speaker = Column(String(100), default="Lecturer")
    text = Column(Text, nullable=False)
    confidence = Column(Float, default=0.95)
    is_final = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    session = relationship("LiveNoteSession", back_populates="transcript_chunks")
