export interface User {
  id: string
  email: string
  createdAt: Date
}

export interface Session {
  id: string
  userId: string
  title: string
  status: 'idle' | 'recording' | 'paused' | 'processing' | 'completed' | 'cancelled'
  duration: number
  createdAt: Date
}

export interface Transcript {
  id: string
  sessionId: string
  content: string
  summary?: string
  timestampChunks: TimestampChunk[]
  createdAt: Date
}

export interface TimestampChunk {
  time: number
  text: string
}

export interface AudioChunk {
  sessionId: string
  data: string // base64 encoded audio
  timestamp: number
}

export interface TranscriptPartial {
  text: string
  timestamp: number
}

export interface SessionSummary {
  topics: string[]
  actions: string[]
  decisions: string[]
}