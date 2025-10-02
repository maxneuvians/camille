# Quick Start Guide

## Prerequisites
- Node.js 18+ and npm
- An OpenAI API key with access to the Realtime API (gpt-4o-realtime-preview-2024-12-17)

## Installation

```bash
# Clone the repository
git clone https://github.com/maxneuvians/camille.git
cd camille

# Install all dependencies (frontend, backend, and root)
npm install
```

## Development

### Option 1: Start Both Servers Together (Recommended)
```bash
npm run dev
```

This will start:
- Backend API at http://localhost:3001
- Frontend UI at http://localhost:5173

### Option 2: Start Servers Separately
```bash
# Terminal 1 - Backend
npm run dev:backend

# Terminal 2 - Frontend  
npm run dev:frontend
```

## Usage

1. Open your browser to http://localhost:5173
2. Select an interview theme from the three options
3. Enter your OpenAI API key (it will be stored in your browser's localStorage)
4. Click "Se connecter" to establish the WebSocket connection
5. Hold down the "🎤 Appuyer pour parler" button to speak
6. Release the button to send your audio
7. The agent will respond in French, and you'll see the transcription in real-time
8. Click "Terminer" when done to save the conversation

## API Endpoints

The backend exposes the following REST API:

- `GET /api/health` - Health check
- `GET /api/themes` - List all interview themes
- `GET /api/themes/:id` - Get a specific theme
- `GET /api/conversations` - List all conversations
- `GET /api/conversations/:id` - Get a specific conversation
- `POST /api/conversations` - Create a new conversation (requires `themeId`)
- `PUT /api/conversations/:id` - Update a conversation

WebSocket endpoint:
- `WS /realtime?conversationId=<id>&apiKey=<key>` - Real-time voice connection

## Configuration

### Backend
Create `backend/.env` (optional, uses defaults):
```env
PORT=3001
```

### Frontend
Create `frontend/.env` (optional, uses defaults):
```env
VITE_API_BASE=http://localhost:3001/api
VITE_WS_BASE=ws://localhost:3001
```

## Building for Production

```bash
# Build both frontend and backend
npm run build

# Or build individually
npm run build:backend
npm run build:frontend
```

Build outputs:
- Backend: `backend/dist/`
- Frontend: `frontend/dist/`

## Running Production Build

```bash
# Start the backend server
cd backend
node dist/index.js

# Serve the frontend (use any static file server)
cd frontend
npx serve dist
```

## Project Structure

```
camille/
├── backend/                    # Node.js/Express backend
│   ├── src/
│   │   ├── data/              # Themes and conversation storage
│   │   │   └── themes.json    # Pre-defined interview themes
│   │   ├── routes/            # REST API routes
│   │   │   ├── themes.ts
│   │   │   └── conversations.ts
│   │   ├── services/          # Business logic
│   │   │   ├── data.service.ts      # Data persistence
│   │   │   └── realtime.service.ts  # WebSocket/OpenAI integration
│   │   ├── types/             # TypeScript type definitions
│   │   └── index.ts           # Server entry point
│   └── package.json
├── frontend/                   # React/TypeScript frontend
│   ├── src/
│   │   ├── components/        # React components
│   │   │   ├── ThemeSelector.tsx
│   │   │   └── VoiceAgent.tsx
│   │   ├── services/          # API clients
│   │   │   ├── api.ts         # REST API client
│   │   │   └── realtime.ts    # WebSocket client
│   │   ├── types/             # TypeScript type definitions
│   │   └── App.tsx            # Main application component
│   └── package.json
└── package.json               # Root package with workspace config

```

## Troubleshooting

### Cannot connect to OpenAI
- Ensure you have a valid OpenAI API key
- Verify your key has access to the Realtime API
- Check browser console for WebSocket errors

### Audio not working
- Grant microphone permissions when prompted
- Ensure you're using HTTPS or localhost (required for getUserMedia)
- Check browser compatibility (modern Chrome/Firefox/Safari)

### Backend connection errors
- Ensure backend is running on port 3001
- Check for port conflicts
- Verify CORS settings if accessing from different origin

## Adding New Themes

Edit `backend/src/data/themes.json`:

```json
{
  "id": "unique-theme-id",
  "title": "Titre du thème en français",
  "description": "Description du thème",
  "questions": [
    "Première question?",
    "Deuxième question?",
    "Troisième question?",
    "Quatrième question?"
  ]
}
```

Restart the backend server for changes to take effect.

## Support

For issues or questions, please open an issue on GitHub.
