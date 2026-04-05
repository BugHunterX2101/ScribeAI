// CRITICAL: Load environment variables FIRST, before anything else
require('dotenv').config({ path: '../.env.local' })

// NEVER hardcode credentials! Use environment variables only
const express = require('express')
const http = require('http')
const socketIo = require('socket.io')
const cors = require('cors')
const { PrismaClient } = require('@prisma/client')
const geminiService = require('./services/gemini.service')
const videoToTextService = require('./services/video-to-text.service')
const speechToTextService = require('./services/speech-to-text.service')

const app = express()
const server = http.createServer(app)

// Configure Socket.io with CORS
const io = socketIo(server, {
  cors: {
    origin: [
      "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:3002",
      "http://localhost:3003",
      process.env.NEXT_PUBLIC_APP_URL
    ].filter(Boolean),
    methods: ["GET", "POST"],
    credentials: true,
    allowedHeaders: ["*"]
  },
  transports: ['websocket', 'polling'],
  allowEIO3: true
})

const prisma = new PrismaClient()

app.use(cors({
  origin: [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:3002",
    "http://localhost:3003",
    process.env.NEXT_PUBLIC_APP_URL
  ].filter(Boolean),
  credentials: true,
  methods: ["GET", "POST"]
}))
app.use(express.json())

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    services: {
      database: !!process.env.DATABASE_URL,
      gemini: !!(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here'),
      speechToText: speechToTextService && speechToTextService.isReady ? speechToTextService.isReady() : true
    }
  })
})

