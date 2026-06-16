# main.py — FastAPI server, run this to start the backend

import os
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from agent.testing_agent import get_runner

load_dotenv()

app = FastAPI(title="Testing Agent API")

# Allows React (localhost:3000) to talk to this server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

runner = get_runner()

class ChatRequest(BaseModel):
    message: str

class ChatResponse(BaseModel):
    reply: str

@app.get("/health")
def health():
    """Check if server is running."""
    return {"status": "ok"}

@app.get("/debug/key-status")
def key_status():
    """Check if the API key is loaded (shows first/last 4 chars only)."""
    key = os.getenv("GOOGLE_API_KEY", "")
    if not key:
        return {"loaded": False, "preview": None}
    preview = f"{key[:4]}...{key[-4:]}" if len(key) > 8 else "***"
    return {"loaded": True, "length": len(key), "preview": preview}

@app.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    """Send a message to the agent and get a reply."""
    from google.genai import types
    from google.genai.errors import ClientError
    import uuid

    user_id = "user"
    session_id = str(uuid.uuid4())

    # Create session using the SAME session_service inside runner
    await runner.session_service.create_session(
        app_name="testing_agent",
        user_id=user_id,
        session_id=session_id
    )

    content = types.Content(
        role="user",
        parts=[types.Part(text=req.message)]
    )

    final_reply = ""
    try:
        async for event in runner.run_async(
            user_id=user_id,
            session_id=session_id,
            new_message=content
        ):
            if event.is_final_response():
                if event.content and event.content.parts:
                    final_reply = event.content.parts[0].text
    except ClientError as e:
        raise HTTPException(
            status_code=400,
            detail=(
                "Gemini API rejected the request. "
                "Most likely your GOOGLE_API_KEY in .env is invalid. "
                f"Original error: {e}"
            ),
        )

    return ChatResponse(reply=final_reply)