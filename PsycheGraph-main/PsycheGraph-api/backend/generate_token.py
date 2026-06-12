from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
import os
import json

SCOPES = ['https://www.googleapis.com/auth/calendar']
CREDENTIALS_FILE = 'credentials.json'
TOKEN_FILE = 'token.json'

def generate_token():
    creds = None
    
    if os.path.exists(TOKEN_FILE):
        creds = Credentials.from_authorized_user_file(TOKEN_FILE, SCOPES)
    
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(
                CREDENTIALS_FILE, SCOPES
            )
            # ← access_type=offline gives you a refresh token
            # ← prompt=consent forces Google to give a NEW refresh token
            creds = flow.run_local_server(
                port=0,
                access_type='offline',
                prompt='consent'
            )
        
        with open(TOKEN_FILE, 'w') as token:
            token.write(creds.to_json())
        print("✅ token.json generated successfully!")
    else:
        print("✅ Token already valid!")
    
    print(f"Access Token: {creds.token[:20]}...")
    print(f"Refresh Token exists: {bool(creds.refresh_token)}")

if __name__ == "__main__":
    generate_token()