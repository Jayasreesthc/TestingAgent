import os
import time
import asyncio
import logging
import shutil
import traceback
import mimetypes
from typing import List, Tuple, Dict

import numpy as np
import librosa
import soundfile as sf
from pydub import AudioSegment

from fastapi import UploadFile, HTTPException

from openai import AsyncOpenAI

# -------------------------------------------------
# CONFIG
# -------------------------------------------------
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
# We will handle the missing key more gracefully in the endpoint or startup if needed,
# but for now, we keep the user's logic which raises RuntimeError at module level.
# Ideally this should be checked at startup or usage time to allow other parts of app to run.
if not OPENAI_API_KEY:
    # Creating a logger to warn instead of crashing immediately on import if env not set yet
    logging.warning("OPENAI_API_KEY is not set. Audio processing will fail.")

client = AsyncOpenAI(api_key=OPENAI_API_KEY)

MAX_CHUNK_DURATION = 30  # seconds
TEMP_DIR = "temp_audio"

os.makedirs(TEMP_DIR, exist_ok=True)

logger = logging.getLogger("audio-processor")
logging.basicConfig(level=logging.INFO)


# -------------------------------------------------
# AUDIO PROCESSOR
# -------------------------------------------------
class AudioProcessor:

    AUDIO_EXTENSIONS = (".wav", ".mp3", ".m4a", ".aac", ".ogg", ".flac")

    # ---------- Validation ----------
    @staticmethod
    def is_audio_file(filename: str) -> bool:
        mime, _ = mimetypes.guess_type(filename)
        return (
            filename.lower().endswith(AudioProcessor.AUDIO_EXTENSIONS)
            or (mime and mime.startswith("audio"))
        )

    # ---------- Save Upload ----------
    @staticmethod
    def save_upload(file: UploadFile) -> str:
        path = os.path.join(TEMP_DIR, f"{int(time.time())}_{file.filename}")
        with open(path, "wb") as f:
            shutil.copyfileobj(file.file, f)
        return path

    # ---------- Convert ----------
    @staticmethod
    def convert_to_wav(path: str) -> str:
        if path.lower().endswith(".wav"):
            return path

        wav_path = f"{path}.wav"
        try:
            audio = AudioSegment.from_file(path)
            audio.export(wav_path, format="wav")
            return wav_path
        except Exception:
            y, sr = librosa.load(path, sr=16000, mono=True)
            sf.write(wav_path, y, sr)
            return wav_path

    # ---------- Load ----------
    @staticmethod
    def load_audio(path: str) -> Tuple[np.ndarray, int]:
        try:
            y, sr = sf.read(path)
            if len(y.shape) > 1:
                y = y.mean(axis=1)
            return y, sr
        except Exception:
            return librosa.load(path, sr=16000, mono=True)

    # ---------- Preprocess ----------
    @staticmethod
    def preprocess(path: str) -> str:
        y, sr = AudioProcessor.load_audio(path)
        y, _ = librosa.effects.trim(y, top_db=30)

        if np.max(np.abs(y)) > 0:
            y = y * (0.9 / np.max(np.abs(y)))

        out_path = f"{path}_clean.wav"
        sf.write(out_path, y, sr)
        return out_path

    # ---------- Split ----------
    @staticmethod
    def split_audio(path: str) -> List[str]:
        y, sr = AudioProcessor.load_audio(path)
        duration = len(y) / sr

        if duration <= MAX_CHUNK_DURATION:
            return [path]

        chunk_size = int(MAX_CHUNK_DURATION * sr)
        chunks = []

        for i in range(0, len(y), chunk_size):
            chunk = y[i:i + chunk_size]
            chunk_path = f"{path}_chunk_{i//chunk_size}.wav"
            sf.write(chunk_path, chunk, sr)
            chunks.append(chunk_path)

        return chunks


# -------------------------------------------------
# TRANSCRIPTION
# -------------------------------------------------
async def transcribe_audio(path: str) -> str:
    try:
        with open(path, "rb") as audio:
            result = await client.audio.transcriptions.create(
                file=audio,
                model="whisper-1",
                language="en",
                prompt="Medical conversation transcription",
                response_format="text",
            )
        return result.strip()
    except Exception as e:
        logger.error(f"Transcription failed: {e}")
        return ""


# -------------------------------------------------
# MEDICAL SUMMARIZER
# -------------------------------------------------
class MedicalSummarizer:

    @staticmethod
    async def summarize(text: str) -> str:
        if len(text.split()) < 20:
            return "Insufficient data for medical summary."

        response = await client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a doctor. Summarize this medical conversation:\n"
                        "Patient reports:\nDoctor recommends:"
                    )
                },
                {"role": "user", "content": text}
            ],
            temperature=0.2,
            max_tokens=300
        )
        return response.choices[0].message.content.strip()


# -------------------------------------------------
# FULL PIPELINE
# -------------------------------------------------
async def process_audio_file(file: UploadFile) -> Dict:
    if not AudioProcessor.is_audio_file(file.filename):
        raise HTTPException(400, "Unsupported audio format")

    original_path = AudioProcessor.save_upload(file)
    wav_path = AudioProcessor.convert_to_wav(original_path)

    chunks = AudioProcessor.split_audio(wav_path)
    texts = []

    try:
        for chunk in chunks:
            clean = AudioProcessor.preprocess(chunk)
            text = await transcribe_audio(clean)
            texts.append(text)

        full_text = " ".join(texts)
        summary = await MedicalSummarizer.summarize(full_text)

        return {
            "english_translation": full_text,
            "summary": summary,
            "status": "success"
        }

    finally:
        # Cleanup specific files
        try:
            if os.path.exists(original_path):
                os.remove(original_path)
            if os.path.exists(wav_path):
                os.remove(wav_path)
            for chunk in chunks:
                if os.path.exists(chunk):
                    os.remove(chunk)
        except Exception as e:
            logger.warning(f"Error cleaning up temp files: {e}")

