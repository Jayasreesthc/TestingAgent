import os
import logging
import requests
from pathlib import Path
from dotenv import load_dotenv

logger = logging.getLogger("fireflies")

_base_dir = Path(__file__).resolve().parent.parent.parent
load_dotenv(_base_dir / ".env")

FIREFLIES_API_KEY = os.getenv("FIREFLIES_API_KEY", "")
FIREFLIES_URL = "https://api.fireflies.ai/graphql"


def _headers():
    return {
        "Authorization": f"Bearer {FIREFLIES_API_KEY}",
        "Content-Type": "application/json"
    }


def send_bot_to_meeting(meet_link: str, title: str = "Doctor Appointment") -> bool:
    """
    Sends Fireflies bot to a live Google Meet.
    Uses the correct field name: meeting_link (not url).
    Rate limited to 3 requests per 20 minutes on free plan.
    Returns True if successful, False otherwise.
    """
    if not FIREFLIES_API_KEY:
        logger.error("[FIREFLIES] FIREFLIES_API_KEY not set in .env")
        return False

    if not meet_link:
        logger.error("[FIREFLIES] No meet link provided")
        return False

    query = """
    mutation AddToLiveMeeting($meetingLink: String!, $title: String) {
        addToLiveMeeting(meeting_link: $meetingLink, title: $title) {
            success
        }
    }
    """

    try:
        response = requests.post(
            FIREFLIES_URL,
            headers=_headers(),
            json={
                "query": query,
                "variables": {
                    "meetingLink": meet_link,
                    "title": title
                }
            },
            timeout=30
        )
        response.raise_for_status()
        data = response.json()

        errors = data.get("errors")
        if errors:
            logger.error(f"[FIREFLIES] GraphQL error: {errors}")
            return False

        success = data.get("data", {}).get("addToLiveMeeting", {}).get("success", False)
        if success:
            logger.info(f"[FIREFLIES] Bot successfully sent to: {meet_link}")
        else:
            logger.warning(f"[FIREFLIES] Bot not sent — response: {data}")
        return success

    except Exception as e:
        logger.error(f"[FIREFLIES] Error sending bot: {e}")
        return False


def get_transcript(meet_link: str) -> dict | None:
    """
    Fetches the most recent Fireflies transcript matching the meet link.
    Call this after the meeting ends (Fireflies takes a few minutes to process).
    Returns dict with transcript text and summary, or None if not found.
    """
    if not FIREFLIES_API_KEY:
        logger.error("[FIREFLIES] FIREFLIES_API_KEY not set in .env")
        return None

    query = """
    query Transcripts {
        transcripts(limit: 10) {
            id
            title
            date
            meeting_link
            summary {
                overview
                action_items
            }
            sentences {
                speaker_name
                text
            }
        }
    }
    """

    try:
        response = requests.post(
            FIREFLIES_URL,
            headers=_headers(),
            json={"query": query},
            timeout=30
        )
        response.raise_for_status()
        data = response.json()

        transcripts = data.get("data", {}).get("transcripts", [])
        if not transcripts:
            logger.warning("[FIREFLIES] No transcripts found")
            return None

        # Match by meet link code (last part of URL e.g. abc-defg-hij)
        meet_code = meet_link.rstrip("/").split("/")[-1] if meet_link else ""
        matched = None

        for t in transcripts:
            t_link = t.get("meeting_link") or ""
            if meet_code and meet_code in t_link:
                matched = t
                break

        # Fall back to most recent if no match
        if not matched:
            logger.warning(f"[FIREFLIES] No exact match for {meet_link} — using most recent transcript")
            matched = transcripts[0]

        # Format sentences into readable transcript
        sentences = matched.get("sentences") or []
        lines = []
        for s in sentences:
            speaker = s.get("speaker_name") or "Unknown"
            text = (s.get("text") or "").strip()
            if text:
                lines.append(f"[{speaker}]: {text}")
        transcript_text = "\n".join(lines)

        summary_obj = matched.get("summary") or {}
        summary_text = summary_obj.get("overview") or ""
        action_items = summary_obj.get("action_items") or ""

        logger.info(f"[FIREFLIES] Transcript fetched: {matched.get('title')} — {len(sentences)} sentences")

        return {
            "transcript": transcript_text,
            "summary": summary_text,
            "action_items": action_items,
            "fireflies_id": matched.get("id"),
        }

    except Exception as e:
        logger.error(f"[FIREFLIES] Error fetching transcript: {e}")
        return None