import asyncio
import json
import time
from typing import List, Dict, Any
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.services.whisper_stream import whisper_service
from app.schemas import LiveNoteSessionResponse

router = APIRouter(prefix="/api/v1/live-notes", tags=["Live Notes"])

@router.websocket("/stream")
async def websocket_live_notes_stream(websocket: WebSocket):
    """
    Real-time WebSocket endpoint for ingesting audio chunks (WebM/PCM/Base64)
    and streaming live transcripts + periodically generated structured study notes.
    """
    await websocket.accept()
    accumulated_text = []
    chunk_index = 0

    try:
        # Send initial connection confirmation
        await websocket.send_json({
            "type": "connected",
            "message": "Connected to Solvely Live Notes Audio Streamer. Streaming active.",
            "timestamp": int(time.time() * 1000)
        })

        while True:
            # Receive either binary audio data or JSON control frame
            message = await websocket.receive()
            chunk_index += 1

            audio_bytes = b""
            if "bytes" in message and message["bytes"]:
                audio_bytes = message["bytes"]
            elif "text" in message and message["text"]:
                try:
                    payload = json.loads(message["text"])
                    if payload.get("type") == "ping":
                        await websocket.send_json({"type": "pong", "timestamp": int(time.time() * 1000)})
                        continue
                    if payload.get("type") == "stop":
                        # Generate final comprehensive notes
                        full_transcript = " ".join(accumulated_text)
                        summary_data = await whisper_service.generate_live_note_summary(full_transcript)
                        await websocket.send_json({
                            "type": "final_summary",
                            "transcript": full_transcript,
                            "notes": summary_data["notes"],
                            "summary": summary_data["summary"],
                            "diagram": summary_data["diagram"],
                            "timestamp": int(time.time() * 1000)
                        })
                        break
                except json.JSONDecodeError:
                    pass

            # Transcribe the incoming chunk
            transcription = await whisper_service.transcribe_audio_chunk(audio_bytes)
            text_chunk = transcription["text"]
            accumulated_text.append(text_chunk)

            # Send back partial/real-time transcript
            await websocket.send_json({
                "type": "transcript",
                "text": text_chunk,
                "is_final": transcription["is_final"],
                "confidence": transcription["confidence"],
                "chunk_index": chunk_index,
                "timestamp": int(time.time() * 1000)
            })

            # Every 3 chunks, trigger an asynchronous study note update
            if chunk_index % 3 == 0:
                summary_data = await whisper_service.generate_live_note_summary(" ".join(accumulated_text))
                await websocket.send_json({
                    "type": "note_update",
                    "notes": summary_data["notes"],
                    "summary": summary_data["summary"],
                    "diagram": summary_data["diagram"],
                    "timestamp": int(time.time() * 1000)
                })

    except WebSocketDisconnect:
        print("[LiveNotes] Client disconnected from live stream.")
    except Exception as e:
        print(f"[LiveNotes] WebSocket stream error: {e}")
        try:
            await websocket.send_json({"type": "error", "message": str(e)})
        except:
            pass

@router.get("/sessions", response_model=List[Dict[str, Any]])
def get_past_sessions():
    """
    List past live lecture recording sessions.
    """
    return [
        {
            "id": "session-pythagoras-01",
            "title": "Geometry & Pythagorean Foundations",
            "status": "COMPLETED",
            "duration_seconds": 184,
            "raw_transcript": "Pythagorean theorem states a squared plus b squared equals c squared...",
            "formatted_notes": "### Key Lecture Takeaways\n- Right triangles obey Euclidean metrics\n- Triples: (3, 4, 5)",
            "created_at": "2026-10-20T18:30:00Z"
        }
    ]
