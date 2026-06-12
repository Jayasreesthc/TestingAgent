"""
audio.py — Self-contained Psychology Audio Processing Module for PsycheGraph
==============================================================================

Includes:
  - AudioProcessor          : load, convert, split, preprocess audio
  - TranscriptPostProcessor : clean transcription artifacts for therapy sessions
  - PsychologySummarizer    : rule-based fallback summariser
  - llama_summarize          : primary AI summariser via Groq API
  - translate_english        : Whisper-based transcription to English
  - process_audio_chunk      : per-chunk async pipeline
  - FastAPI router with /audio/upload/, /audio/session-summary/, /audio/batch/
  - process_audio_file       : full pipeline used internally by sessions router
  - get_supported_languages  : helper for API

Drop the router into main.py:
    from app.services.audio import audio_router
    app.include_router(audio_router)
"""

import os
import sys
import re
import json
import time
import shutil
import asyncio
import logging
import mimetypes
import traceback
import tempfile
import datetime
from typing import Tuple, List, Dict, Optional
from concurrent.futures import ThreadPoolExecutor

import numpy as np
import librosa
import soundfile as sf
import scipy.io.wavfile as wav
from pydub import AudioSegment

from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from pydantic import BaseModel
from openai import AsyncOpenAI
from httpx import AsyncClient
from dotenv import load_dotenv

# ---------------------------------------------------------------------------
# Load .env from backend directory
# ---------------------------------------------------------------------------
_base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
_env_path = os.path.join(_base_dir, ".env")
load_dotenv(_env_path)

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(os.path.join(_base_dir, "audio.log"), encoding="utf-8"),
    ],
)
logger = logging.getLogger("psychegraph.audio")

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
TEMP_DIR           = os.path.join(_base_dir, "temp_audio")
TRANSCRIPT_DIR     = os.path.join(_base_dir, "transcripts")
MAX_CHUNK_DURATION = 30   # seconds per audio chunk
MAX_SUMMARY_TIME   = 30   # seconds allowed for summarisation

os.makedirs(TEMP_DIR, exist_ok=True)
os.makedirs(TRANSCRIPT_DIR, exist_ok=True)

executor = ThreadPoolExecutor(max_workers=4)

# ---------------------------------------------------------------------------
# Supported Whisper languages
# ---------------------------------------------------------------------------
SUPPORTED_LANGUAGES: Dict[str, str] = {
    "en": "English",
    "ta": "Tamil",
    "hi": "Hindi",
    "te": "Telugu",
    "kn": "Kannada",
    "ml": "Malayalam",
    "mr": "Marathi",
    "bn": "Bengali",
    "gu": "Gujarati",
    "pa": "Punjabi",
    "ur": "Urdu",
    "ar": "Arabic",
    "fr": "French",
    "de": "German",
    "es": "Spanish",
    "zh": "Chinese",
    "ja": "Japanese",
    "ko": "Korean",
    "pt": "Portuguese",
    "ru": "Russian",
}

# ---------------------------------------------------------------------------
# OpenAI async client
# ---------------------------------------------------------------------------
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY") or os.getenv("OPEN_API_KEY")
if not OPENAI_API_KEY:
    logger.warning(
        "Neither OPENAI_API_KEY nor OPEN_API_KEY is set. "
        "Audio summarisation endpoints will error at runtime."
    )

async_client = AsyncOpenAI(
    api_key=OPENAI_API_KEY or "not-configured",
    timeout=60.0,
    max_retries=3,
)

# ---------------------------------------------------------------------------
# Groq config — used by llama_summarize
# ---------------------------------------------------------------------------
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL   = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")

if not GROQ_API_KEY:
    logger.warning("GROQ_API_KEY is not set — summarisation will fall back to rule-based.")

