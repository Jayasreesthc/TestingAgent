# import os
# import logging
# from typing import Dict
# import httpx

# logger = logging.getLogger("transcription")

# # Option 1: Using AssemblyAI (recommended for medical/HIPAA compliance)
# async def transcribe_audio_assemblyai(audio_file_path: str) -> Dict[str, str]:
#     """
#     Transcribe audio using AssemblyAI.
#     Sign up at https://www.assemblyai.com/ for API key.
#     """
#     api_key = os.getenv("ASSEMBLYAI_API_KEY")
#     if not api_key:
#         raise ValueError("ASSEMBLYAI_API_KEY not set in environment")
    
#     headers = {"authorization": api_key}
    
#     # 1. Upload audio file
#     async with httpx.AsyncClient() as client:
#         with open(audio_file_path, "rb") as f:
#             upload_response = await client.post(
#                 "https://api.assemblyai.com/v2/upload",
#                 headers=headers,
#                 files={"file": f}
#             )
#             logger.error(f"AssemblyAI upload response: {upload_response.status_code} - {upload_response.text}")
#             upload_response.raise_for_status()
#             audio_url = upload_response.json()["upload_url"]
        
#         # 2. Request transcription
#         transcript_request = {
#             "audio_url": audio_url,
#             # "speaker_labels": True,  # Identify different speakers (doctor vs patient)
#             "speech_models": ["universal-2"],
#         }
        
#         transcript_response = await client.post(
#             "https://api.assemblyai.com/v2/transcript",
#             headers=headers,
#             json=transcript_request
#         )
#         logger.error(f"AssemblyAI transcript status: {transcript_response.status_code}")
#         logger.error(f"AssemblyAI transcript response: {transcript_response.text}")
#         transcript_response.raise_for_status()
#         transcript_id = transcript_response.json()["id"]
        
#         # 3. Poll for completion
#         import asyncio
#         while True:
#             status_response = await client.get(
#                 f"https://api.assemblyai.com/v2/transcript/{transcript_id}",
#                 headers=headers
#             )
#             status_response.raise_for_status()
#             result = status_response.json()
            
#             if result["status"] == "completed":
#                 transcript_text = result["text"]
#                 summary_text = result.get("summary", "")
                
#                 # Format with speaker labels
#                 if result.get("utterances"):
#                     formatted_transcript = "\n".join([
#                         f"Speaker {u['speaker']}: {u['text']}"
#                         for u in result["utterances"]
#                     ])
#                     transcript_text = formatted_transcript
                
#                 return {
#                     "transcript": transcript_text,
#                     "summary": summary_text
#                 }
#             elif result["status"] == "error":
#                 raise Exception(f"Transcription failed: {result.get('error')}")
            
#             await asyncio.sleep(3)


# # Option 2: Using OpenAI Whisper (local/free)
# async def transcribe_audio_whisper(audio_file_path: str) -> Dict[str, str]:
#     """
#     Transcribe audio using OpenAI Whisper API.
#     Requires OPENAI_API_KEY in environment.
#     """
#     api_key = os.getenv("OPENAI_API_KEY")
#     if not api_key:
#         raise ValueError("OPENAI_API_KEY not set in environment")
    
#     async with httpx.AsyncClient(timeout=300.0) as client:
#         with open(audio_file_path, "rb") as f:
#             files = {"file": (os.path.basename(audio_file_path), f, "audio/mpeg")}
#             data = {"model": "whisper-1"}
#             headers = {"Authorization": f"Bearer {api_key}"}
            
#             response = await client.post(
#                 "https://api.openai.com/v1/audio/transcriptions",
#                 headers=headers,
#                 files=files,
#                 data=data
#             )
#             response.raise_for_status()
#             result = response.json()
            
#             return {
#                 "transcript": result["text"],
#                 "summary": ""  # Whisper doesn't provide summary
#             }


# # Main transcription function - choose your preferred service
# async def transcribe_audio(audio_file_path: str) -> Dict[str, str]:
#     """
#     Transcribe audio file and return transcript + summary.
    
#     Set TRANSCRIPTION_SERVICE env var to choose:
#     - "assemblyai" (recommended for medical use)
#     - "whisper" (OpenAI Whisper API)
#     """
#     service = os.getenv("TRANSCRIPTION_SERVICE", "assemblyai")
    
#     try:
#         if service == "assemblyai":
#             return await transcribe_audio_assemblyai(audio_file_path)
#         elif service == "whisper":
#             return await transcribe_audio_whisper(audio_file_path)
#         else:
#             raise ValueError(f"Unknown transcription service: {service}")
#     except Exception as e:
#         logger.error(f"Transcription failed with {service}: {e}")
#         raise

import os
import logging
from typing import Dict

logger = logging.getLogger("transcription")

async def transcribe_audio(audio_file_path: str) -> Dict[str, str]:
    """
    Transcribe audio locally using OpenAI Whisper.
    No API key needed — runs entirely on your machine.
    Handles Tamil, English, and Tamil+English mixed speech automatically.
    """
    try:
        import whisper
        import asyncio

        model_name = os.getenv("WHISPER_MODEL", "small")
        logger.info(f"Loading Whisper model: {model_name}")

        # Run in thread pool so it doesn't block the async event loop
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None,
            lambda: _transcribe_sync(audio_file_path, model_name)
        )

        return result

    except Exception as e:
        logger.error(f"Local Whisper transcription failed: {e}")
        raise


def _transcribe_sync(audio_file_path: str, model_name: str) -> Dict[str, str]:
    import whisper

    # Add ffmpeg to PATH so Whisper can find it
    ffmpeg_bin = r"C:\Users\bavit\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.1-full_build\bin"
    os.environ["PATH"] = ffmpeg_bin + os.pathsep + os.environ.get("PATH", "")

    model = whisper.load_model(model_name)
    result = model.transcribe(
        audio_file_path,
        task="transcribe",
        language=None,
        verbose=False
    )

    return {
        "transcript": result.get("text", "").strip(),
        "summary": ""
    }