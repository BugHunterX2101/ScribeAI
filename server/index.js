// Set environment variables directly
process.env.DATABASE_URL = 'postgresql://postgres:1234@localhost:5432/ScribeAI'
process.env.GEMINI_API_KEY = 'AIzaSyDwlyc9_9A0ETLWnMu4aZwtjn_F2CB6G6k'

require('dotenv').config({ path: '../.env.local' })
const express = require('express')
const http = require('http')
const socketIo = require('socket.io')
const cors = require('cors')
const { PrismaClient } = require('@prisma/client')
const geminiService = require('./services/gemini.service')
const videoToTextService = require('./services/video-to-text.service')

const app = express()
const server = http.createServer(app)
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
  }
})

const prisma = new PrismaClient()

app.use(cors({
  origin: "*",
  credentials: true
}))
app.use(express.json())

// Store active sessions
const activeSessions = new Map()

io.on('connection', (socket) => {


  socket.on('session:start', async (data) => {
    try {
      const { userId, mode } = data
      
      // Ensure test user exists
      let user = await prisma.user.findUnique({ where: { email: 'test@scribeai.com' } })
      if (!user) {
        user = await prisma.user.create({
          data: {
            email: 'test@scribeai.com',
            password: 'test_password'
          }
        })
      }
      
      // Create session in database
      const session = await prisma.session.create({
        data: {
          userId: user.id,
          title: `Recording ${new Date().toLocaleString()}`,
          status: 'recording'
        }
      })

      // Store session info
      activeSessions.set(socket.id, {
        sessionId: session.id,
        userId: user.id,
        mode,
        chunks: [],
        transcript: '',
        startTime: Date.now()
      })

      socket.emit('session:started', { sessionId: session.id })

    } catch (error) {
      console.error('Session start error:', error)
      socket.emit('error', { message: 'Failed to start session: ' + error.message })
    }
  })

  socket.on('audio:chunk', async (data) => {
    try {
      const sessionInfo = activeSessions.get(socket.id)
      if (!sessionInfo) return

      const { sessionId, data: audioData, timestamp } = data
      
      // Store chunk
      sessionInfo.chunks.push({ data: audioData, timestamp })
      
      // Process with Gemini
      const result = await geminiService.transcribeAudio(sessionId, audioData)
      sessionInfo.transcript += result.text + ' '
      
      console.log('📝 Sending partial transcript:', result.text)
      
      // Send partial transcript
      socket.emit('transcript:partial', { 
        text: result.text,
        timestamp,
        chunkNumber: sessionInfo.chunks.length
      })

    } catch (error) {
      console.error('Audio chunk processing error:', error)
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
  
    }
  })

  socket.on('video:upload', async (data) => {
    try {
      const sessionInfo = activeSessions.get(socket.id)
      if (!sessionInfo) {
        socket.emit('video:error', { error: 'Session not found' })
        return
      }

      const { sessionId, data: videoData, filename } = data
      
      socket.emit('video:processing', { message: 'Extracting audio from video...' })
      
      // Convert base64 to buffer
      const videoBuffer = Buffer.from(videoData, 'base64')
      
      // Process video to text
      const transcript = await videoToTextService.processVideoToText(videoBuffer, sessionId)
      
      socket.emit('video:processing', { message: 'Generating summary...' })
      
      // Generate summary with Gemini
      const summary = await geminiService.generateSummaryFromText(transcript)
      
      // Create transcript record
      await prisma.transcript.create({
        data: {
          sessionId,
          content: transcript,
          summary: summary,
          timestampChunks: []
        }
      })

      // Update session
      await prisma.session.update({
        where: { id: sessionId },
        data: { 
          title: `Video: ${filename}`,
          status: 'completed',
          duration: 0
        }
      })

      socket.emit('session:completed', {
        transcript: transcript,
        summary: summary
      })

      // Cleanup
      videoToTextService.cleanup(sessionId)
      activeSessions.delete(socket.id)

    } catch (error) {
      console.error('Video processing error:', error)
      socket.emit('video:error', { error: error.message })
      videoToTextService.cleanup(data.sessionId)
    }
  })

  socket.on('session:stop', async (data) => {
    try {
      const sessionInfo = activeSessions.get(socket.id)
      if (!sessionInfo) return

      const { sessionId } = data
      
      // Update session status
      await prisma.session.update({
        where: { id: sessionId },
        data: { status: 'processing' }
      })

      socket.emit('status:update', { status: 'processing' })

      // Generate complete transcript using Gemini
      const transcriptResult = await geminiService.generateTranscript(sessionId)
      
      // Create transcript record
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

      // Calculate session duration
      const duration = Math.floor((Date.now() - sessionInfo.startTime) / 1000)
      
      // Update session to completed with duration
      await prisma.session.update({
        where: { id: sessionId },
        data: { 
          status: 'completed',
          duration: duration
        }
      })

      socket.emit('session:completed', {
        transcript: transcriptResult.transcript,
        summary: transcriptResult.summary,
        downloadUrl: `/api/sessions/${sessionId}/download`
      })

      // Clean up
      activeSessions.delete(socket.id)
      
    } catch (error) {
      console.error('Session stop error:', error)
      socket.emit('error', { message: 'Failed to process recording' })
    }
  })

  socket.on('disconnect', () => {
  
    activeSessions.delete(socket.id)
  })
})

const PORT = process.env.PORT || 3001
server.listen(PORT, () => {
  console.log(`🚀 ScribeAI server running on port ${PORT}`)
  console.log('📊 Database:', process.env.DATABASE_URL ? 'Connected' : 'Not configured')
  console.log('🤖 Gemini API:', process.env.GEMINI_API_KEY ? 'Configured' : 'Not configured')
})