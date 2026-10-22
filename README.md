# ⚡ Zuno AI: Intelligent AI Study Companion

> **"See It. Learn It. Know It."**  
> An intelligent full-stack AI study platform inspired by Solvely.ai, featuring step-by-step multi-modal problem solving, a synchronized live whiteboard tutor, academic study suites, and LaTeX mathematical derivations.

---

## 🌟 Key Features

1. **🔲 Multi-Modal Step-by-Step Solver**
   - Instant derivations for Mathematics, Physics, Geometry, Algebra, Chemistry, and Code.
   - Beautiful academic mathematical formula rendering powered by KaTeX.
   - Step-by-step logical explanations with pedagogical tips.
   - Cross-check across reasoning models (`Zuno AI`, `GPT-4o`, `Claude 3.5 Sonnet`, `MathCore`).

2. **🖊️ Live Whiteboard Tutor**
   - Authentic whiteboard learning with no rigid boxes or pre-rendered dumps.
   - Word-by-word typewriter writing synchronized with an active animated pen cursor (`✏️`).
   - Integrated real-time speech narration (`SpeechSynthesis`) with variable speed control (`0.5x` to `2.0x`).
   - Adapts to any tutorial input (LLM Privacy & Ethics, C++ Programming, Geometry, or custom user syllabus notes).

3. **📚 Comprehensive Study Suite**
   - **3D Flashcards**: Interactive concept cards with spaced repetition.
   - **Adaptive Quiz**: Dynamic testing with instant answer validation and explanations.
   - **Comprehensive Study Guide**: Structured academic outlines and takeaways.
   - **AI Audio Podcast**: Two-host deep-dive audio discussions for auditory learners.
   - **AI Writing Tools & Live Lecture Notes**: Academic humanizer, citation generator, and audio transcription.

4. **🎨 Custom Zuno Brand Identity**
   - Official Zuno charcoal (`#1E2235`) and golden yellow (`#F5A623`) brand palette.
   - Dark/Light mode theme switching with dynamic contrast logos.
   - Responsive sidebar with clean, native SaaS layout.

---

## 🏛️ System Architecture

```text
┌────────────────────────────────────────────────────────┐
│                      Zuno AI Frontend                   │
│   (index.html • Vanilla JS • KaTeX • SpeechSynthesis)  │
└───────────────────────────┬────────────────────────────┘
                            │
               REST APIs & WebSocket Streams
                            │
┌───────────────────────────▼────────────────────────────┐
│                    FastAPI AI Backend                  │
│       (app/main.py • Multi-Modal Problem Solver)       │
├────────────────────────────────────────────────────────┤
│ • /api/v1/solve/problem  -> LaTeX step-by-step proofs  │
│ • /api/v1/live-notes     -> Real-time audio stream     │
│ • /api/v1/exam-prep      -> Dynamic test generator     │
│ • /api/v1/writing        -> Academic writing engine    │
└────────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start

### 1. Prerequisites
- Python 3.10+
- Modern Web Browser (Microsoft Edge, Google Chrome, Safari, Firefox)

### 2. Start the Frontend Web Server
```powershell
# Run the dual-stack Uvicorn web server (supports localhost and 127.0.0.1)
python serve_8080.py
```
*Access the frontend at:* **`http://localhost:8080/#/home`**

### 3. Start the AI Backend API
```powershell
cd backend
# Create virtual environment and install dependencies
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt

# Launch FastAPI server
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
*Access the Swagger API Documentation at:* **`http://localhost:8000/docs`**

---

## 📁 Repository Structure

```text
.
├── index.html              # Main Zuno AI single-page application
├── serve_8080.py           # Production dual-stack (IPv4/IPv6) static server
├── zuno-logo.png           # High-resolution transparent Zuno brand logo
├── zuno-logo-dark.png      # High-contrast white/gold logo for dark mode
├── backend/
│   ├── app/
│   │   ├── main.py         # FastAPI application entry point
│   │   ├── routers/        # API route handlers (solver, writing, notes)
│   │   ├── services/       # AI problem resolution engine
│   │   ├── database.py     # Database session & models
│   │   └── schemas.py      # Pydantic data schemas
│   └── requirements.txt    # Python backend dependencies
└── README.md
```

---

## 📄 License
MIT License. Created for Zuno AI.
