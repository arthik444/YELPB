"""
Google Calendar Integration Service

Handles OAuth2 authentication and calendar event creation.
"""

from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
import logging
from config import settings

logger = logging.getLogger(__name__)

# OAuth2 scopes for Google Calendar
SCOPES = ['https://www.googleapis.com/auth/calendar.events']


class GoogleCalendarService:
    """Service for Google Calendar API operations"""

    def __init__(self):
        self.redirect_uri = settings.google_oauth_redirect_uri

    def get_authorization_url(self, state: str) -> str:
        """
        Generate OAuth2 authorization URL

        Args:
            state: Random state string for CSRF protection

        Returns:
            Authorization URL for user to visit
        """
        flow = Flow.from_client_config(
            {
                "web": {
                    "client_id": settings.google_calendar_client_id,
                    "client_secret": settings.google_calendar_client_secret,
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                    "redirect_uris": [self.redirect_uri]
                }
            },
            scopes=SCOPES,
            redirect_uri=self.redirect_uri
        )

        authorization_url, _ = flow.authorization_url(
            access_type='offline',
            include_granted_scopes='true',
            state=state,
            prompt='consent'
        )

        return authorization_url

    def exchange_code_for_token(self, code: str) -> Dict[str, Any]:
        """
        Exchange authorization code for access token

        Args:
            code: Authorization code from OAuth callback

        Returns:
            Token dictionary with access_token, refresh_token, etc.
        """
        flow = Flow.from_client_config(
            {
                "web": {
                    "client_id": settings.google_calendar_client_id,
                    "client_secret": settings.google_calendar_client_secret,
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                    "redirect_uris": [self.redirect_uri]
                }
            },
            scopes=SCOPES,
            redirect_uri=self.redirect_uri
        )

        flow.fetch_token(code=code)
        credentials = flow.credentials

        return {
            "access_token": credentials.token,
            "refresh_token": credentials.refresh_token,
            "token_uri": credentials.token_uri,
            "client_id": credentials.client_id,
            "client_secret": credentials.client_secret,
            "scopes": credentials.scopes,
            "expiry": credentials.expiry.isoformat() if credentials.expiry else None
        }

    async def create_calendar_event(
        self,
        access_token: str,
        refresh_token: Optional[str],
        event_details: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Create a calendar event

        Args:
            access_token: User's Google OAuth access token
            refresh_token: Optional refresh token
            event_details: Event information

        Returns:
            Created event details including event link
        """
        try:
            # Create credentials from token
            credentials = Credentials(
                token=access_token,
                refresh_token=refresh_token,
                token_uri="https://oauth2.googleapis.com/token",
                client_id=settings.google_calendar_client_id,
                client_secret=settings.google_calendar_client_secret,
                scopes=SCOPES
            )

            # Refresh token if expired
            if credentials.expired and credentials.refresh_token:
                credentials.refresh(Request())

            # Build Calendar API service
            service = build('calendar', 'v3', credentials=credentials)

            # Create event
            event = {
                'summary': event_details['title'],
                'location': event_details.get('location', ''),
                'description': event_details.get('description', ''),
                'start': {
                    'dateTime': event_details['start_time'],
                    'timeZone': event_details.get('timezone', 'America/New_York'),
                },
                'end': {
                    'dateTime': event_details['end_time'],
                    'timeZone': event_details.get('timezone', 'America/New_York'),
                },
                'reminders': {
                    'useDefault': False,
                    'overrides': [
                        {'method': 'popup', 'minutes': 60},  # 1 hour before
                        {'method': 'popup', 'minutes': 15},  # 15 minutes before
                    ],
                },
            }

            # Add attendees if provided
            if 'attendees' in event_details and event_details['attendees']:
                event['attendees'] = [
                    {'email': email} for email in event_details['attendees']
                ]

            # Insert event
            created_event = service.events().insert(
                calendarId='primary',
                body=event,
                sendUpdates='all' if 'attendees' in event else 'none'
            ).execute()

            logger.info(f"Calendar event created: {created_event['id']}")

            return {
                "success": True,
                "event_id": created_event['id'],
                "event_link": created_event.get('htmlLink'),
                "message": "Event added to calendar successfully"
            }

        except HttpError as e:
            logger.error(f"Calendar API error: {str(e)}")
            return {
                "success": False,
                "error": f"Failed to create calendar event: {str(e)}"
            }
        except Exception as e:
            logger.error(f"Unexpected error creating calendar event: {str(e)}")
            return {
                "success": False,
                "error": f"Unexpected error: {str(e)}"
            }


# Singleton instance
calendar_service = GoogleCalendarService()
