import { z } from 'zod'

/**
 * Core application types with Zod validation schemas
 * 
 * Type-safe interfaces for all data structures used across the application.
 * Each interface has a corresponding Zod schema for runtime validation.
 * 
 * @module Types
 * @author ScribeAI Team
 * @version 2.0.0
 */

// =============================================================================
// User Management Types
// =============================================================================

/**
 * User account information
 */
export interface User {
  id: string
  email: string
  createdAt: Date
}

export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  createdAt: z.date()
})

// =============================================================================
// Session Management Types
// =============================================================================

/**
 * Recording session with status tracking
 */
export interface Session {
  id: string
  userId: string
  title: string
  status: SessionStatus
  duration: number
  createdAt: Date
  updatedAt?: Date
}

export type SessionStatus = 'idle' | 'recording' | 'paused' | 'processing' | 'completed' | 'cancelled'

export const SessionSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  title: z.string().min(1).max(200),
  status: z.enum(['idle', 'recording', 'paused', 'processing', 'completed', 'cancelled']),
  duration: z.number().min(0),
  createdAt: z.date(),
  updatedAt: z.date().optional()
})

// =============================================================================
// Audio Processing Types
// =============================================================================

/**
 * Audio chunk for real-time processing (1.5s intervals)
 */
export interface AudioChunk {
  sessionId: string
  data: string        // Base64 encoded audio
  timestamp: number   // Client timestamp
  size: number        // Chunk size in bytes
  sequence?: number   // Optional sequence number for ordering
}

export const AudioChunkSchema = z.object({
  sessionId: z.string().uuid(),
  data: z.string().min(1, 'Audio data cannot be empty'),
  timestamp: z.number().positive('Timestamp must be positive'),
  size: z.number().positive('Size must be positive'),
  sequence: z.number().optional()
})

/**
 * Video upload payload
 */
export interface VideoUpload {
  sessionId: string
  data: string        // Base64 encoded video
  filename: string
  fileSize: number
  mimeType?: string
}

export const VideoUploadSchema = z.object({
  sessionId: z.string().uuid(),
  data: z.string().min(1, 'Video data cannot be empty'),
  filename: z.string().min(1).max(255),
  fileSize: z.number().positive().max(100 * 1024 * 1024, 'File size must be under 100MB'),
  mimeType: z.string().optional()
})

// =============================================================================
// Transcript & AI Types
// =============================================================================

/**
 * Complete transcript with AI summary
 */
export interface Transcript {
  id: string
  sessionId: string
  content: string
  summary?: string
  timestampChunks: TimestampChunk[]
  confidence?: number
  createdAt: Date
}

export const TranscriptSchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string().uuid(),
  content: z.string().min(1, 'Content cannot be empty'),
  summary: z.string().optional(),
  timestampChunks: z.array(z.object({
    time: z.number().min(0),
    text: z.string(),
    confidence: z.number().min(0).max(1).optional()
  })),
  confidence: z.number().min(0).max(1).optional(),
  createdAt: z.date()
})

/**
 * Real-time transcript chunk
 */
export interface TranscriptPartial {
  text: string
  timestamp: number
  confidence?: number
  isFinal?: boolean
}

export const TranscriptPartialSchema = z.object({
  text: z.string(),
  timestamp: z.number().positive(),
  confidence: z.number().min(0).max(1).optional(),
  isFinal: z.boolean().optional()
})

/**
 * Timestamp-aligned text chunk
 */
export interface TimestampChunk {
  time: number        // Seconds from start
  text: string        // Transcript text
  confidence?: number // Recognition confidence (0-1)
  speaker?: string    // Speaker identification
}

// =============================================================================
// Socket.io Event Types
// =============================================================================

/**
 * Socket event payloads for type-safe communication
 */
export interface SocketEvents {
  // Client → Server
  'session:start': {
    userId: string
    mode: 'mic' | 'tab' | 'video'
  }
  
  'audio:chunk': AudioChunk
  'video:upload': VideoUpload
  'session:pause': { sessionId: string }
  'session:resume': { sessionId: string }
  'session:stop': { sessionId: string }
  
  // Server → Client  
  'session:started': {
    sessionId: string
    status: SessionStatus
  }
  
  'transcript:partial': TranscriptPartial
  'session:completed': {
    sessionId: string
    transcript: string
    summary: string
    duration: number
  }
  
  'status:update': {
    sessionId: string
    status: SessionStatus
    message?: string
  }
  
  'video:processing': {
    message: string
    progress?: number
  }
  
  'video:error': {
    error: string
    sessionId?: string
  }
}

// =============================================================================
// API Response Types
// =============================================================================

/**
 * Standardized API response wrapper
 */
export interface APIResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
  timestamp: Date
}

export const APIResponseSchema = <T>(dataSchema?: z.ZodSchema<T>) => z.object({
  success: z.boolean(),
  data: dataSchema ? dataSchema.optional() : z.any().optional(),
  error: z.string().optional(),
  message: z.string().optional(),
  timestamp: z.date()
})

/**
 * Session statistics for dashboard
 */
export interface SessionStats {
  totalSessions: number
  hoursTranscribed: number
  completedSessions: number
  averageDuration: number
  thisWeek: number
  thisMonth: number
}

export const SessionStatsSchema = z.object({
  totalSessions: z.number().min(0),
  hoursTranscribed: z.number().min(0),
  completedSessions: z.number().min(0),
  averageDuration: z.number().min(0),
  thisWeek: z.number().min(0),
  thisMonth: z.number().min(0)
})

// =============================================================================
// Performance & Configuration Types
// =============================================================================

/**
 * Performance optimization configuration
 */
export interface PerformanceConfig {
  gemini: {
    maxOutputTokens: number
    temperature: number
    topP: number
    topK: number
    maxInputLength: number
    timeoutMs: number
  }
  audio: {
    chunkSize: number
    sampleRate: number
    channels: number
    bitDepth: number
  }
  video: {
    maxFileSize: number
    audioCodec: string
    preset: string
    threads: number
    volumeBoost: number
  }
  general: {
    enableParallelProcessing: boolean
    enableProgressFeedback: boolean
    maxConcurrentSessions: number
  }
}

/**
 * Export validation utilities
 */
export const validateAudioChunk = (data: unknown): AudioChunk => {
  return AudioChunkSchema.parse(data)
}

export const validateVideoUpload = (data: unknown): VideoUpload => {
  return VideoUploadSchema.parse(data)
}

export const validateSession = (data: unknown): Session => {
  return SessionSchema.parse(data)
}