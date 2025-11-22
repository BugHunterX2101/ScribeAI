# ScribeAI Implementation Guide

## Implementation Overview

This guide breaks down the AI-powered audio transcription app into systematic phases, focusing on architecture, data flow, and critical decision points without diving into code specifics.

---

## Phase 1: Foundation Setup (Days 1-2)

### 1.1 Project Initialization
- Create Next.js 14+ project with TypeScript and App Router
- Install core dependencies: Prisma, Socket.io (client + server), Better Auth, Tailwind CSS
- Set up ESLint, Prettier, and Git repository with branch strategy (main, dev, feature branches)

### 1.2 Database Architecture
- Spin up Postgres instance (Docker locally or Supabase cloud)
- Design schema with three core tables:
  - **Users**: id, email, password_hash, created_at
  - **Sessions**: id, user_id, title, status (recording/paused/processing/completed), duration, created_at
  - **Transcripts**: id, session_id, content (TEXT/JSONB), summary, timestamp_chunks (array of {time, text})
- Initialize Prisma, create migrations, generate client

### 1.3 Authentication Setup
- Integrate Better Auth with session-based authentication
- Create protected routes middleware for /dashboard and /sessions
- Build login/signup pages with email validation

---

## Phase 2: Audio Capture Infrastructure (Days 3-5)

### 2.1 Browser Audio Streaming Strategy

**Critical Decision: MediaRecorder vs WebRTC**
- **Use MediaRecorder API** for simplicity:
  - Captures mic via `getUserMedia()` or tab audio via `getDisplayMedia()`
  - Emits Blob chunks every 10-30 seconds (configurable `timeslice`)
  - Lower latency for transcription pipeline
  
**Implementation Steps:**
1. Create React hook `useAudioRecorder()` managing:
   - Stream acquisition (mic/tab selection)
   - MediaRecorder lifecycle (start, pause, resume, stop)
   - Chunk buffering and transmission
   
2. Handle browser permissions:
   - Request mic access upfront for mic mode
   - For tab share: prompt `getDisplayMedia({audio: true, video: false})`
   - Display permission denial errors with retry UI

3. Chunk management:
   - Set `timeslice: 30000` (30s chunks) to balance latency vs API calls
   - Convert Blob chunks to ArrayBuffer → Base64 for Socket.io transmission
   - Maintain client-side buffer (last 60s) for pause/resume scenarios

### 2.2 Real-Time Communication Layer

**Socket.io Architecture:**
- Separate Node.js server (runs alongside Next.js on different port, e.g., 3001)
- Events structure:
  ```
  Client → Server:
  - 'session:start' {userId, mode: 'mic'|'tab'}
  - 'audio:chunk' {sessionId, data: base64, timestamp}
  - 'session:pause' {sessionId}
  - 'session:stop' {sessionId}
  
  Server → Client:
  - 'transcript:partial' {text, timestamp}
  - 'status:update' {status, percentage}
  - 'session:completed' {summary, downloadUrl}
  ```

**Resilience Features:**
1. **Reconnection Logic:**
   - Client detects disconnection, buffers chunks locally (IndexedDB)
   - On reconnect, sends buffered chunks with sequence numbers
   - Server deduplicates by sequence ID

2. **Heartbeat Mechanism:**
   - Ping every 15s to detect zombie connections
   - Auto-pause recording if 3 missed pings

3. **Error Recovery:**
   - If tab closes during tab-share, emit 'stream:lost' → auto-switch to mic
   - Display banner: "Tab closed - switched to microphone"

---

## Phase 3: Transcription Pipeline (Days 6-8)

### 3.1 Gemini API Integration

**Architecture Choice: Streaming vs Batch**
- Use **streaming mode** for live feedback:
  - Send each 30s chunk immediately to Gemini
  - Accumulate partial transcripts in memory (Node.js server)
  - Broadcast incremental updates to UI

**Prompt Engineering for Accuracy:**
```
System Prompt Template:
"Transcribe this audio chunk with speaker diarization. 
Identify speakers as Speaker A, B, etc. 
Preserve filler words and pauses. 
Context: [previous 2 chunks summary for continuity]
Output JSON: {speakers: [{id, text, timestamp}]}"
```