# ---------------------------------------------------------------------------
# FFMPEG configuration
# ---------------------------------------------------------------------------
def _configure_ffmpeg() -> bool:
    """Locate and wire ffmpeg/ffprobe for pydub. Returns True on success."""
    _winget_ffmpeg = (
        r"C:\Users\bavit\AppData\Local\Microsoft\WinGet\Packages"
        r"\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe"
        r"\ffmpeg-8.1-full_build\bin"
    )
    if os.path.isdir(_winget_ffmpeg):
        os.environ["PATH"] = _winget_ffmpeg + os.pathsep + os.environ.get("PATH", "")

    try:
        ffmpeg_path  = shutil.which("ffmpeg")
        ffprobe_path = shutil.which("ffprobe")

        if not ffmpeg_path:
            ffmpeg_path = "/usr/bin/ffmpeg"
        if not ffprobe_path:
            ffprobe_path = "/usr/bin/ffprobe"

        if os.path.exists(ffmpeg_path):
            AudioSegment.converter = ffmpeg_path
        if os.path.exists(ffprobe_path):
            AudioSegment.ffprobe = ffprobe_path

        logger.info(f"ffmpeg: {ffmpeg_path} | ffprobe: {ffprobe_path}")
        return True
    except Exception as exc:
        logger.warning(f"ffmpeg configuration failed: {exc}")
        return False


_configure_ffmpeg()

# ---------------------------------------------------------------------------
# Pydantic response model
# ---------------------------------------------------------------------------
class AudioProcessingResult(BaseModel):
    english_translation: str
    summary: str
    processing_time: float
    status: str


# ---------------------------------------------------------------------------
# Psychology keyword registry
# ---------------------------------------------------------------------------
PSYCHOLOGY_KEYWORDS: Dict[str, List[str]] = {
    "patient_reports": [
        r"i feel", r"i am feeling", r"i have been", r"my \w+",
        r"anxious", r"depressed", r"stressed", r"overwhelmed",
        r"panic", r"fear", r"worry", r"worried", r"hopeless",
        r"numb", r"trigger", r"trauma", r"flashback", r"nightmare",
        r"insomnia", r"sleep", r"appetite", r"concentrate", r"focus",
        r"mood", r"episode", r"breakdown", r"self-harm", r"suicidal",
        r"lonely", r"isolated", r"grief", r"loss",
    ],
    "therapist_advice": [
        r"recommend", r"suggest", r"try", r"practice", r"exercise",
        r"mindfulness", r"breathing", r"grounding", r"coping",
        r"therapy", r"session", r"follow up", r"journal",
        r"cognitive", r"behavioural", r"reframe", r"challenge",
        r"support", r"medication", r"dosage", r"referral",
        r"schedule", r"routine", r"self-care", r"boundary",
    ],
    "psychology_terms": [
        r"anxiety", r"depression", r"ptsd", r"bipolar", r"schizophrenia",
        r"ocd", r"adhd", r"autism", r"phobia", r"disorder",
        r"cognitive", r"behaviour", r"emotion", r"affect",
        r"dissociation", r"hallucination", r"delusion",
        r"psychosis", r"mania", r"hypomania", r"dysthymia",
        r"borderline", r"narcissistic", r"therapeutic", r"diagnosis",
        r"assessment", r"evaluation", r"intervention", r"treatment",
        r"dbt", r"cbt", r"emdr", r"psychotherapy", r"psychiatry",
        r"medication", r"antidepressant", r"antipsychotic",
    ],
}

