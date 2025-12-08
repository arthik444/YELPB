# Group Consensus Backend

FastAPI backend for Group Consensus application with Yelp AI Chat API integration.

## Setup

### 1. Install Dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 2. Configure Environment Variables

Copy the example environment file and add your Yelp API key:

```bash
cp .env.example .env
```

Edit `.env` and add your API keys:

```
YELP_API_KEY=your_actual_api_key_here
GEMINI_API_KEY=your_gemini_api_key_here
GOOGLE_CALENDAR_CLIENT_ID=your_google_client_id_here
GOOGLE_CALENDAR_CLIENT_SECRET=your_google_client_secret_here
```

To get the required API keys:

**Yelp API Key:**
1. Go to https://www.yelp.com/developers
2. Create an account or sign in
3. Create a new app
4. Copy your API Key

**Google Gemini API Key:**
1. Go to https://ai.google.dev/
2. Sign in with your Google account
3. Create an API key
4. Copy your API Key

**Google Calendar OAuth2:**
1. Go to https://console.cloud.google.com/
2. Create a new project or select an existing one
3. Enable the Google Calendar API
4. Create OAuth 2.0 credentials
5. Copy your Client ID and Client Secret

### 3. Run the Server

```bash
python main.py
```

Or use uvicorn directly:

```bash
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

The server will start at `http://127.0.0.1:8000`

## API Endpoints

### Health Check

```
GET /
GET /health
```

Returns server status.

### Chat with Yelp AI

```
POST /api/yelp/chat
```

**Request Body:**
```json
{
  "query": "What's a good vegan pizza place near me?",
  "user_context": {
    "locale": "en_US",
    "latitude": 40.7128,
    "longitude": -74.0060
  },
  "chat_id": "optional_for_followup_questions"
}
```

**Response:**
```json
{
  "response_text": "Here are some great vegan pizza places near you...",
  "chat_id": "conversation_id_123",
  "businesses": [
    {
      "id": "business_id",
      "name": "Pizza Place",
      "rating": 4.5,
      "reviews": 234,
      "price": "$$",
      "distance": "1.2 mi",
      "image": "https://...",
      "tags": ["Pizza", "Vegan", "Italian"],
      "votes": 0
    }
  ],
  "types": ["business_search"]
}
```

### Search Businesses (Simplified)

```
POST /api/yelp/search
```

**Request Body:**
```json
{
  "query": "italian restaurants",
  "latitude": 40.7128,
  "longitude": -74.0060,
  "locale": "en_US"
}
```

**Response:**
```json
[
  {
    "id": "business_id",
    "name": "Restaurant Name",
    "rating": 4.5,
    "reviews": 234,
    "price": "$$",
    "distance": "1.2 mi",
    "image": "https://...",
    "tags": ["Italian", "Pasta"],
    "votes": 0
  }
]
```

## Project Structure

```
backend/
├── main.py              # FastAPI application and endpoints
├── config.py            # Configuration and settings
├── models.py            # Pydantic models for request/response
├── yelp_service.py      # Yelp AI API service
├── gemini_service.py    # Google Gemini multimodal AI service
├── calendar_service.py  # Google Calendar integration service
├── requirements.txt     # Python dependencies
├── .env.example         # Example environment variables
├── .env                 # Your actual environment variables (gitignored)
└── README.md           # This file
```

## Features

- **Yelp AI Chat Integration**: Natural language queries for business discovery
- **Multi-turn Conversations**: Support for follow-up questions using chat_id
- **Location-aware Search**: Uses user coordinates for local results
- **Multimodal AI Processing**: Audio and image analysis using Google Gemini
  - Audio transcription and intent extraction
  - Food/restaurant image recognition
  - Combined multimodal search
- **Google Calendar Integration**: Create calendar events for restaurant visits
- **CORS Enabled**: Frontend can connect from localhost:3000
- **Type-safe**: Full Pydantic model validation
- **Error Handling**: Comprehensive error logging and handling

## Development

### Running Tests

```bash
pytest
```

### API Documentation

Once the server is running, visit:
- Swagger UI: http://127.0.0.1:8000/docs
- ReDoc: http://127.0.0.1:8000/redoc

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `YELP_API_KEY` | Your Yelp API key (required) | - |
| `YELP_API_BASE_URL` | Yelp API base URL | `https://api.yelp.com` |
| `GEMINI_API_KEY` | Google Gemini API key (required) | - |
| `GOOGLE_CALENDAR_CLIENT_ID` | Google OAuth2 client ID (required) | - |
| `GOOGLE_CALENDAR_CLIENT_SECRET` | Google OAuth2 client secret (required) | - |
| `GOOGLE_OAUTH_REDIRECT_URI` | OAuth2 redirect URI | `http://localhost:3000/auth/google/callback` |
| `HOST` | Server host | `127.0.0.1` |
| `PORT` | Server port | `8000` |
| `CORS_ORIGINS` | Allowed CORS origins | `http://localhost:3000,http://127.0.0.1:3000` |

## Troubleshooting

### "YELP_API_KEY is required"

Make sure you've created a `.env` file and added your API key:
```
YELP_API_KEY=your_key_here
```

### CORS Errors

If your frontend is running on a different port, add it to `CORS_ORIGINS` in `.env`:
```
CORS_ORIGINS=http://localhost:3000,http://localhost:5173
```

### Connection Refused

Make sure the backend server is running and accessible at the configured host and port.
