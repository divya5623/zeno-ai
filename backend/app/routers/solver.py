import base64
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from typing import Optional
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas import SolveRequest, SolveResponse
from app.services.ai_engine import ai_engine

router = APIRouter(prefix="/api/v1/solve", tags=["Problem Solver"])

@router.post("", response_model=SolveResponse)
@router.post("/", response_model=SolveResponse)
@router.post("/problem", response_model=SolveResponse)
async def solve_problem(
    req: SolveRequest,
    db: Session = Depends(get_db)
):
    """
    Multi-modal problem solver endpoint.
    Accepts text / LaTeX prompt, solver mode, and optional base64 image.
    Returns complete LaTeX derivations, step-by-step proofs, and canvas visualization nodes.
    """
    try:
        response = await ai_engine.solve_problem(
            prompt=req.prompt,
            image_base64=req.image_base64,
            mode=req.mode or "solver"
        )
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Solver computation error: {str(e)}")

@router.post("/upload", response_model=SolveResponse)
async def solve_with_file_upload(
    file: UploadFile = File(...),
    prompt: Optional[str] = Form("Solve this problem step-by-step"),
    mode: Optional[str] = Form("solver"),
    db: Session = Depends(get_db)
):
    """
    Multipart file upload endpoint for visual problem solving (e.g. handwritten math, geometry diagrams).
    """
    try:
        contents = await file.read()
        b64_img = base64.b64encode(contents).decode("utf-8")
        response = await ai_engine.solve_problem(
            prompt=prompt or "Analyze this image and solve step-by-step",
            image_base64=b64_img,
            mode=mode or "solver"
        )
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Image upload solver failed: {str(e)}")

import io
import zipfile
import xml.etree.ElementTree as ET

@router.post("/extract-text")
async def extract_text_from_file(file: UploadFile = File(...)):
    """
    Extracts text from PDF, DOCX, TXT, MD, CSV, JSON files for instant grounding.
    """
    filename = file.filename or "uploaded_file.txt"
    ext = filename.lower().split(".")[-1] if "." in filename else "txt"
    contents = await file.read()
    extracted_text = ""

    try:
        if ext == "pdf":
            try:
                import fitz
                doc = fitz.open(stream=contents, filetype="pdf")
                pages = [page.get_text() for page in doc]
                extracted_text = "\n".join(pages)
            except Exception as pe:
                extracted_text = contents.decode("utf-8", errors="ignore")
        elif ext in ["docx", "doc"]:
            try:
                with zipfile.ZipFile(io.BytesIO(contents)) as z:
                    xml_content = z.read('word/document.xml')
                    tree = ET.fromstring(xml_content)
                    paragraphs = []
                    for p in tree.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}p'):
                        texts = [node.text for node in p.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}t') if node.text]
                        if texts:
                            paragraphs.append(''.join(texts))
                    extracted_text = "\n".join(paragraphs)
            except Exception as de:
                extracted_text = contents.decode("utf-8", errors="ignore")
        else:
            extracted_text = contents.decode("utf-8", errors="ignore")

        return {
            "filename": filename,
            "char_count": len(extracted_text),
            "word_count": len(extracted_text.split()),
            "extracted_text": extracted_text.strip(),
            "success": True
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"File extraction failed: {str(e)}")