# ---------------------------------------------------------------------------
# Transcript Post-Processor
# ---------------------------------------------------------------------------
class TranscriptPostProcessor:
    """
    Cleans common Whisper transcription artifacts for psychology session recordings.
    Corrects domain-specific terms and detects hallucinated content.
    """

    TERM_CORRECTIONS: Dict[str, str] = {
        "therapist":      "therapist",
        "therepist":      "therapist",
        "phsycologist":   "psychologist",
        "psychologyst":   "psychologist",
        "councelling":    "counselling",
        "counceling":     "counselling",
        "councelor":      "counsellor",
        "cognetive":      "cognitive",
        "mindfulnes":     "mindfulness",
        "behavorial":     "behavioural",
        "trama":          "trauma",
        "anxeity":        "anxiety",
        "dipression":     "depression",
        "suicidel":       "suicidal",
        "halucination":   "hallucination",
        "delution":       "delusion",
        "manic":          "manic",
        "sychiatrist":    "psychiatrist",
    }

    HALLUCINATION_PATTERNS: Dict[str, str] = {
        "media_outro": r"(?:thanks|thank you) for (?:watching|listening)|subscribe|like and share",
        "attribution": r"(?:he|she|they) (?:said|stated|mentioned|claims)",
        "web_ref":     r"(?:www\.|http|\.com|\.org|click\s+(?:here|below))",
    }

    ALLOWED_ENGLISH_WORDS: List[str] = [
        "doctor", "therapist", "psychologist", "psychiatrist",
        "session", "therapy", "medication", "anxiety", "depression",
        "ptsd", "ocd", "adhd", "cbt", "dbt", "emdr",
        "panic", "stress", "trauma", "mood", "sleep",
        "disorder", "diagnosis", "treatment", "referral",
        "breathing", "mindfulness", "grounding", "journal",
        "follow", "ok", "hi", "yes", "no", "please",
        "report", "test", "blood", "pressure", "hospital", "clinic",
    ]

    FILLER_PATTERNS: List[Tuple[str, str]] = [
        (r"\b(\w+)\s+\1\b", r"\1"),
        (r"^\s*[.!?]\s*",   ""),
        (r"\s{2,}",         " "),
    ]

    def clean(self, text: str) -> str:
        if not text:
            return text
        for pattern, replacement in self.FILLER_PATTERNS:
            text = re.sub(pattern, replacement, text, flags=re.I)
        for wrong, correct in self.TERM_CORRECTIONS.items():
            text = re.sub(rf"\b{re.escape(wrong)}\b", correct, text, flags=re.I)
        return text.strip()

    def detect_hallucinations(self, text: str) -> bool:
        for name, pattern in self.HALLUCINATION_PATTERNS.items():
            if re.search(pattern, text, re.IGNORECASE):
                logger.warning(f"Hallucination pattern matched: '{name}'")
                return True

        english_words = re.findall(r"[a-zA-Z]{4,}", text)
        disallowed = [w for w in english_words if w.lower() not in self.ALLOWED_ENGLISH_WORDS]
        if len(disallowed) > 5:
            logger.warning(f"Potential hallucination — unexpected words: {disallowed[:5]}")
            return True

        return False


# ---------------------------------------------------------------------------
# Psychology Summarizer  (rule-based fallback — used when Ollama is unavailable)
# ---------------------------------------------------------------------------
class PsychologySummarizer:
    """
    Structures and summarises therapy / psychology session transcripts using
    rule-based extraction. Used as a fallback when llama_summarize fails.
    """

    POLITE_PHRASES: List[str] = [
        "good morning", "good afternoon", "good evening",
        "hello", "hi", "welcome", "please", "thank you",
        "come in", "tell me", "how are you",
    ]

    @staticmethod
    def _clean_transcript(text: str) -> str:
        text = re.sub(r"\b(\w+)\s+\1\b", r"\1", text, flags=re.I)
        replacements = {
            "good morning. therapist":  "Therapist:",
            "good afternoon. therapist": "Therapist:",
            "i am feeling":             "Patient: I am feeling",
            "you should try":           "Therapist: You should try",
            "ok therapist":             "",
            "ok,":                      "",
        }
        for wrong, correct in replacements.items():
            text = text.replace(wrong, correct)
        return text

    @staticmethod
    def _structure_summary(text: str) -> str:
        patient_patterns = [
            r"i\s+(?:am\s+)?feel(?:ing)?\s+([^.!?]+)",
            r"i\s+have\s+(?:been\s+)?([^.!?]+)",
            r"i\s+(?:can't|cannot|couldn't)\s+([^.!?]+)",
            r"i\s+(?:keep|kept)\s+([^.!?]+)",
            r"my\s+([^.!?]*(?:anxiety|depression|mood|sleep|panic|stress|trauma|fear|pain|fever|cough|sugar|pressure)[^.!?]*)",
            r"(?:patient|i)\s+(?:said|reported|mentioned|complained)\s+([^.!?]+)",
        ]
        doctor_patterns = [
            r"(?:try|take|eat|avoid|maintain|follow|practice|use)\s+([^.!?]+)",
            r"(?:you\s+)?(?:should|can|need\s+to|must)\s+([^.!?]+)",
            r"(?:i\s+)?(?:recommend|suggest|prescribe|advise)\s+([^.!?]+)",
            r"(?:tablet|medicine|medication)\s+([^.!?]+)",
            r"(?:doctor|therapist|physician)[:\s]+([^.!?]+)",
            r"(?:come back|follow up|next appointment|next visit)\s*([^.!?]*)",
        ]

        text_lower = text.lower()
        patient_reports = []
        doctor_advice   = []

        for pattern in patient_patterns:
            for match in re.findall(pattern, text_lower, re.IGNORECASE):
                item = match.strip()
                if item and len(item) > 4:
                    patient_reports.append(item)

        for pattern in doctor_patterns:
            for match in re.findall(pattern, text_lower, re.IGNORECASE):
                item = match.strip()
                if item and len(item) > 4:
                    doctor_advice.append(item)

        parts = []
        if patient_reports:
            unique = list(dict.fromkeys(patient_reports[:4]))
            parts.append(f"Patient reports: {'; '.join(unique)}")
        if doctor_advice:
            unique = list(dict.fromkeys(doctor_advice[:4]))
            parts.append(f"Therapist recommends: {'; '.join(unique)}")

        if not parts:
            preview = text[:200].replace("\n", " ").strip()
            return f"Patient reports: {preview}\nTherapist recommends: [Please review transcript]"

        return "\n".join(parts)

    @classmethod
    async def summarize(cls, text: str) -> str:
        if not text or len(text.strip()) < 10:
            return "Patient reports: [No content]\nTherapist recommends: [No content]"

        try:
            cleaned    = cls._clean_transcript(text)
            structured = cls._structure_summary(cleaned)

            if structured.strip() and len(structured.split()) > 5:
                return structured

            preview = text[:200].replace("\n", " ")
            return f"Patient reports: {preview}…\nTherapist recommends: [Manual review required]"

        except Exception as exc:
            logger.error(f"Rule-based summarisation failed: {exc}")
            return f"Patient reports: {text[:120]}…\nTherapist recommends: [Summary unavailable]"


