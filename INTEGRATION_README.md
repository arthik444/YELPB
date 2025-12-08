# Frontend-Backend Integration Guide

This guide explains how to run the integrated application with both frontend and backend.

## Architecture Overview

- **Frontend**: React + Vite (Port 3000)
- **Backend**: FastAPI (Port 8000)
- **Communication**: REST API with CORS enabled

## Prerequisites

- Node.js 18+ and npm
- Python 3.10+
- Yelp API key
- Google Gemini API key
- (Optional) Google Calendar OAuth credentials

## Setup Instructions

### 1. Backend Setup

Navigate to the backend directory:

```bash
cd backend
```

Create a virtual environment:

```bash
python -m venv venv

# Windows
venv\Scripts\activate

# macOS/Linux
source venv/bin/activate
```

Install Python dependencies:

```bash
pip install -r requirements.txt
```

Create `.env` file in the `backend` directory:

```bash
cp .env.example .env
```

Edit `backend/.env` and add your API keys:

```env
YELP_API_KEY=your_actual_yelp_api_key
GEMINI_API_KEY=your_actual_gemini_api_key
GOOGLE_CALENDAR_CLIENT_ID=your_google_client_id
GOOGLE_CALENDAR_CLIENT_SECRET=your_google_client_secret
```

Start the backend server:

```bash
python main.py
```

The backend will run on http://localhost:8000

### 2. Frontend Setup

Open a new terminal and navigate to the project root:

```bash
cd ..
```

Install Node.js dependencies:

```bash
npm install
```

The `.env` file is already created with:

```env
VITE_API_URL=http://localhost:8000
```

Start the frontend development server:

```bash
npm run dev
```

The frontend will run on http://localhost:3000

## API Endpoints

### Yelp Integration

- `POST /api/yelp/search` - Search for businesses
- `POST /api/yelp/chat` - Chat with Yelp AI

### Gemini Multimodal

- `POST /api/gemini/process-audio` - Process audio input
- `POST /api/gemini/process-image` - Process image input
- `POST /api/gemini/multimodal-search` - Combined text/audio/image search
- `POST /api/gemini/transcribe-audio` - Transcribe audio to text

### Google Calendar

- `GET /api/calendar/auth/start` - Start OAuth flow
- `GET /api/calendar/auth/callback` - OAuth callback
- `POST /api/calendar/create-event` - Create calendar event

## How It Works

1. **SwipeScreen Component** (`src/components/SwipeScreen.tsx`)
   - Fetches restaurant data from the backend on mount
   - Uses custom hooks for better state management
   - Automatic geolocation detection for personalized results
   - Tracks liked restaurants with "YUM!" animation
   - Displays loading/error states with retry functionality

2. **Custom Hooks**
   - `useYelpSearch` (`src/hooks/useYelpSearch.ts`) - Manages restaurant search and chat state
   - `useGeolocation` (`src/hooks/useGeolocation.ts`) - Handles user location detection with fallback

3. **API Service** (`src/services/api.ts`)
   - Centralized service for all backend communication
   - Custom `YelpAPIError` class for better error handling
   - Handles request/response formatting with type safety
   - Automatically maps backend Business model to frontend types

4. **Vite Proxy** (`vite.config.ts`)
   - Proxies `/api` requests to backend
   - Avoids CORS issues during development
   - Automatically forwards requests to http://localhost:8000

5. **CORS Configuration** (Backend `main.py`)
   - Allows requests from http://localhost:3000
   - Configured for local development

## Testing the Integration

1. Start the backend server (Port 8000)
2. Start the frontend server (Port 3000)
3. Navigate to http://localhost:3000 in your browser
4. The app should fetch restaurants from the Yelp API via the backend
5. You can swipe through restaurants fetched from real data

## API Usage Examples

### Using the useYelpSearch Hook

```typescript
import { useYelpSearch } from './hooks/useYelpSearch';

function MyComponent() {
  const { businesses, loading, error, search } = useYelpSearch();

  useEffect(() => {
    search({
      query: 'pizza',
      latitude: 37.7749,
      longitude: -122.4194,
      locale: 'en_US',
    });
  }, []);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return <div>{/* Render businesses */}</div>;
}
```

### Using Geolocation

```typescript
import { useGeolocation } from './hooks/useGeolocation';

function MyComponent() {
  const { location, loading, error, requestLocation } = useGeolocation();

  return (
    <button onClick={requestLocation}>
      Get My Location
    </button>
  );
}
```

### Direct API Service Usage

```typescript
import { apiService } from './services/api';

// Search restaurants
const businesses = await apiService.searchBusinesses({
  query: 'pizza',
  latitude: 37.7749,
  longitude: -122.4194,
  locale: 'en_US',
});

// Multimodal search
const result = await apiService.multimodalSearch({
  text_query: 'Italian restaurants',
  latitude: 37.7749,
  longitude: -122.4194,
});
```

## Troubleshooting

### Backend won't start

- Check that all required environment variables are set in `backend/.env`
- Ensure Python dependencies are installed
- Verify Python version is 3.10+

### Frontend can't connect to backend

- Verify backend is running on port 8000
- Check Vite proxy configuration in `vite.config.ts`
- Check browser console for CORS errors

### No restaurants loading

- Verify Yelp API key is valid
- Check backend logs for API errors
- Test backend directly at http://localhost:8000/health

## Development Tips

1. **Hot Reload**: Both frontend and backend support hot reload
2. **API Testing**: Use http://localhost:8000/docs for interactive API docs
3. **Error Logging**: Check terminal output for both servers
4. **Environment Variables**: Never commit `.env` files with real API keys

## Production Deployment

For production:

1. Set `VITE_API_URL` to your production backend URL
2. Update `CORS_ORIGINS` in backend to your production domain
3. Use proper secret management for API keys
4. Consider using a reverse proxy (nginx) to serve both frontend and backend
5. Enable HTTPS

## Next Steps

- Implement user location detection for personalized results
- Add session management for multi-user voting
- Integrate WebSocket for real-time updates
- Add calendar integration to winner screen
- Implement audio/image search in the UI