**Implementation Steps:**
1. Create Gemini service module:
   - Initialize API client with retry logic (exponential backoff)
   - Implement chunk queueing system (avoid rate limits: ~60 req/min)
   - Cache context window (last 2 chunks) for coherence

2. Handle long sessions (1+ hour):
   - Problem: 120+ chunks for 1hr session
   - Solution: Batch process every 10 chunks in background
   - Store intermediate transcripts in DB (partial saves every 5min)

3. Multi-speaker diarization:
   - Gemini's default speaker detection works for 2-4 speakers
   - For >4 speakers: send hint in prompt with expected participant count
   - Post-process: merge consecutive same-speaker segments

### 3.2 State Management

**Session States Flow:**
```
IDLE → (start) → RECORDING → (pause) → PAUSED → (resume) → RECORDING
  ↓                    ↓                                        ↓
(cancel)          (stop)                                   (stop)
  ↓                    ↓                                        ↓
CANCELLED        PROCESSING → (summary done) → COMPLETED
```

**Implementation via State Machine:**
- Use XState or simple reducer pattern
- Transitions trigger Socket.io broadcasts
- Persist state in Postgres after each transition

**UI Feedback:**
- RECORDING: Animated waveform, live word count ticker
- PROCESSING: Indeterminate progress bar with "Generating summary..." (estimate 10-30s)
- COMPLETED: Show summary card, download buttons (TXT, JSON, PDF)

---

## Phase 4: Frontend Development (Days 9-12)

### 4.1 Dashboard Layout

**Components Structure:**
```
/app
├── dashboard/
│   ├── page.tsx (landing, stats widgets)
│   └── layout.tsx (sidebar nav)
├── sessions/
│   ├── page.tsx (list view with filters)
│   ├── [id]/page.tsx (detail view)
│   └── new/page.tsx (recording interface)
└── components/
    ├── AudioRecorder.tsx
    ├── TranscriptViewer.tsx
    └── SessionCard.tsx
```

**Key UI Elements:**
1. **Recording Interface** (`/sessions/new`):
   - Device selector dropdown (mic vs tab-share)
   - Large circular "Record" button (color-coded: red=recording, yellow=paused)
   - Live transcript panel (auto-scroll, searchable)
   - Timer display (MM:SS format)
   - Emergency stop button (warns about unsaved data)

2. **Session History** (`/sessions`):
   - Table view: Title, Duration, Date, Status
   - Filters: Date range, status, search by keyword
   - Pagination (20 items per page)
   - Quick actions: Rename, Delete, Export

3. **Detail View** (`/sessions/[id]`):
   - Full transcript with timestamp markers (every 30s)
   - AI summary at top (collapsible)
   - Speaker labels color-coded
   - Export options: Plain text, JSON (with timestamps), PDF (formatted)

### 4.2 Real-Time Updates Implementation

**Socket.io Client Integration:**
1. Create context provider `<SocketProvider>`:
   - Initialize connection on mount
   - Expose `socket` instance to child components
   - Auto-reconnect with exponential backoff

2. Hook into recording component:
   ```
   useEffect for 'transcript:partial' events:
   - Append new text to local state
   - Trigger smooth scroll animation
   - Update word count badge
   ```

3. Optimistic UI updates:
   - Show "Stopping..." immediately on stop click
   - Roll back if server errors (rare)
   - Display retry button on failure

### 4.3 Responsive Design

**Mobile Considerations:**
- Tab-share unavailable on mobile → hide option, default to mic
- Simplified recorder UI (single-column layout)
- Swipe gestures for pause/resume
- Offline notice: "Desktop required for tab sharing"

**Accessibility:**
- ARIA labels for all controls
- Keyboard shortcuts (Space=pause, Esc=stop)
- High-contrast mode toggle
- Screen reader announcements for status changes

---

## Phase 5: Backend Services (Days 13-15)

### 5.1 Node.js WebSocket Server