# ---------------------------------------------------------------------------
# Llama summarizer via Ollama  (primary — defined AFTER PsychologySummarizer
# so the fallback reference is valid)
# ---------------------------------------------------------------------------
async def llama_summarize(transcript: str) -> str:
    """
    Summarize a therapy session transcript using Llama 3 via Groq API.
    Falls back to PsychologySummarizer if Groq is unreachable or key is missing.
    """
    if not transcript or len(transcript.strip()) < 20:
        return "Patient reports: [No content]\nTherapist recommends: [No content]"

    if not GROQ_API_KEY:
        logger.warning("[GROQ] No API key — using rule-based fallback")
        return await PsychologySummarizer.summarize(transcript)

    prompt = (
        "You are a clinical documentation assistant for a psychotherapy practice. "
        "Read the session transcript below and write a concise structured summary.\n\n"
        "Use exactly this format — two lines only:\n"
        "Patient reports: [what the patient described, felt, or disclosed — 1-2 sentences]\n"
        "Therapist recommends: [interventions, homework, or suggestions from the therapist — 1-2 sentences]\n\n"
        "If something is not clearly present in the transcript, write [not discussed].\n"
        "Do not add extra sections, headings, or commentary.\n\n"
        f"Transcript:\n{transcript[:4000]}\n\nSummary:"
    )

    try:
        async with AsyncClient(timeout=30.0) as client:
            response = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {GROQ_API_KEY}",
                    "Content-Type":  "application/json",
                },
                json={
                    "model":       GROQ_MODEL,
                    "messages":    [{"role": "user", "content": prompt}],
                    "temperature": 0.1,
                    "max_tokens":  250,
                    "stop":        ["Transcript:", "---"],
                },
            )
            response.raise_for_status()
            result = response.json()["choices"][0]["message"]["content"].strip()

            if result and "Patient reports:" in result:
                return result

            logger.warning(f"[GROQ] Unexpected response format: {result[:80]}")

    except Exception as exc:
        logger.warning(f"[GROQ] API error: {exc} — falling back to rule-based")

    return await PsychologySummarizer.summarize(transcript)


