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
      console.warn('⚠️ GEMINI_API_KEY not found')
      console.log('   Get your key from: https://aistudio.google.com/apikey')
      return
    }
    
    try {
      this.genAI = new GoogleGenerativeAI(this.apiKey)
      
      // Try models in order of preference (correct model names for 2024)
      const modelNames = [
        'gemini-1.5-flash',      // Fast, efficient
        'gemini-1.5-pro',        // More capable
        'gemini-1.5-flash-8b'    // Lightweight
      ]
      
      for (const modelName of modelNames) {
        try {
          this.model = this.genAI.getGenerativeModel({ model: modelName })
          // Test with a simple prompt
          const result = await this.model.generateContent('Say "OK"')
          await result.response
          console.log(`✅ Gemini API initialized with model: ${modelName}`)
          return
        } catch (error) {
          console.log(`⚠️ Model ${modelName} failed:`, error.message.split('\n')[0])
        }
      }
      
      console.error('❌ No Gemini models available')
      console.log('   Check your API key and quota at: https://aistudio.google.com/')
      this.model = null
    } catch (error) {
      console.error('❌ Gemini initialization failed:', error.message)
      this.model = null
    }
  }

  async transcribeAudio(sessionId, audioData) {
    try {
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
      sessionData.chunks.push({
        data: audioData,
        timestamp: Date.now(),
        size: audioData.length
      })
      sessionData.totalDuration += 3
      
      const chunkCount = sessionData.chunks.length
      
      // Use Google Cloud Speech-to-Text for real transcription
      const audioBuffer = speechToTextService.processBase64Audio(audioData)
      const transcriptionResult = await speechToTextService.transcribeAudio(audioBuffer)
      
      const transcriptText = transcriptionResult.text
      
      sessionData.partialTranscripts.push({
        text: transcriptText,
        timestamp: Date.now(),
        chunkIndex: chunkCount,
        confidence: transcriptionResult.confidence
      })
      
      sessionData.realTranscripts.push(transcriptText)
      sessionData.accumulatedTranscript += transcriptText + ' '
      
      console.log(`🎵 Chunk ${chunkCount}: "${transcriptText}" (${transcriptionResult.confidence})`)
      
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
          console.log('⚠️ Enhancement skipped:', error.message.split('\n')[0])
        }
      }
      
      return {
        text: transcriptText,
        timestamp: Date.now(),
        confidence: transcriptionResult.confidence
      }
    } catch (error) {
      console.error('❌ Transcription error:', error)
      throw error
    }
  }
  
  async enhanceTranscriptWithContext(recentContext, currentText) {
    if (!this.model) return currentText
    
    try {
      const prompt = `Context: "${recentContext}"\nCurrent: "${currentText}"\n\nIf unclear, provide corrected version. If clear, return as-is:`
      
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
      
      console.log(`🤖 Generating transcript: ${chunks.length} chunks, ${duration}s`)
      
      let transcript = ''
      
      if (this.model) {
        try {
          const realTranscripts = sessionData.realTranscripts || []
          const partialTexts = realTranscripts.join(' ')
          const avgConfidence = sessionData.partialTranscripts.reduce((sum, t) => sum + (t.confidence || 0.8), 0) / Math.max(sessionData.partialTranscripts.length, 1)
          
          const prompt = `Format this real audio transcript professionally:

Duration: ${duration}s
Chunks: ${chunks.length}
Confidence: ${avgConfidence.toFixed(2)}

Transcribed Speech:
"${partialTexts}"

Create formatted transcript with:
- Timestamps [MM:SS]
- Speaker labels
- Proper punctuation

Keep actual words, just format nicely.`
          
          const result = await this.model.generateContent(prompt)
          const response = await result.response
          transcript = `Transcript - ${new Date().toLocaleString()}\n\nDuration: ${Math.floor(duration/60)}:${(duration%60).toString().padStart(2,'0')}\n\n${response.text()}`
          
          console.log('✅ Gemini formatted transcript')
        } catch (error) {
          console.log('❌ Gemini failed:', error.message.split('\n')[0])
          transcript = this.getFallbackTranscript(chunks.length, duration, sessionData.accumulatedTranscript)
        }
      } else {
        transcript = this.getFallbackTranscript(chunks.length, duration, sessionData.accumulatedTranscript)
      }
      
      const summary = await this.generateSummary(transcript)
      this.audioChunks.delete(sessionId)
      
      return { transcript, summary }
    } catch (error) {
      console.error('❌ Transcript error:', error)
      throw error
    }
  }
  
  getFallbackTranscript(chunkCount, duration, accumulatedText = '') {
    const minutes = Math.floor(duration / 60)
    const seconds = duration % 60
    
    return `Transcript - ${new Date().toLocaleString()}

Duration: ${minutes}:${seconds.toString().padStart(2, '0')}
Chunks: ${chunkCount}

${accumulatedText || 'Conversation content'}

Recording completed.`
  }

  async generateSummary(transcript) {
    if (!this.model) {
      return this.generateBasicSummary(transcript)
    }
    
    try {
      const prompt = `Summarize this transcript:

${transcript}

Provide:
📋 Key Points:
✅ Decisions:
📝 Actions:
📊 Insights:`

      const result = await this.model.generateContent(prompt)
      const response = await result.response
      console.log('✅ Gemini generated summary')
      return response.text()
    } catch (error) {
      console.error('❌ Summary error:', error.message.split('\n')[0])
      return this.generateBasicSummary(transcript)
    }
  }
  
  generateBasicSummary(transcript) {
    const lines = transcript.split('\n').filter(line => line.trim())
    return `📋 Summary

✅ Recorded successfully
📊 ${lines.length} lines
⏱️ ${new Date().toLocaleString()}

See full transcript for details.`
  }

  async generateSummaryFromText(text) {
    if (!this.model) {
      return this.generateBasicSummaryFromText(text)
    }
    
    try {
      const prompt = `Summarize:\n\n${text}\n\nProvide key points and insights.`
      const result = await this.model.generateContent(prompt)
      const response = await result.response
      return response.text()
    } catch (error) {
      return this.generateBasicSummaryFromText(text)
    }
  }
  
  generateBasicSummaryFromText(text) {
    return `📋 Summary\n\n${text.substring(0, 200)}${text.length > 200 ? '...' : ''}`
  }
}

module.exports = new GeminiService()