**Server Architecture:**
```
/server
├── index.js (Express + Socket.io setup)
├── middleware/
│   └── auth.js (verify session tokens)
├── handlers/
│   ├── session.handler.js (CRUD operations)
│   └── audio.handler.js (chunk processing)
├── services/
│   ├── gemini.service.js
│   └── storage.service.js
└── utils/
    └── chunking.js (audio buffer management)
```

**Connection Workflow:**
1. Client connects with auth token in handshake
2. Server validates token → associate socket with userId
3. On 'session:start':
   - Create DB record (status='recording')
   - Initialize empty transcript buffer
   - Start chunk queue for Gemini

4. On 'audio:chunk':
   - Append to in-memory buffer (max 50MB)
   - Send to Gemini service (async queue)
   - Emit 'transcript:partial' on response

5. On 'session:stop':
   - Flush remaining chunks
   - Trigger summary generation (separate worker)
   - Update DB status → 'processing'

### 5.2 Gemini Service Module

**Rate Limiting Strategy:**
- Implement token bucket algorithm:
  - 60 tokens/minute (1 per request)
  - Queue overflow chunks for next window
  - Display "Transcription delayed" if queue >20

**Context Management:**
- Maintain sliding window (last 60s of transcript)
- Include in each Gemini prompt for continuity
- Clear context on pause >5min (separate sessions)

**Error Handling:**
```
Try Gemini API call:
- 429 (rate limit) → queue chunk, retry after 1min
- 500 (server error) → retry 3x with backoff
- 400 (bad audio) → log, skip chunk, notify user
- Success → merge with existing transcript
```

### 5.3 Summary Generation

**Post-Processing Pipeline:**
1. **Aggregate transcript**:
   - Fetch all chunks from DB for session
   - Merge speaker segments
   - Remove duplicate sentences (fuzzy matching)

2. **Generate summary** (separate Gemini call):
   ```
   Prompt:
   "Analyze this meeting transcript. Provide:
   1. Key discussion topics (3-5 bullet points)
   2. Action items with assignees if mentioned
   3. Decisions made
   4. Next steps
   Format as JSON: {topics: [], actions: [], decisions: []}"
   ```

3. **Store results**:
   - Update Transcripts table with summary JSONB
   - Set session status='completed'
   - Emit 'session:completed' to client

**Timeout Safety:**
- If summary takes >60s, store partial transcript as-is
- Display: "Summary generation timed out - view raw transcript"
- Allow manual re-trigger from UI

---

## Phase 6: Advanced Features (Days 16-18)

### 6.1 Long-Session Optimizations

**Problem: 1-hour session = ~120 chunks, ~50MB audio**

**Solutions:**
1. **Client-side buffering**:
   - Store chunks in IndexedDB (browser storage)
   - Send only metadata to server initially
   - Upload full audio to S3/CloudFlare R2 on stop
   - Server fetches from S3 for processing

2. **Server-side streaming**:
   - Use Node.js Streams API for chunked processing
   - Avoid loading entire session in memory
   - Process chunks as they arrive (backpressure handling)

3. **Database optimization**:
   - Store transcript in chunks (JSONB array in Postgres)
   - Index by session_id + timestamp for fast queries
   - Archive old sessions (>90 days) to cold storage

**Monitoring:**
- Track memory usage per session (warn at 80% threshold)
- Auto-pause if server memory >1GB
- Display "Server capacity reached" with ETA

### 6.2 Network Resilience

**Edge Case: Device Turned Off During Recording**

**Strategy:**
1. **Periodic local saves**:
   - Every 2min, save current transcript to localStorage
   - On restart, detect incomplete session via flag
   - Prompt: "Resume previous session?" with preview

2. **Server-side session timeout**:
   - If no chunks received for 10min, mark 'interrupted'
   - Store partial transcript as recoverable
   - Email user: "Session paused - resume here [link]"

3. **Background sync** (Service Worker):
   - Queue chunks locally if offline
   - Sync when connection restored
   - Display offline indicator in UI

### 6.3 Tab-Share Edge Cases

**Challenge: User switches tabs or closes GMeet during recording**