# ---------------------------------------------------------------------------
# Audio Processor
# ---------------------------------------------------------------------------
class AudioProcessor:
    """Handles loading, conversion, splitting, and preprocessing of audio files."""

    AUDIO_EXTENSIONS = (".wav", ".mp3", ".m4a", ".aac", ".ogg", ".flac", ".mp4", ".webm")

    @staticmethod
    def is_audio_file(filename: str) -> bool:
        if not filename:
            return False
        mime, _ = mimetypes.guess_type(filename)
        return (
            filename.lower().endswith(AudioProcessor.AUDIO_EXTENSIONS)
            or (mime is not None and mime.startswith("audio"))
        )

    @staticmethod
    def save_upload(file: UploadFile) -> str:
        path = os.path.join(TEMP_DIR, f"{int(time.time())}_{file.filename}")
        with open(path, "wb") as f:
            shutil.copyfileobj(file.file, f)
        return path

    @staticmethod
    def load_audio(path: str) -> Tuple[np.ndarray, int]:
        if not os.path.exists(path):
            raise HTTPException(400, f"Audio file not found: {path}")
        try:
            y, sr = sf.read(path)
            if len(y.shape) > 1:
                y = y.mean(axis=1)
            if y is None or len(y) == 0:
                raise ValueError("Empty audio file")
            return y.astype(np.float32), int(sr)
        except Exception as sf_err:
            logger.warning(f"soundfile failed ({sf_err}), trying librosa…")
            try:
                y, sr = librosa.load(path, sr=16000, mono=True, res_type="kaiser_fast")
                if y is None or len(y) == 0:
                    raise ValueError("Empty audio after librosa load")
                return y, sr
            except Exception as lb_err:
                logger.error(f"Audio loading failed: {traceback.format_exc()}")
                raise HTTPException(400, f"Unsupported or corrupt audio file: {lb_err}")

    @staticmethod
    def convert_to_wav(path: str) -> str:
        if path.lower().endswith(".wav"):
            return path

        out_path = f"{path}_converted.wav"
        try:
            sound = AudioSegment.from_file(path)
            sound.export(out_path, format="wav")
            return out_path
        except Exception as pydub_err:
            logger.warning(f"pydub conversion failed ({pydub_err}), trying librosa fallback…")
            try:
                y, sr = librosa.load(path, sr=16000)
                if y is None or len(y) == 0:
                    raise ValueError("Empty audio signal after librosa load")
                sf.write(out_path, y, sr)
                return out_path
            except Exception as lb_err:
                logger.error(f"Audio conversion failed: {traceback.format_exc()}")
                raise HTTPException(400, f"Audio conversion failed: {lb_err}")

    @staticmethod
    def split_audio(path: str) -> List[str]:
        try:
            y, sr    = AudioProcessor.load_audio(path)
            duration = len(y) / sr

            if duration <= MAX_CHUNK_DURATION:
                return [path]

            chunk_size = int(MAX_CHUNK_DURATION * sr)
            chunks_dir = os.path.join(TEMP_DIR, "chunks")
            os.makedirs(chunks_dir, exist_ok=True)

            paths: List[str] = []
            base_name = os.path.basename(path)
            for i, start in enumerate(range(0, len(y), chunk_size)):
                chunk      = y[start: start + chunk_size]
                chunk_path = os.path.join(chunks_dir, f"{base_name}_chunk{i}.wav")
                sf.write(chunk_path, chunk, sr)
                paths.append(chunk_path)

            logger.info(f"Split '{base_name}' → {len(paths)} chunks ({duration:.1f}s total)")
            return paths
        except HTTPException:
            raise
        except Exception as exc:
            logger.error(f"Audio splitting failed: {traceback.format_exc()}")
            return [path]

    @staticmethod
    def preprocess(path: str) -> str:
        try:
            y, sr = AudioProcessor.load_audio(path)
            y, _  = librosa.effects.trim(y, top_db=30)

            if y is None or len(y) == 0:
                raise ValueError("Audio is silent after trimming")

            peak = np.max(np.abs(y))
            if peak > 0:
                y = y * (0.9 / peak)

            out_path = f"{path}_preprocessed.wav"
            sf.write(out_path, y, sr)
            return out_path
        except HTTPException:
            raise
        except Exception as exc:
            logger.error(f"Audio preprocessing failed: {traceback.format_exc()}")
            raise HTTPException(400, f"Audio preprocessing failed: {exc}")


# ---------------------------------------------------------------------------
# Core processing helpers
# ---------------------------------------------------------------------------

_post_processor = TranscriptPostProcessor()


