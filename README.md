# YELP - Group Consensus Restaurant Finder

A collaborative restaurant discovery application built with Next.js and FastAPI, featuring AI-powered search, multimodal input processing, and group voting capabilities.

## Project Structure

This project consists of two main components:

- **Frontend**: Next.js application with React and TypeScript
- **Backend**: FastAPI Python server with Yelp AI, Google Gemini, and Google Calendar integrations

## Getting Started

### Frontend Setup

1. Install dependencies:

```bash
npm install
```

2. Configure environment variables:

Create a `.env.local` file in the root directory with your Firebase configuration:

```
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

3. Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

### Backend Setup

1. Navigate to the backend directory:

```bash
cd backend
```

2. Install Python dependencies:

```bash
pip install -r requirements.txt
```

3. Configure environment variables:

Copy `.env.example` to `.env` and add your API keys:

```bash
cp .env.example .env
```

4. Run the backend server:

```bash
python main.py
```

The backend API will be available at [http://127.0.0.1:8000](http://127.0.0.1:8000)

API documentation is available at:
- Swagger UI: http://127.0.0.1:8000/docs
- ReDoc: http://127.0.0.1:8000/redoc

For detailed backend setup and API documentation, see [backend/README.md](backend/README.md).

## Features

### Core Features
- **Room-Based Collaboration**: Create or join rooms with simple 4-character codes
- **Three-Factor Decision System**: Collaboratively decide on Budget, Cuisine, and Vibe
- **AI-Powered Private Strategist**: Personal AI assistant to help influence group decisions
- **Real-time Synchronization**: Live updates across all participants using Firebase
- **Public Activity Timeline**: See all proposals, locks, and events as they happen

### Restaurant Discovery
- **Yelp AI Integration**: Natural language search powered by Yelp's AI
- **Smart Multimodal Search**:
  - Text descriptions
  - Voice recordings (audio transcription & intent extraction)
  - Food photos (image recognition & similarity search)
- **Geolocation Support**: Automatic location detection for nearby results
- **Intelligent Filtering**: Results filtered by group's locked decisions

### Voting System
- **Democratic Voting**: Each participant votes on their favorite restaurant
- **Real-time Vote Tracking**: See votes as they come in
- **Winner Announcement**: Automatic winner determination with celebration animation
- **Detailed Results**: View vote counts and who voted for what

### User Experience
- **Toast Notifications**: Clear feedback for all actions
- **Loading States**: Skeleton screens and spinners for better UX
- **Error Handling**: Graceful error boundaries and user-friendly messages
- **Responsive Design**: Works seamlessly on mobile and desktop
- **Smooth Animations**: Polished transitions with Framer Motion

## Tech Stack

### Frontend
- Next.js 16
- React 19
- TypeScript
- Tailwind CSS
- Firebase
- Framer Motion
- Zustand (state management)

### Backend
- FastAPI
- Python 3.11+
- Yelp Fusion API
- Google Gemini AI
- Google Calendar API
- Pydantic for validation

## Project Structure

```
yelp/
├── src/
│   ├── app/                    # Next.js app directory
│   │   ├── layout.tsx          # Root layout with ToastContainer
│   │   ├── page.tsx            # Home/portal page
│   │   ├── room/[code]/
│   │   │   ├── page.tsx        # Main collaboration room
│   │   │   ├── vote/page.tsx   # Voting page with real Yelp data
│   │   │   ├── winner/page.tsx # Winner announcement
│   │   │   └── search/page.tsx # Multimodal search
│   │   └── api/chat/route.ts   # Gemini AI endpoint
│   ├── components/
│   │   ├── ui/                 # Reusable UI components
│   │   │   ├── ToastContainer.tsx
│   │   │   ├── AudioRecorder.tsx
│   │   │   ├── ImageUploader.tsx
│   │   │   └── SkeletonLoader.tsx
│   │   ├── portal/
│   │   │   └── IdentityModal.tsx
│   │   ├── room/
│   │   │   ├── ManifestHeader.tsx
│   │   │   ├── PublicTimeline.tsx
│   │   │   └── PrivateCockpit.tsx
│   │   └── ErrorBoundary.tsx
│   ├── hooks/                  # Custom React hooks
│   │   ├── useGeolocation.ts
│   │   ├── useRoom.ts
│   │   ├── useRoomEvents.ts
│   │   └── useYelpSearch.ts
│   ├── lib/
│   │   ├── api/
│   │   │   └── yelp.ts         # Backend API integration
│   │   ├── firebase.ts
│   │   └── utils.ts
│   ├── store/                  # Zustand state management
│   │   ├── userStore.ts
│   │   └── toastStore.ts
│   └── types/
│       └── index.ts            # Shared TypeScript types
├── backend/                    # Python FastAPI backend
│   ├── main.py
│   ├── config.py
│   ├── models.py
│   ├── yelp_service.py
│   ├── gemini_service.py
│   ├── calendar_service.py
│   ├── requirements.txt
│   ├── .env.example
│   └── README.md
└── .env.local.example         # Frontend environment variables

```

## Key Pages and Features

### 1. Home Page (`/`)
- Create or join a room
- Anonymous Firebase authentication
- User name input

### 2. Room Page (`/room/[code]`)
- Split view: Public Timeline (60%) + Private AI Chat (40%)
- Manifest header showing locked decisions
- Real-time event feed
- AI-powered lobbying system

### 3. Vote Page (`/room/[code]/vote`)
- Real Yelp restaurant results based on manifest
- Geolocation-aware search
- Real-time voting with Firebase
- Vote count display
- One vote per user

### 4. Winner Page (`/room/[code]/winner`)
- Celebration animation
- Winning restaurant details
- Get directions button
- View on Yelp link

### 5. Multimodal Search (`/room/[code]/search`)
- Text search input
- Audio recording
- Image upload
- AI analysis display
- Combined search results

## API Integration

The frontend connects to the Python backend for:

- **Yelp Search**: `/api/yelp/search` - Get restaurants
- **Yelp Chat**: `/api/yelp/chat` - Conversational search
- **Multimodal Search**: `/api/gemini/multimodal-search` - Combined inputs
- **Audio Transcription**: `/api/gemini/transcribe-audio`
- **Image Processing**: `/api/gemini/process-image`

## Deployment

### Frontend (Vercel)
1. Connect your GitHub repository to Vercel
2. Add environment variables from `.env.local.example`
3. Deploy automatically on push

### Backend (Railway/Render)
1. Connect backend directory to Railway or Render
2. Add environment variables from `backend/.env.example`
3. Deploy Python application
4. Update `NEXT_PUBLIC_API_URL` in frontend env

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - feel free to use this project for your own applications!
