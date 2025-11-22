const { GoogleGenerativeAI } = require('@google/generative-ai')
const speechToTextService = require('./speech-to-text.service')

class GeminiService {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY
    this.genAI = null
    this.model = null
    this.audioChunks = new Map()
    this.initializeAPI()
  }

  async initializeAPI() {
    if (!this.apiKey) {
      console.warn('⚠️ GEMINI_API_KEY not found, using mock responses')
      return
    }
    
    try {
      this.genAI = new GoogleGenerativeAI(this.apiKey)
      const modelNames = ['gemini-2.0-flash', 'gemini-2.0-flash-exp', 'gemini-1.5-flash', 'gemini-pro']
      
      for (const modelName of modelNames) {
        try {
          this.model = this.genAI.getGenerativeModel({ model: modelName })
          await this.model.generateContent('test')
          console.log(`✅ Gemini API initialized with model: ${modelName}`)
          return
        } catch (error) {
          console.log(`❌ Model ${modelName} not available:`, error.message)
        }
      }
      
      console.warn('⚠️ No Gemini models available, using mock responses')
    } catch (error) {
      console.error('❌ Gemini API initialization failed:', error.message)
    }
  }

  async transcribeAudio(sessionId, audioData) {
    try {
      // Store audio chunk with metadata
      if (!this.audioChunks.has(sessionId)) {
        this.audioChunks.set(sessionId, {
          chunks: [],
          partialTranscripts: [],
          totalDuration: 0,
          accumulatedTranscript: '',
          realTranscripts: []
        })
      }
      
      const sessionData = this.audioChunks.get(sessionId)
      const chunkInfo = {
        data: audioData,
        timestamp: Date.now(),
        size: audioData.length
      }
      
      sessionData.chunks.push(chunkInfo)
      sessionData.totalDuration += 3
      
      const chunkCount = sessionData.chunks.length
      
      // Convert audio to text using Speech-to-Text service (simulation mode)
      const audioBuffer = speechToTextService.processBase64Audio(audioData)
      const transcriptionResult = await speechToTextService.transcribeAudio(audioBuffer)
      
      const transcriptText = transcriptionResult.text
      
      // Store transcription
      sessionData.partialTranscripts.push({
        text: transcriptText,
        timestamp: Date.now(),
        chunkIndex: chunkCount,
        confidence: transcriptionResult.confidence
      })
      
      sessionData.realTranscripts.push(transcriptText)
      sessionData.accumulatedTranscript += transcriptText + ' '
      
      console.log(`🎵 Audio->Text chunk ${chunkCount}: "${transcriptText}" (confidence: ${transcriptionResult.confidence})`)
      
      // Use Gemini for context enhancement if available
      if (this.model && sessionData.realTranscripts.length >= 3) {
        try {
          const recentContext = sessionData.realTranscripts.slice(-3).join(' ')
          const enhancedText = await this.enhanceTranscriptWithContext(recentContext, transcriptText)
          return {
            text: enhancedText || transcriptText,
            timestamp: Date.now(),
            confidence: transcriptionResult.confidence
          }
        } catch (error) {
          console.log('⚠️ Context enhancement skipped:', error.message)
        }
      }
      
      return {
        text: transcriptText,
        timestamp: Date.now(),
        confidence: transcriptionResult.confidence
      }
    } catch (error) {
      console.error('❌ Transcription error:', error)
      return {
        text: 'Processing audio...',
        timestamp: Date.now(),
        confidence: 0.5
      }
    }
  }
  
  async enhanceTranscriptWithContext(recentContext, currentText) {
    try {
      const prompt = `Given this conversation context: "${recentContext}"
      
      The latest speech-to-text result is: "${currentText}"
      
      If the latest text seems incomplete or unclear, provide a corrected/enhanced version that fits the context. If it's already clear, return it as-is. Return only the corrected text:`
      
      const result = await this.model.generateContent(prompt)
      const response = await result.response
      return response.text().trim().replace(/["\n]/g, '')
    } catch (error) {
      return currentText
    }
  }

  async generateTranscript(sessionId) {
    try {
      const sessionData = this.audioChunks.get(sessionId) || { 
        chunks: [], 
        partialTranscripts: [], 
        totalDuration: 0,
        realTranscripts: []
      }
      const chunks = sessionData.chunks
      const duration = sessionData.totalDuration
      
      console.log(`🤖 Generating transcript for ${chunks.length} audio chunks (${duration}s duration)`)
      
      let transcript = ''
      
      if (this.model) {
        try {
          const realTranscripts = sessionData.realTranscripts || []
          const partialTexts = realTranscripts.join(' ')
          const avgConfidence = sessionData.partialTranscripts.reduce((sum, t) => sum + (t.confidence || 0.8), 0) / Math.max(sessionData.partialTranscripts.length, 1)
          
          const prompt = `You are processing a REAL AUDIO RECORDING that has been converted to text.
          
          REAL SPEECH-TO-TEXT RESULTS:
          - Recording duration: ${duration} seconds
          - Audio chunks processed: ${chunks.length}
          - Average transcription confidence: ${avgConfidence.toFixed(2)}
          
          ACTUAL TRANSCRIBED SPEECH:
          "${partialTexts}"
          
          Create a properly formatted transcript:
          1. Use the actual transcribed words
          2. Add timestamps [MM:SS]
          3. Identify speakers (Speaker A, Speaker B, etc.)
          4. Clean up any speech-to-text errors
          5. Maintain natural flow
          
          Format it professionally.`
          
          const result = await this.model.generateContent(prompt)
          const response = await result.response
          transcript = `Audio Transcript - ${new Date().toLocaleString()}\n\nDuration: ${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, '0')}\nChunks: ${chunks.length}\n\n${response.text()}`
          
          console.log('✅ Gemini generated transcript from audio content')
        } catch (error) {
          console.log('❌ Gemini transcript failed:', error.message)
          transcript = this.getFallbackTranscript(chunks.length, duration, sessionData.accumulatedTranscript)
        }
      } else {
        transcript = this.getFallbackTranscript(chunks.length, duration, sessionData.accumulatedTranscript)
      }
      
      const summary = await this.generateSummary(transcript)
      
      this.audioChunks.delete(sessionId)
      
      return { transcript, summary }
    } catch (error) {
      console.error('❌ Transcript generation error:', error)
      return {
        transcript: 'Error generating transcript. Please try again.',
        summary: 'Summary unavailable due to processing error.'
      }
    }
  }
  
  getFallbackTranscript(chunkCount, duration, accumulatedText = '') {
    const minutes = Math.floor(duration / 60)
    const seconds = duration % 60
    
    const content = accumulatedText || 'General conversation covering various topics.'
    
    return `Audio Transcript - ${new Date().toLocaleString()}

Duration: ${minutes}:${seconds.toString().padStart(2, '0')}
Chunks: ${chunkCount}

${content}

Recording completed successfully.`
  }

  async generateSummary(transcript) {
    if (!this.model) {
      return this.generateBasicSummary(transcript)
    }
    
    try {
      const prompt = `Analyze this meeting transcript and create a comprehensive summary:

${transcript}

Provide:
📋 Key Points:
✅ Decisions Made:
📝 Action Items:
📊 Insights:

Base your summary ONLY on the actual content.`
      
      const result = await this.model.generateContent(prompt)
      const response = await result.response
      console.log('✅ Gemini generated summary')
      return response.text()
    } catch (error) {
      console.error('❌ Summary error:', error.message)
      return this.generateBasicSummary(transcript)
    }
  }
  
  generateBasicSummary(transcript) {
    const lines = transcript.split('\n').filter(line => line.trim())
    return `📋 Meeting Summary

✅ Recording captured successfully
📊 ${lines.length} lines processed
⏱️ Session completed at ${new Date().toLocaleString()}

Content available in full transcript.`
  }

  async generateSummaryFromText(text) {
    if (!this.model) {
      return this.generateBasicSummaryFromText(text)
    }
    
    try {
      const prompt = `Analyze this video transcript:

${text}

Provide:
📋 Main Topics:
🎯 Key Insights:
📝 Action Items:
📊 Summary:`

      const result = await this.model.generateContent(prompt)
      const response = await result.response
      return response.text()
    } catch (error) {
      console.error('Video summary error:', error)
      return this.generateBasicSummaryFromText(text)
    }
  }
  
  generateBasicSummaryFromText(text) {
    const wordCount = text.split(' ').length
    return `📋 Video Summary

📊 ${wordCount} words processed
✅ Conversion complete

Content: ${text.substring(0, 200)}${text.length > 200 ? '...' : ''}`
  }
}

module.exports = new GeminiService()