**Detection:**
1. Monitor `track.enabled` property on MediaStream
2. Listen for `ended` event on audio track
3. Fallback flow:
   ```
   Tab audio stops → Emit 'stream:lost'
   → Server marks timestamp
   → Auto-request mic permission
   → Resume with mic input
   → Merge transcripts with gap marker: "[Switched to mic at 12:34]"
   ```

**User Notifications:**
- Toast: "Meeting tab closed - now recording from microphone"
- Option to manually restart tab-share
- Save both audio sources separately for forensics

---

## Phase 7: Polish & Testing (Days 19-21)

### 7.1 Error Boundaries

**Frontend:**
- Wrap recording component in ErrorBoundary
- Display friendly fallback: "Recording failed - view recovered transcript"
- Auto-report errors to logging service (e.g., Sentry)

**Backend:**
- Global error handler in Express
- Log all failures with session context
- Return standardized JSON errors:
  ```json
  {
    "error": "transcription_failed",
    "message": "Gemini API unavailable",
    "retryAfter": 60
  }
  ```

### 7.2 Performance Testing

**Load Scenarios:**
1. **Concurrent sessions**: 10 users recording simultaneously
   - Test: Monitor CPU/memory, ensure <80% usage
   - Expected: Each session ~5MB memory footprint

2. **1-hour session**: Single user, continuous recording
   - Test: Check latency of live transcription (should be <5s)
   - Verify: No memory leaks (Node.js heap stays <500MB)

3. **Network interruption**: Disconnect mid-session
   - Test: Drop connection for 30s, verify auto-reconnect
   - Expected: All buffered chunks delivered, <5s resume

**Tools:**
- Artillery.io for Socket.io load testing
- Chrome DevTools Performance profiler for frontend
- Postgres query analyzer for slow queries

### 7.3 Documentation

**README Structure:**
```markdown
# ScribeAI

## Quick Start
- Prerequisites (Node 18+, Postgres 15+)
- Installation steps (npm install, .env setup)
- Running dev server (npm run dev)

## Architecture
- Mermaid diagram: Audio capture → Socket.io → Gemini → DB
- State machine diagram for session lifecycle

## API Reference
- Socket.io events table
- Prisma schema documentation

## Scalability Analysis (200 words)
[Explain chunking strategy, memory management, horizontal scaling]

## Troubleshooting
- Common permission errors
- Gemini API rate limit handling
```

**Inline Documentation:**
- JSDoc for all functions (params, returns, examples)
- TypeDoc generate HTML docs from comments
- Comment complex logic (e.g., chunk deduplication algorithm)

---

## Phase 8: Deployment Preparation (Day 22)

### 8.1 Environment Configuration

**Secrets Management:**
- Use .env.local for development
- Production: Store in Vercel/Railway environment variables
  - `DATABASE_URL`
  - `GEMINI_API_KEY`
  - `NEXTAUTH_SECRET`
  - `SOCKET_SERVER_URL`

**CORS Setup:**
- Allow Next.js domain for Socket.io connections
- Restrict Gemini API key usage to server IP

### 8.2 Database Migrations

**Production Checklist:**
1. Run `prisma migrate deploy` (not dev)
2. Backup existing data before migration
3. Test migrations on staging environment first
4. Create indexes:
   ```sql
   CREATE INDEX idx_sessions_user_status ON sessions(user_id, status);
   CREATE INDEX idx_transcripts_session ON transcripts(session_id);
   ```

### 8.3 Monitoring Setup

**Key Metrics:**
- WebSocket connections (active count)
- Gemini API latency (p95, p99)
- Session completion rate
- Database query times

**Alerting:**
- Slack/email alerts for:
  - >50% API errors
  - >10min average transcription lag
  - Database connection pool exhaustion

---

## Critical Decision Points Summary

### 1. Audio Capture Method
**Decision: MediaRecorder API**
- Pros: Native browser support, simple API, works with tab audio
- Cons: Limited codec control
- Alternative: WebRTC for advanced scenarios (not needed here)

### 2. Real-Time Communication
**Decision: Socket.io over WebSockets**
- Pros: Auto-reconnection, room support, fallback transports
- Cons: Slightly higher overhead than raw WebSockets
- Alternative: Server-Sent Events (unidirectional, not suitable)