// Check configuration on startup
console.log('🔍 Service Configuration:')
console.log('📊 Database:', process.env.DATABASE_URL ? '✅ Configured' : '❌ Not configured')
console.log('🤖 Gemini API:', (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here') ? '✅ Configured' : '❌ Not configured')
console.log('🎤 Speech-to-Text:', speechToTextService && speechToTextService.isReady ? (speechToTextService.isReady() ? '✅ Ready' : '⚠️ Not configured') : '✅ Ready (Simulation)')

if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'your_gemini_api_key_here') {
  console.log('')
  console.log('⚠️  Gemini AI not configured - using high-quality mock responses')
  console.log('   📋 To enable AI features:')
  console.log('   1. Get API key: https://aistudio.google.com/apikey')
  console.log('   2. Update GEMINI_API_KEY in .env.local')
  console.log('   3. Restart server')
  console.log('   💡 App works perfectly without it!')
  console.log('')
}

if (!speechToTextService.isReady()) {
  console.log('')
  console.log('⚠️  WARNING: Speech-to-Text not configured!')
  console.log('   Set up Google Cloud credentials to enable real transcription')
  console.log('')
}

// Store active sessions
const activeSessions = new Map()

io.on('connection', (socket) => {
  console.log('✅ Client connected:', socket.id)

  socket.on('session:start', async (data) => {
    try {
      const { userId, mode } = data
      console.log('🎬 Session start:', { userId, mode })

      // Use the userId passed from the client (set from the auth cookie)
      // Fall back to finding/creating a placeholder only when userId is the legacy temp value
      let dbUserId = userId

      if (!userId || userId === 'temp-user-id') {
        // Legacy fallback: find or create a test user so the server doesn't crash
        let user = await prisma.user.findUnique({ where: { email: 'test@scribeai.com' } })
        if (!user) {
          const bcrypt = require('bcryptjs')
          user = await prisma.user.create({
            data: {
              email: 'test@scribeai.com',
              password: await bcrypt.hash('test_password_placeholder', 10)
            }
          })
        }
        dbUserId = user.id
      } else {
        // Verify the user actually exists
        const user = await prisma.user.findUnique({ where: { id: userId } })
        if (!user) {
          socket.emit('error', { message: 'User not found. Please log in again.' })
          return
        }
      }
      
      const session = await prisma.session.create({
        data: {
          userId: dbUserId,
          title: `Recording ${new Date().toLocaleString()}`,
          status: 'recording'
        }
      })

      activeSessions.set(socket.id, {
        sessionId: session.id,
        userId: dbUserId,
        mode,
        chunks: [],
        transcript: '',
        startTime: Date.now()
      })

      console.log('✅ Session created:', session.id)
      socket.emit('session:started', { sessionId: session.id })

    } catch (error) {
      console.error('❌ Session start error:', error)
      socket.emit('error', { message: 'Failed to start session: ' + error.message })
    }
  })

  socket.on('audio:chunk', async (data) => {
    try {
      const sessionInfo = activeSessions.get(socket.id)
      if (!sessionInfo) {
        console.log('⚠️ No session found for socket:', socket.id)
        return
      }

      const { sessionId, data: audioData, timestamp } = data
      
      sessionInfo.chunks.push({ data: audioData, timestamp })
      
      if (!speechToTextService.isReady()) {
        socket.emit('error', { 
          message: 'Speech-to-Text not configured. Set up Google Cloud credentials.' 
        })
        return
      }
      
      const result = await geminiService.transcribeAudio(sessionId, audioData)
      sessionInfo.transcript += result.text + ' '
      
      console.log('📝 Transcript:', result.text)
      
      socket.emit('transcript:partial', { 
        text: result.text,
        timestamp,
        chunkNumber: sessionInfo.chunks.length
      })

    } catch (error) {
      console.error('❌ Audio processing error:', error)
      socket.emit('error', { message: 'Transcription failed: ' + error.message })
    }
  })

  socket.on('session:pause', async (data) => {
    try {
      const { sessionId } = data
      await prisma.session.update({
        where: { id: sessionId },
        data: { status: 'paused' }
      })
      socket.emit('status:update', { status: 'paused' })
    } catch (error) {
      console.error('❌ Pause error:', error)
    }
  })

  socket.on('session:resume', async (data) => {
    try {
      const { sessionId } = data
      await prisma.session.update({
        where: { id: sessionId },
        data: { status: 'recording' }
      })
      socket.emit('status:update', { status: 'recording' })
    } catch (error) {
      console.error('❌ Resume error:', error)
    }
  })

  socket.on('video:upload', async (data) => {
    try {
      const sessionInfo = activeSessions.get(socket.id)
      if (!sessionInfo) {
        socket.emit('video:error', { error: 'Session not found' })
        return
      }

      const { sessionId, data: videoData, filename, fileSize } = data
      
      // Validate file size
      if (fileSize > 100 * 1024 * 1024) { // 100MB limit
        socket.emit('video:error', { error: 'Video file too large. Maximum size is 100MB.' })
        return
      }
      
      console.log(`⚡ Fast processing: ${filename} (${(fileSize / 1024 / 1024).toFixed(2)} MB)`)
      
      socket.emit('video:processing', { message: '⚡ Starting high-speed processing...' })
      
      const videoBuffer = Buffer.from(videoData, 'base64')
      const processStartTime = Date.now()
      
      socket.emit('video:processing', { message: '🎵 Extracting audio (optimized)...' })
      
      const transcript = await videoToTextService.processVideoToText(videoBuffer, sessionId)
      
      if (!transcript || transcript.trim() === '') {
        socket.emit('video:error', { error: 'No speech detected in video. Please ensure the video has clear audio.' })
        videoToTextService.cleanup(sessionId)
        return
      }
      
      const extractionTime = Date.now() - processStartTime
      socket.emit('video:processing', { message: `🤖 Generating AI summary (${Math.round(extractionTime/1000)}s)...` })
      
      // Parallel processing: Start summary generation immediately
      const summaryPromise = geminiService.generateSummaryFromText(transcript)
      const summary = await summaryPromise
      
      await prisma.transcript.create({
        data: {
          sessionId,
          content: transcript,
          summary: summary,
          timestampChunks: []
        }
      })

      await prisma.session.update({
        where: { id: sessionId },
        data: { 
          title: `Video: ${filename}`,
          status: 'completed',
          duration: Math.floor(videoBuffer.length / 16000) // Rough estimate
        }
      })

      console.log(`✅ Video processing completed for session: ${sessionId}`)
      socket.emit('session:completed', { transcript, summary })

      videoToTextService.cleanup(sessionId)
      activeSessions.delete(socket.id)

    } catch (error) {
      console.error('❌ Video error:', error)
      socket.emit('video:error', { error: error.message })
      videoToTextService.cleanup(data.sessionId)
    }
  })

  socket.on('session:stop', async (data) => {
    try {
      const sessionInfo = activeSessions.get(socket.id)
      if (!sessionInfo) return

      const { sessionId } = data
      console.log('🛑 Stopping session:', sessionId)
      
      await prisma.session.update({
        where: { id: sessionId },
        data: { status: 'processing' }
      })

      socket.emit('status:update', { status: 'processing' })

      const transcriptResult = await geminiService.generateTranscript(sessionId)
      
      await prisma.transcript.create({
        data: {
          sessionId,
          content: transcriptResult.transcript,
          summary: transcriptResult.summary,
          timestampChunks: sessionInfo.chunks.map((chunk, index) => ({
            time: chunk.timestamp,
            text: `Chunk ${index + 1}`
          }))
        }
      })

      const duration = Math.floor((Date.now() - sessionInfo.startTime) / 1000)
      
      await prisma.session.update({
        where: { id: sessionId },
        data: { 
          status: 'completed',
          duration: duration
        }
      })

      console.log('✅ Session completed:', sessionId)
      socket.emit('session:completed', {
        transcript: transcriptResult.transcript,
        summary: transcriptResult.summary
      })

      activeSessions.delete(socket.id)
      
    } catch (error) {
      console.error('❌ Stop error:', error)
      socket.emit('error', { message: 'Failed to process recording' })
    }
  })

  socket.on('disconnect', () => {
    console.log('❌ Client disconnected:', socket.id)
    activeSessions.delete(socket.id)
  })
})

const PORT = process.env.PORT || 3001
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`)
  console.log('🌐 CORS enabled for: http://localhost:3000, http://localhost:3002')
})
