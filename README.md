# Camille

Interactive real-time French voice agent for conducting professional interviews.

## Features

- 🎤 **Real-time Voice Conversations**: Interact with an AI agent in French using OpenAI's Realtime API
- 💬 **Live Transcription**: See conversation transcripts in real-time
- 🎯 **Themed Interviews**: Pre-defined themes with professional interview questions
- 📝 **Push-to-Talk**: Simple push-to-talk interface for controlled conversations
- 💾 **Conversation Storage**: Save and review past conversations
- 📊 **Evaluation Framework**: Extensible evaluation system for assessing conversations

## Architecture

This project uses a monorepo structure with:
- **Frontend**: React + TypeScript + Vite
- **Backend**: Node.js + Express + WebSocket
- **AI**: OpenAI Realtime API for voice interactions

## Prerequisites

- Node.js 18+ and npm
- OpenAI API key with access to Realtime API

## Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/maxneuvians/camille.git
   cd camille
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**

   Backend (optional - uses defaults):
   ```bash
   cd backend
   cp .env.example .env
   # Edit .env if needed
   ```

   Frontend (optional - uses defaults):
   ```bash
   cd frontend
   cp .env.example .env
   # Edit .env if needed
   ```

4. **Start the development servers**

   From the root directory:
   ```bash
   npm run dev
   ```

   This will start both backend (port 3001) and frontend (port 5173) servers.

   Alternatively, you can start them separately:
   ```bash
   # Terminal 1 - Backend
   npm run dev:backend

   # Terminal 2 - Frontend
   npm run dev:frontend
   ```

5. **Access the application**

   Open your browser to [http://localhost:5173](http://localhost:5173)

## Usage

1. **Select a Theme**: Choose from pre-defined interview themes like "Le travail en équipe"
2. **Enter API Key**: Provide your OpenAI API key (stored locally in browser)
3. **Connect**: Click "Se connecter" to establish connection
4. **Push to Talk**: Hold down the microphone button to speak, release to send
5. **View Transcripts**: See real-time transcription of the conversation
6. **End Conversation**: Click "Terminer" to save and exit

## Project Structure

```
camille/
├── backend/
│   ├── src/
│   │   ├── data/           # Themes and conversation storage
│   │   ├── routes/         # API endpoints
│   │   ├── services/       # Business logic
│   │   ├── types/          # TypeScript types
│   │   └── index.ts        # Server entry point
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── services/       # API and WebSocket clients
│   │   ├── types/          # TypeScript types
│   │   └── App.tsx         # Main app component
│   └── package.json
└── package.json            # Root package with workspace config
```

## Default Themes

The application comes with three pre-configured themes:

1. **Le travail en équipe** - Team work skills and experiences
2. **La communication au travail** - Professional communication skills
3. **La résolution de problèmes** - Problem-solving approaches

Each theme includes 4 relevant follow-up questions in French.

## Adding New Themes

Edit `backend/src/data/themes.json`:

```json
{
  "id": "new-theme-id",
  "title": "Titre du thème",
  "description": "Description du thème",
  "questions": [
    "Question 1?",
    "Question 2?",
    "Question 3?",
    "Question 4?"
  ]
}
```

## Evaluation System

Conversations can be evaluated after completion. The evaluation framework is extensible and stored in the conversation data structure. Future enhancements can add:

- Custom evaluation criteria
- Scoring rubrics
- Automated assessment using AI
- Performance analytics

## API Endpoints

### Themes
- `GET /api/themes` - List all themes
- `GET /api/themes/:id` - Get theme by ID

### Conversations
- `GET /api/conversations` - List all conversations
- `GET /api/conversations/:id` - Get conversation by ID
- `POST /api/conversations` - Create new conversation
- `PUT /api/conversations/:id` - Update conversation

### WebSocket
- `WS /realtime?conversationId=<id>&apiKey=<key>` - Real-time voice connection

## Building for Production

```bash
npm run build
```

This builds both frontend and backend:
- Backend: Compiled to `backend/dist/`
- Frontend: Built to `frontend/dist/`

## License

MIT - See [LICENSE](LICENSE) file for details
