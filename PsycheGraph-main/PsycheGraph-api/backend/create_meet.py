import datetime
import os
import sys

# Add the backend directory to sys.path so we can import 'app'
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.services.google_calendar import GoogleCalendarService

def main():
    try:
        service = GoogleCalendarService()
        now = datetime.datetime.now(datetime.timezone.utc)
        start_time = now + datetime.timedelta(minutes=5)
        end_time = start_time + datetime.timedelta(hours=1)
        
        print("Creating a real Google Meet link...")
        meet_link = service.create_event(
            summary="Instant PsycheGraph Meeting",
            start_time=start_time,
            end_time=end_time
        )
        
        print(f"DEBUG: create_event returned: {meet_link}")
        
        if meet_link:
            print(f"\nSUCCESS! Your Google Meet link is: {meet_link}")
        else:
            print("\nFAILED to create Meet link. Check your credentials.json and token.json.")
    except Exception as e:
        print(f"\nAn error occurred in main: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()