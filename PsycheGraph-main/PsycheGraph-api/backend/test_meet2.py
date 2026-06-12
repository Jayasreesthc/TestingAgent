import os
from dotenv import load_dotenv
load_dotenv()
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
import requests
import uuid
from datetime import datetime, timezone, timedelta

TOKEN_PATH = "/home/ubuntu/PsycheGraph/PsycheGraph-api/backend/token.json"
SCOPES = ['https://www.googleapis.com/auth/calendar']

creds = Credentials.from_authorized_user_file(TOKEN_PATH, SCOPES)
if creds.expired:
    creds.refresh(Request())

now = datetime.now(timezone.utc)
start = now + timedelta(minutes=5)
end = now + timedelta(minutes=65)

event = {
    "summary": "Test Meet",
    "start": {"dateTime": start.isoformat(), "timeZone": "UTC"},
    "end": {"dateTime": end.isoformat(), "timeZone": "UTC"},
    "conferenceData": {
        "createRequest": {
            "requestId": str(uuid.uuid4()),
            "conferenceSolutionKey": {"type": "hangoutsMeet"}
        }
    }
}

headers = {"Authorization": f"Bearer {creds.token}"}
r = requests.post(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1",
    json=event,
    headers=headers,
    timeout=30
)
print("Status:", r.status_code)
print("Response:", r.json().get("hangoutLink", r.text[:200]))