### 3. Transcription Strategy
**Decision: Streaming chunks to Gemini**
- Pros: Live feedback, lower memory usage
- Cons: More API calls, requires context management
- Alternative: Batch entire session (2x slower, higher memory)

### 4. Storage Architecture
**Decision: Postgres + optional S3 for audio files**
- Pros: Transactional safety, rich querying
- Cons: Not ideal for large binaries (hence S3 offload)
- Alternative: MongoDB (less type safety, no ACID guarantees)

### 5. State Management
**Decision: Server-authoritative with Socket.io broadcasts**
- Pros: Single source of truth, consistent across clients
- Cons: Requires server round-trip for UI updates
- Alternative: Client-side state with optimistic updates (riskier)

---

## Scalability Analysis (200 words for README)

**ScribeAI's architecture scales horizontally for concurrent sessions through stateless processing:**

**Audio Pipeline**: Each recording session operates independently. The MediaRecorder chunks (30s intervals) are transmitted via Socket.io to the Node.js server, which queues them for Gemini API processing. Since Gemini calls are asynchronous, the server handles 10+ simultaneous sessions on a 2-core instance without blocking. For enterprise loads (50+ concurrent users), deploy multiple Node.js workers behind a load balancer (Socket.io sticky sessions required).

**Memory Management**: Client-side IndexedDB buffering prevents browser crashes during 1hr+ sessions. The server processes chunks in a stream pipeline—audio data is never fully loaded into RAM. Postgres stores transcripts as JSONB chunks (indexed by timestamp), enabling pagination for long meetings without fetching the entire transcript.

**Database Optimization**: Connection pooling (Prisma default: 10 connections) handles concurrent writes. For >100 daily users, add read replicas for session history queries. Archive completed sessions older than 90 days to cold storage (e.g., AWS Glacier).

**Bottleneck: Gemini API** rate limits (60 req/min). Mitigation: Implement a Redis-backed queue to batch chunks during peak hours, displaying "Transcription queued" with ETA. For premium users, rotate API keys or upgrade to enterprise tier (higher limits).

**Cost Projection**: ~$0.02/hour/user (Gemini pricing + server compute).

---

## Testing Strategy

### Unit Tests (Jest)
- Gemini service: Mock API responses, test error handling
- Chunk processing: Validate base64 encoding, deduplication
- State machine: Verify all transitions, illegal state prevention

### Integration Tests (Playwright)
- Full recording flow: Start → pause → resume → stop → view transcript
- Tab-share permission handling
- Socket.io reconnection during active session

### E2E Tests
- Real Gemini API calls with test audio files
- 1-hour session simulation (accelerated)
- Multi-user concurrency (10 simultaneous sessions)

**Test Coverage Target: >80%**

---

## Future Enhancements (Post-MVP)

1. **Multilingual Support**: Detect language, prompt Gemini accordingly
2. **Custom Vocabulary**: Upload glossary for industry terms (medical, legal)
3. **Live Collaboration**: Multiple users view same transcript in real-time
4. **Integration APIs**: Export to Notion, Slack, Google Docs
5. **Advanced Diarization**: Train custom model for specific voices
6. **Mobile App**: React Native version with background recording

---

## Conclusion

This implementation guide provides a battle-tested architecture for building ScribeAI. The phased approach ensures each component is thoroughly tested before integration. Key to success:

- **Resilience first**: Handle network failures, browser quirks gracefully
- **User feedback**: Real-time status updates reduce anxiety during long recordings
- **Scalability mindset**: Design for 10 users, architect for 1000
- **Documentation**: Future maintainers will thank you

**Estimated Total Development Time: 22 days (1 developer, full-time)**

**Risk Factors**:
- Gemini API stability (mitigate: fallback to Whisper API)
- Browser permission inconsistencies (test on Chrome, Firefox, Safari)
- Edge case discovery during 1hr+ session testing

Follow this guide systematically, validate each phase with stakeholder demos, and maintain a robust test suite. Good luck building ScribeAI! 🎙️