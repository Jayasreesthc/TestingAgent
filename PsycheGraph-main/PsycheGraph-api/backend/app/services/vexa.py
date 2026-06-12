import os
import logging
import requests
from pathlib import Path
from dotenv import load_dotenv

logger = logging.getLogger("vexa")

_base_dir = Path(__file__).resolve().parent.parent.parent
load_dotenv(_base_dir / ".env")

VEXA_API_KEY = os.getenv("VEXA_API_KEY", "")
VEXA_BASE_URL = "https://api.cloud.vexa.ai"


def _headers():
    return {
        "X-API-Key": VEXA_API_KEY,
        "Content-Type": "application/json"
    }


def extract_meeting_code(meet_link: str) -> str | None:
    """
    Extracts the meeting code from a Google Meet link.
    e.g. https://meet.google.com/abc-defg-hij -> abc-defg-hij
    """
    if not meet_link:
        return None
    parts = meet_link.rstrip("/").split("/")
    code = parts[-1]
    if len(code) > 5 and "-" in code:
        return code
    return None


def send_bot_to_meeting(meet_link: str, bot_name: str = "PsycheGraph Bot") -> bool:
    """
    Sends Vexa bot to a Google Meet using direct HTTP call.
    Returns True if successful, False otherwise.
    """
    if not VEXA_API_KEY:
        logger.error("[VEXA] VEXA_API_KEY not set in .env")
        return False

    meeting_code = extract_meeting_code(meet_link)
    if not meeting_code:
        logger.error(f"[VEXA] Could not extract meeting code from: {meet_link}")
        return False

    try:
        response = requests.post(
            f"{VEXA_BASE_URL}/bots",
            headers=_headers(),
            json={
                "platform": "google_meet",
                "native_meeting_id": meeting_code,
                "bot_name": bot_name
            },
            timeout=30
        )
        response.raise_for_status()
        logger.info(f"[VEXA] Bot sent to meeting: {meeting_code}")
        return True

    except Exception as e:
        logger.error(f"[VEXA] Error sending bot to meeting {meeting_code}: {e}")
        return False


def set_webhook_url(webhook_url: str) -> bool:
    """
    Registers the webhook URL with Vexa.
    Vexa will POST to this URL when a meeting ends.
    Correct endpoint: PUT /users/me/config
    """
    if not VEXA_API_KEY:
        logger.error("[VEXA] VEXA_API_KEY not set in .env")
        return False

    try:
        response = requests.put(
            f"{VEXA_BASE_URL}/users/me/config",
            headers=_headers(),
            json={"webhook_url": webhook_url},
            timeout=30
        )
        response.raise_for_status()
        logger.info(f"[VEXA] Webhook registered: {webhook_url}")
        return True

    except Exception as e:
        logger.error(f"[VEXA] Error registering webhook: {e}")
        return False


def get_transcript(meeting_code: str) -> dict | None:
    """
    Fetches full transcript from Vexa after meeting ends.
    Returns dict with transcript text, or None if failed.
    """
    if not VEXA_API_KEY:
        logger.error("[VEXA] VEXA_API_KEY not set in .env")
        return None

    try:
        response = requests.get(
            f"{VEXA_BASE_URL}/transcripts/google_meet/{meeting_code}",
            headers=_headers(),
            timeout=30
        )
        response.raise_for_status()
        data = response.json()

        segments = data if isinstance(data, list) else data.get("segments", [])
        if not segments:
            logger.warning(f"[VEXA] No segments in transcript for {meeting_code}")
            return None

        lines = []
        for seg in segments:
            speaker = seg.get("speaker") or seg.get("speaker_name") or "Unknown"
            text = (seg.get("text") or seg.get("content") or "").strip()
            if text:
                lines.append(f"[{speaker}]: {text}")

        transcript_text = "\n".join(lines)
        logger.info(f"[VEXA] Transcript fetched for {meeting_code} — {len(segments)} segments")

        return {
            "transcript": transcript_text,
            "segments": segments,
        }

    except Exception as e:
        logger.error(f"[VEXA] Error fetching transcript for {meeting_code}: {e}")
        return None