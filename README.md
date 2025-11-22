# ScribeAI

AI-powered audio transcription application with real-time processing and speaker diarization.

## Features

- Real-time audio recording from microphone or browser tab
- Live transcription with AI-powered speech recognition
- Speaker diarization and identification
- Session management and history
- Export transcripts in multiple formats (TXT, PDF, JSON)
- Responsive web interface

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 15+
- Gemini API key

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd ScribeAI
```

2. Install dependencies:
```bash
npm install
cd server && npm install && cd ..
```

3. Set up environment variables:
```bash
cp .env.example .env.local
# Edit .env.local with your database URL and API keys
```

4. Set up the database:
```bash
npm run db:push
```

5. Start the development servers:
```bash
# Terminal 1: Next.js frontend
npm run dev

# Terminal 2: Socket.io server
npm run server
```

6. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Architecture

```
Audio Capture (MediaRecorder) → Socket.io → Gemini API → PostgreSQL
                ↓
        Real-time UI Updates ← WebSocket Events ← Processing Pipeline
```

### State Machine

Sessions follow this lifecycle:
- IDLE → RECORDING → PAUSED → RECORDING → PROCESSING → COMPLETED

## API Reference

### Socket.io Events

**Client → Server:**
- `session:start` - Start new recording session
- `audio:chunk` - Send audio data chunk
- `session:pause` - Pause current session
- `session:stop` - Stop and process session

**Server → Client:**
- `transcript:partial` - Real-time transcript updates
- `status:update` - Session status changes
- `session:completed` - Final results with summary

## Scalability Analysis

ScribeAI's architecture scales horizontally for concurrent sessions through stateless processing:

**Audio Pipeline**: Each recording session operates independently. The MediaRecorder chunks (30s intervals) are transmitted via Socket.io to the Node.js server, which queues them for Gemini API processing. Since Gemini calls are asynchronous, the server handles 10+ simultaneous sessions on a 2-core instance without blocking. For enterprise loads (50+ concurrent users), deploy multiple Node.js workers behind a load balancer (Socket.io sticky sessions required).

**Memory Management**: Client-side IndexedDB buffering prevents browser crashes during 1hr+ sessions. The server processes chunks in a stream pipeline—audio data is never fully loaded into RAM. Postgres stores transcripts as JSONB chunks (indexed by timestamp), enabling pagination for long meetings without fetching the entire transcript.

**Database Optimization**: Connection pooling (Prisma default: 10 connections) handles concurrent writes. For >100 daily users, add read replicas for session history queries. Archive completed sessions older than 90 days to cold storage (e.g., AWS Glacier).

**Bottleneck: Gemini API** rate limits (60 req/min). Mitigation: Implement a Redis-backed queue to batch chunks during peak hours, displaying "Transcription queued" with ETA. For premium users, rotate API keys or upgrade to enterprise tier (higher limits).

**Cost Projection**: ~$0.02/hour/user (Gemini pricing + server compute).

## Troubleshooting

### Common Issues

1. **Microphone permission denied**
   - Ensure HTTPS in production
   - Check browser permissions in settings

2. **Tab audio not working**
   - Only works in Chrome/Edge
   - Requires user gesture to start

3. **Gemini API rate limits**
   - Implement request queuing
   - Consider multiple API keys for scaling

### Development

```bash
# Generate Prisma client after schema changes
npm run db:generate

# Reset database
npm run db:push --force-reset

# Run linting
npm run lint
```

## License

MIT