async def translate_english(path: str) -> str:
    """
    Transcribe audio to English using OpenAI Whisper API (whisper-1).
    Cleans the result through TranscriptPostProcessor.
    """
    try:
        with open(path, "rb") as audio_file:
            response = await async_client.audio.transcriptions.create(
                file=audio_file,
                model="whisper-1",
                language="en",
                prompt=(
                    "This is a psychology or therapy consultation. "
                    "Transcribe accurately in English."
                ),
                response_format="text",
            )

        text = response if isinstance(response, str) else response.text

        if not text or len(text.strip()) < 5:
            return "Transcription not available"

        if _post_processor.detect_hallucinations(text):
            logger.warning("Hallucinated content detected — returning empty transcription")
            return "Transcription not available"

        return _post_processor.clean(text)

    except Exception as exc:
        logger.error(f"Whisper transcription error: {exc}")
        return "Transcription not available"


async def process_audio_chunk(chunk_path: str) -> Dict:
    """
    Preprocess → transcribe → summarise a single audio chunk.
    Returns a dict with keys: english, summary, chunk_path.
    """
    processed_path: Optional[str] = None
    try:
        processed_path = AudioProcessor.preprocess(chunk_path)
        english        = await translate_english(processed_path)
        summary        = await llama_summarize(english)          # ← Llama, not rule-based
        return {"english": english, "summary": summary, "chunk_path": chunk_path}
    except Exception as exc:
        logger.error(f"Chunk processing failed for '{chunk_path}': {exc}")
        return {"english": "", "summary": "", "chunk_path": chunk_path}
    finally:
        if processed_path and os.path.exists(processed_path):
            try:
                os.remove(processed_path)
            except OSError:
                pass


# ---------------------------------------------------------------------------
# Local Whisper transcription — used by sessions.py via transcribe_audio()
# ---------------------------------------------------------------------------

async def transcribe_audio(path: str, language: Optional[str] = None) -> Dict[str, str]:
    """
    Transcribe audio locally using the local Whisper model (no OpenAI API key needed).
    Handles Tamil, English, and mixed Tamil+English automatically.
    Called by sessions.py background task for offline audio uploads.
    """
    model_name = os.getenv("WHISPER_MODEL", "tiny")
    logger.info(f"Starting local transcription — model: {model_name}")

    loop   = asyncio.get_event_loop()
    result = await loop.run_in_executor(
        None,
        lambda: _transcribe_local(path, model_name)
    )
    return result


def _transcribe_local(path: str, model_name: str) -> Dict[str, str]:
    """
    Synchronous local Whisper call — runs in a thread pool via transcribe_audio().
    Calls llama_summarize in its own event loop after transcription completes.
    """
    import whisper

    converted_path    = None
    preprocessed_path = None

    try:
        converted_path    = AudioProcessor.convert_to_wav(path)
        preprocessed_path = AudioProcessor.preprocess(converted_path)

        model  = whisper.load_model(model_name)
        result = model.transcribe(
            preprocessed_path,
            task="transcribe",
            language=None,      # auto-detect Tamil/English/mixed
            verbose=False,
            fp16=False,         # CPU only
            temperature=0.0,
        )

        transcript    = result.get("text", "").strip()
        transcript    = _post_processor.clean(transcript)
        detected_lang = result.get("language", "unknown")

        logger.info(f"Transcription done — language: {detected_lang}, chars: {len(transcript)}")

        # llama_summarize is async — run it in a fresh event loop from this thread
        loop = asyncio.new_event_loop()
        try:
            summary = loop.run_until_complete(llama_summarize(transcript))
        except Exception as sum_exc:
            logger.warning(f"[LLAMA] Summary failed in transcription thread: {sum_exc}")
            summary = ""
        finally:
            loop.close()

        return {
            "transcript": transcript,
            "summary":    summary,
            "language":   detected_lang,
        }

    finally:
        for p in [preprocessed_path, converted_path]:
            if p and p != path:
                _safe_remove(p)


# ---------------------------------------------------------------------------
# Transcript formatting and persistence
# ---------------------------------------------------------------------------

def format_transcript(text: str, language_name: str = "Auto-detected") -> str:
    now = time.strftime("%Y-%m-%d %H:%M:%S")
    lines = [
        "=" * 56,
        "       PSYCHEGRAPH — THERAPY SESSION TRANSCRIPT",
        "=" * 56,
        f"Date     : {now}",
        f"Language : {language_name}",
        "=" * 56,
        "",
        text,
        "",
        "=" * 56,
        "             END OF TRANSCRIPT",
        "=" * 56,
    ]
    return "\n".join(lines)


