import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import CanvasWhiteboard, CanvasNode, CanvasEdge
from app.schemas import CanvasStateSaveRequest

router = APIRouter(prefix="/api/v1/canvas", tags=["Canvas & Whiteboard"])

# In-memory session store fallback for instant responsiveness
MEMORY_CANVASES: Dict[str, Dict[str, Any]] = {
    "default-canvas": {
        "id": "default-canvas",
        "title": "Pythagorean Theorem & Geometric Proofs",
        "zoom": 0.85,
        "pan_x": 40.0,
        "pan_y": 60.0,
        "nodes": [
            {
                "id": "node-1",
                "type": "FORMULA",
                "title": "Problem Statement",
                "content": "Given a right-angled triangle with legs $a = 3$ and $b = 4$. Compute hypotenuse $c$.",
                "x": 60,
                "y": 80,
                "width": 340,
                "height": 220,
                "color": "emerald"
            },
            {
                "id": "node-2",
                "type": "STEP",
                "title": "1. Pythagorean Formula",
                "content": "$$c^2 = a^2 + b^2$$\nSubstitute $a=3$ and $b=4$:\n$$c^2 = 9 + 16 = 25$$",
                "x": 440,
                "y": 80,
                "width": 340,
                "height": 220,
                "color": "sky"
            },
            {
                "id": "node-3",
                "type": "GRAPH",
                "title": "2. Interactive Triangle Model",
                "content": "Adjust sliders to verify hypotenuse $c = \\sqrt{a^2 + b^2}$.",
                "x": 820,
                "y": 80,
                "width": 420,
                "height": 280,
                "color": "indigo",
                "params": {"a": 3, "b": 4, "c": 5}
            },
            {
                "id": "node-4",
                "type": "SUMMARY",
                "title": "3. Exact Solution",
                "content": "$$c = \\sqrt{25} = 5$$\nPrimitive Pythagorean Triple $(3, 4, 5)$.",
                "x": 1280,
                "y": 80,
                "width": 320,
                "height": 220,
                "color": "emerald"
            }
        ],
        "edges": [
            {"id": "e1-2", "from": "node-1", "to": "node-2", "label": "Apply Theorem"},
            {"id": "e2-3", "from": "node-2", "to": "node-3", "label": "Simulate Geometry"},
            {"id": "e3-4", "from": "node-3", "to": "node-4", "label": "Extract Root"}
        ],
        "updated_at": datetime.utcnow().isoformat()
    }
}

@router.get("/{canvas_id}")
async def get_canvas(canvas_id: str):
    """
    Load saved whiteboard canvas state (zoom, pan, nodes, edges).
    """
    if canvas_id in MEMORY_CANVASES:
        return MEMORY_CANVASES[canvas_id]
    
    # Return initial empty layout if not found
    return {
        "id": canvas_id,
        "title": "New Canvas Lesson",
        "zoom": 1.0,
        "pan_x": 0.0,
        "pan_y": 0.0,
        "nodes": [],
        "edges": [],
        "updated_at": datetime.utcnow().isoformat()
    }

@router.post("/save")
async def save_canvas(req: CanvasStateSaveRequest):
    """
    Save the current infinite whiteboard canvas state.
    """
    cid = f"canvas-{uuid.uuid4().hex[:8]}"
    state = {
        "id": cid,
        "title": req.title,
        "zoom": req.zoom,
        "pan_x": req.pan_x,
        "pan_y": req.pan_y,
        "nodes": req.nodes,
        "edges": req.edges,
        "updated_at": datetime.utcnow().isoformat()
    }
    MEMORY_CANVASES[cid] = state
    return {"status": "success", "canvas_id": cid, "saved_nodes_count": len(req.nodes)}
