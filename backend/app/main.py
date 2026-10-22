import time
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import Base, engine
from app.config import settings
from app.routers import solver, live_notes, exam_prep, writing, canvas, studysets

# Create database tables automatically
try:
    Base.metadata.create_all(bind=engine)
    print("[Database] Schema tables initialized successfully.")
except Exception as e:
    print(f"[Database] Warning: Table creation deferred: {e}")

app = FastAPI(
    title="Solvely AI Study Platform API",
    description=(
        "Production AI Backend for Solvely.ai. Powers multi-modal problem solving, "
        "real-time Whisper speech-to-text audio streaming, dynamic n8n-style whiteboard canvas generation, "
        "RAG-based exam prep, and the comprehensive AI writing suite."
    ),
    version="1.0.0"
)

# Configure CORS for seamless frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(solver.router)
app.include_router(live_notes.router)
app.include_router(exam_prep.router)
app.include_router(writing.router)
app.include_router(canvas.router)
app.include_router(studysets.router)

@app.get("/")
def root():
    return {
        "status": "online",
        "service": "Solvely AI Study Platform API",
        "version": "1.0.0",
        "docs_url": "/docs",
        "endpoints": {
            "solver": "/api/v1/solve",
            "live_notes_ws": "ws://localhost:8000/api/v1/live-notes/stream",
            "exam_prep": "/api/v1/exam-prep/upload",
            "writing_humanize": "/api/v1/writing/humanize",
            "writing_ai_detector": "/api/v1/writing/ai-detector",
            "writing_plagiarism": "/api/v1/writing/plagiarism-checker",
            "writing_citations": "/api/v1/writing/citation-generator",
            "writing_grammar": "/api/v1/writing/grammar-checker",
            "canvas": "/api/v1/canvas",
            "studysets": "/api/v1/studysets"
        }
    }

@app.get("/api/v1/health")
def health_check():
    return {
        "status": "healthy",
        "timestamp": int(time.time()),
        "environment": settings.ENVIRONMENT,
        "database": "connected"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=settings.HOST, port=settings.PORT, reload=True)