def save_transcript(text: str, prefix: str = "session") -> str:
    filename = f"{prefix}_{int(time.time())}.txt"
    path     = os.path.join(TRANSCRIPT_DIR, filename)
    with open(path, "w", encoding="utf-8") as f:
        f.write(text)
    return path


async def process_audio_file(
    file: UploadFile,
    language: Optional[str] = None,
) -> Dict:
    """
    Full pipeline:
      1. Save uploaded audio
      2. Convert to WAV
      3. Split into ≤30-second chunks
      4. Transcribe each chunk
      5. Summarise combined transcript via Llama
      6. Save transcript file
      7. Clean up temp files
      8. Return result dict
    """
    if not AudioProcessor.is_audio_file(file.filename):
        raise HTTPException(400, "Unsupported audio format")

    language_name = (
        SUPPORTED_LANGUAGES.get(language, "Auto-detected") if language else "Auto-detected"
    )
    logger.info(f"Processing audio — language: {language_name} (code: {language or 'auto'})")

    original = AudioProcessor.save_upload(file)
    try:
        wav_path = AudioProcessor.convert_to_wav(original)
    except Exception as exc:
        logger.error(f"Conversion error: {exc}")
        wav_path = original

    chunks = AudioProcessor.split_audio(wav_path)
    texts: List[str] = []

    for chunk in chunks:
        result = await transcribe_audio(chunk, language=language)
        text   = result.get("transcript", "") if isinstance(result, dict) else result
        if text:
            texts.append(text)
        logger.info(f"Chunk transcribed: {chunk}")

    full_text       = " ".join(texts)
    summary         = await llama_summarize(full_text)           # ← Llama, not rule-based
    formatted       = format_transcript(full_text, language_name)
    transcript_file = save_transcript(formatted, "session")

    _safe_remove(original)
    if wav_path != original:
        _safe_remove(wav_path)
    for chunk in chunks:
        if chunk not in (original, wav_path):
            _safe_remove(chunk)

    logger.info(f"Transcript complete — language: {language_name}, file: {transcript_file}")

    return {
        "transcript":          full_text,
        "english_translation": formatted,
        "summary":             summary,
        "file":                transcript_file,
        "language":            language_name,
    }


def get_supported_languages() -> Dict[str, str]:
    return SUPPORTED_LANGUAGES


def _safe_remove(path: str) -> None:
    try:
        if os.path.exists(path):
            os.remove(path)
    except OSError as exc:
        logger.warning(f"Cleanup warning — could not remove '{path}': {exc}")


# ---------------------------------------------------------------------------
# FastAPI Router
# ---------------------------------------------------------------------------
audio_router = APIRouter(prefix="/audio", tags=["Audio Processing"])


@audio_router.post("/upload/", response_model=AudioProcessingResult)
async def upload_audio(file: UploadFile = File(...)):
    """
    Upload a single therapy session audio file.
    Returns an English transcription and a structured psychology summary.
    """
    if not AudioProcessor.is_audio_file(file.filename):
        raise HTTPException(400, "Unsupported audio format")

    upload_path: Optional[str] = None
    start_time  = time.time()

    try:
        tmp_dir  = os.path.join(TEMP_DIR, "uploads")
        os.makedirs(tmp_dir, exist_ok=True)
        raw_path = os.path.join(tmp_dir, f"{int(time.time())}_{file.filename}")
        with open(raw_path, "wb") as f:
            shutil.copyfileobj(file.file, f)

        upload_path = AudioProcessor.convert_to_wav(raw_path)
        _safe_remove(raw_path)

        logger.info(f"Processing upload: {upload_path}")

        chunks  = AudioProcessor.split_audio(upload_path)
        results = await asyncio.gather(*(process_audio_chunk(c) for c in chunks))

        combined_english = " ".join(r["english"] for r in results if r["english"])
        final_summary    = await llama_summarize(combined_english)   # ← Llama, not rule-based

        processing_time = round(time.time() - start_time, 2)
        logger.info(f"Upload processed in {processing_time}s")

        return AudioProcessingResult(
            english_translation=combined_english,
            summary=final_summary,
            processing_time=processing_time,
            status="success",
        )

    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Upload processing failed: {exc}")
        raise HTTPException(500, f"Audio processing failed: {exc}")
    finally:
        if upload_path and os.path.exists(upload_path):
            _safe_remove(upload_path)
        chunks_dir = os.path.join(TEMP_DIR, "chunks")
        if os.path.isdir(chunks_dir):
            try:
                shutil.rmtree(chunks_dir)
            except OSError:
                pass


