# Camille

Interactive French voice agent that records a turn, transcribes it, generates a reply, then plays the response.

## Prerequisites

- Node.js 18+ and npm
- OpenAI API key with access to:
   - **Whisper API** (speech-to-text)
   - **GPT-4o** (conversation)
   - **TTS API** (`tts-1` model)

## Features

- 🎤 **Voice Conversations**: Speak naturally with an AI agent in French
- 🔄 **Record → Transcribe → Reply**: Reliable STT → GPT-4o → TTS pipeline
- 🎯 **Themed Interviews**: Pre-defined themes with professional interview questions
- 📝 **Push-to-Talk**: Hold to record, release to process
- 💾 **Conversation Storage**: Save and review past conversations
- 🔊 **Natural Voice**: High-quality text-to-speech responses

## Architecture

This project uses a modern, reliable audio processing pipeline:

**Audio Flow:**

```
🎤 Recording → 📝 Whisper (STT) → 🤖 GPT-4 → 🔊 TTS → ▶️ Playback
```

**Tech Stack:**

- **Frontend**: React + TypeScript + Vite
- **Backend**: Node.js + Express + Multer
- **AI Services**:
  - OpenAI Whisper API (Speech-to-Text)
  - OpenAI GPT-4 (Conversation AI)
  - OpenAI TTS API (Text-to-Speech)

### Why Not Realtime API?

The previous implementation used OpenAI's Realtime API, but we migrated to a more reliable request-response pattern because:

- ✅ **More Stable**: No WebSocket connection issues
- ✅ **Better Error Handling**: Clear failure points and recovery
- ✅ **Easier Debugging**: Each step is logged and traceable
- ✅ **Cost Effective**: Pay only for what you use
- ✅ **Higher Quality**: Uses proven, stable APIs

## Setup

### Option 1: Dev Container (Recommended)

For a consistent development environment using VS Code Dev Containers:

1. **Prerequisites**

   - [Docker](https://www.docker.com/products/docker-desktop) installed and running
   - [VS Code](https://code.visualstudio.com/) with [Dev Containers extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers)

2. **Clone and open**

   ```bash
   git clone https://github.com/maxneuvians/camille.git
   cd camille
   code .
   ```

3. **Reopen in container**
   - Click "Reopen in Container" when prompted
   - Or use Command Palette: `Dev Containers: Reopen in Container`
   - Dependencies will be installed automatically

See [.devcontainer/README.md](.devcontainer/README.md) for more details.

### Option 2: Local Setup

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

1. **Select a Theme**: Choose from pre-defined interview themes like "Le travail en équipe".
2. **Enter API Key**: Provide your OpenAI API key (stored locally in the browser).
3. **Configure Audio**: Click "Configurer" to enable recording for the session.
4. **Push to Talk**: Hold the microphone button (or press space) to record; release to send.
5. **Processing**: Backend transcribes, generates the reply, converts it to speech, and sends back base64 audio.
6. **Playback**: Audio is played automatically; transcript is added to the conversation history.
7. **End Conversation**: Click "Terminer" to save and exit.

## How It Works

When you speak:

1. 🎤 **Recording**: Browser captures audio using MediaRecorder (WebM/Opus)
2. 📤 **Upload**: Audio blob sent to `/api/audio/process` endpoint
3. 📝 **Transcription**: Whisper API converts speech to French text
4. 🤖 **AI Response**: GPT-4 generates a contextual response
5. 🔊 **Text-to-Speech**: TTS API converts response to MP3 audio
6. 📥 **Download**: Audio returned as base64-encoded data
7. ▶️ **Playback**: Frontend plays the audio response

## Project Structure

```
camille/
├── backend/
│   ├── src/
│   │   ├── data/           # Themes and conversation storage
│   │   ├── routes/         # API endpoints (audio, conversations, themes)
│   │   ├── services/       # Business logic (audio pipeline)
│   │   ├── types/          # TypeScript types
│   │   └── index.ts        # Server entry point
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/     # React components (VoiceAgent, ThemeSelector)
│   │   ├── services/       # API clients (audio)
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
  "questions": ["Question 1?", "Question 2?", "Question 3?", "Question 4?"]
}
```

## Evaluation System

Conversations can be evaluated after completion. The evaluation framework is extensible and stored in the conversation data structure. Future enhancements can add:

- Custom evaluation criteria
- Scoring rubrics
- Automated assessment using AI
- Performance analytics

## API Endpoints

### Audio Processing (Primary)

**POST /api/audio/process**

- Processes audio through STT→GPT→TTS pipeline
- Request: `multipart/form-data`
  - `audio`: Audio file (WebM/Opus from browser)
  - `conversationId`: Conversation ID
  - `themeId`: Theme ID
  - `apiKey`: OpenAI API key
- Response: `{ transcript, response, audioBase64 }`
- Audio response: MP3 in base64 encoding

**POST /api/audio/transcribe** (optional)

- Transcribe audio without generating response
- Request: `multipart/form-data` with `audio` and `apiKey`
- Response: `{ transcript }`

### Themes

- `GET /api/themes` - List all themes
- `GET /api/themes/:id` - Get theme by ID

### Conversations

- `GET /api/conversations` - List all conversations
- `GET /api/conversations/:id` - Get conversation by ID
- `POST /api/conversations` - Create new conversation
- `PUT /api/conversations/:id` - Update conversation

## Building for Production

```bash
npm run build
```

This builds both frontend and backend:

- Backend: Compiled to `backend/dist/`
- Frontend: Built to `frontend/dist/`

## Testing

The project includes comprehensive test coverage for both backend and frontend.

### Running Tests

```bash
# Run all tests
npm test

# Run backend tests only
npm run test:backend

# Run frontend tests only
npm run test:frontend

# Run tests with coverage
npm run test:coverage --workspace=backend
npm run test:coverage --workspace=frontend
```

### Test Coverage

- **Backend**: 29 tests using Jest (routes, services)
- **Frontend**: 15 tests using Vitest (components, API client)
- **Total**: 44 automated tests

## Continuous Integration

This project uses GitHub Actions for CI/CD:

- ✅ **Automated Testing**: All tests run on every push and pull request
- ✅ **Code Quality**: ESLint checks on frontend code
- ✅ **Security Scanning**: CodeQL analyzes code for vulnerabilities
- ✅ **Dependency Review**: Checks for vulnerable dependencies
- ✅ **Build Verification**: Ensures both backend and frontend build successfully

Workflows are located in `.github/workflows/`:

- `ci.yml` - Main CI pipeline (build, test, lint)
- `codeql.yml` - Security code scanning
- `dependency-review.yml` - Dependency vulnerability scanning

### Audio Not Playing

If you're experiencing audio playback issues, see the comprehensive debugging guide:

- [AUDIO_PLAYBACK_DEBUG.md](AUDIO_PLAYBACK_DEBUG.md) - Step-by-step debugging instructions
- [NEW_AUDIO_FLOW.md](NEW_AUDIO_FLOW.md) - Technical details of the audio pipeline

Common issues:

- **Browser autoplay policy**: Some browsers block automatic audio playback
- **HTTPS requirement**: Audio APIs may require secure context (HTTPS)
- **API key permissions**: Ensure your OpenAI key has Whisper, GPT-4, and TTS access
- **Network issues**: Check browser console and network tab for errors

### Development

See additional documentation:

- [QUICK_START.md](QUICK_START.md) - Quick start guide
- [CONTRIBUTING.md](CONTRIBUTING.md) - Development guidelines
- [ERROR_HANDLING_FIXES.md](ERROR_HANDLING_FIXES.md) - Error handling implementation details

## License

MIT - See [LICENSE](LICENSE) file for details