@audio_router.get("/session-summary/")
async def get_latest_session_summary():
    """
    Return the most recent saved therapy session transcript from disk.
    """
    try:
        txt_files = sorted(
            [f for f in os.listdir(TRANSCRIPT_DIR) if f.endswith(".txt")],
            reverse=True,
        )
        if not txt_files:
            raise HTTPException(404, "No session summaries found")

        latest = os.path.join(TRANSCRIPT_DIR, txt_files[0])
        with open(latest, "r", encoding="utf-8") as f:
            content = f.read()

        created_at = datetime.datetime.fromtimestamp(os.path.getmtime(latest)).isoformat()
        return {
            "filename":   txt_files[0],
            "content":    content,
            "created_at": created_at,
        }
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Failed to read session summary: {exc}")
        raise HTTPException(500, "Failed to retrieve session summary")


@audio_router.post("/batch/")
async def batch_process_audio(
    files: List[UploadFile] = File(...),
    patient_ids: str = Form(...),
):
    """
    Process multiple therapy session audio files in batch.
    Each file is matched to a patient ID (comma-separated list).
    """
    try:
        patient_id_list = [int(pid.strip()) for pid in patient_ids.split(",")]
    except ValueError:
        raise HTTPException(
            400,
            "Invalid patient_ids format. Provide comma-separated integers e.g. '1,2,3'.",
        )

    if len(files) != len(patient_id_list):
        raise HTTPException(400, "Number of files must match number of patient IDs")

    batch_dir = os.path.join(TEMP_DIR, "batch")
    os.makedirs(batch_dir, exist_ok=True)
    results: List[Dict] = []

    for i, (upload, patient_id) in enumerate(zip(files, patient_id_list)):
        logger.info(f"Batch [{i + 1}/{len(files)}] patient {patient_id}: {upload.filename}")

        if not AudioProcessor.is_audio_file(upload.filename):
            results.append({
                "patient_id": patient_id,
                "filename":   upload.filename,
                "status":     "error",
                "error":      "Unsupported audio format",
            })
            continue

        raw_path: Optional[str] = None
        wav_path: Optional[str] = None

        try:
            raw_path = os.path.join(
                batch_dir,
                f"batch_{patient_id}_{int(time.time())}_{upload.filename}",
            )
            with open(raw_path, "wb") as f:
                shutil.copyfileobj(upload.file, f)

            wav_path = AudioProcessor.convert_to_wav(raw_path)
            _safe_remove(raw_path)

            chunks        = AudioProcessor.split_audio(wav_path)
            chunk_results = await asyncio.gather(*(process_audio_chunk(c) for c in chunks))

            combined_english = " ".join(r["english"] for r in chunk_results if r["english"])
            final_summary    = await llama_summarize(combined_english)   # ← Llama, not rule-based

            results.append({
                "patient_id":          patient_id,
                "filename":            upload.filename,
                "status":              "success",
                "english_translation": combined_english,
                "summary":             final_summary,
            })

        except Exception as exc:
            logger.error(f"Batch error for patient {patient_id} ({upload.filename}): {exc}")
            results.append({
                "patient_id": patient_id,
                "filename":   upload.filename,
                "status":     "error",
                "error":      str(exc),
            })
        finally:
            if wav_path:
                _safe_remove(wav_path)

    for d in (batch_dir, os.path.join(TEMP_DIR, "chunks")):
        if os.path.isdir(d):
            try:
                shutil.rmtree(d)
            except OSError:
                pass

    successful = [r for r in results if r["status"] == "success"]
    failed     = [r for r in results if r["status"] == "error"]

    return {
        "total_files": len(files),
        "successful":  len(successful),
        "failed":      len(failed),
        "results":     results,
    }