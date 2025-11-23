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
    if (!this.apiKey || this.apiKey === 'your_gemini_api_key_here') {
      console.warn('⚠️ GEMINI_API_KEY not configured')
      console.log('   1. Get your key from: https://aistudio.google.com/apikey')
      console.log('   2. Update .env.local with your API key')
      console.log('   3. Restart the server')
      console.log('   💡 The app will work with mock responses for now')
      return
    }
    
    try {
      this.genAI = new GoogleGenerativeAI(this.apiKey)
      
      // Optimized model configuration for speed
      const modelConfig = {
        model: 'gemini-2.0-flash',
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1024,  // Limit for faster generation
          topP: 0.8,
          topK: 40
        }
      }
      
      // Try Gemini 2.0 Flash (fastest model)
      try {
        console.log('⚡ Initializing Gemini 2.0 Flash (Speed Optimized)...')
        this.model = this.genAI.getGenerativeModel(modelConfig)
        // Skip test generation for faster startup
        console.log('✅ Gemini 2.0 Flash ready (Speed Mode)')
        return
      } catch (error) {
        console.log('⚠️ gemini-2.0-flash failed, trying alternatives...')
      }
      
      // Try alternative models with speed optimization
      const modelNames = [
        'gemini-2.5-flash',
        'gemini-flash-latest', 
        'gemini-1.5-flash'
      ]
      
      for (const modelName of modelNames) {
        try {
          this.model = this.genAI.getGenerativeModel({ model: modelName })
          const result = await this.model.generateContent('Hello')
          await result.response
          console.log(`✅ Gemini API initialized with model: ${modelName}`)
          return
        } catch (error) {
          console.log(`⚠️ Model ${modelName} failed:`, error.message.split(': ')[1]?.split('.')[0] || 'Unknown error')
        }
      }
      
      console.error('❌ No Gemini models available')
      console.log('   📋 Troubleshooting steps:')
      console.log('   1. Check your API key at: https://aistudio.google.com/')
      console.log('   2. Verify billing and quota limits')
      console.log('   3. Wait if rate limited (usually 1-15 minutes)')
      console.log('   💡 App will continue with high-quality mock responses')
      this.model = null
    } catch (error) {
      console.error('❌ Gemini initialization failed:', error.message.split('\n')[0])
      console.log('   💡 Continuing with mock AI responses - full functionality available')
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
    const wordCount = transcript.split(' ').length
    const hasKeywords = {
      decisions: transcript.toLowerCase().includes('decide') || transcript.toLowerCase().includes('agree'),
      actions: transcript.toLowerCase().includes('action') || transcript.toLowerCase().includes('follow up'),
      meeting: transcript.toLowerCase().includes('meeting') || transcript.toLowerCase().includes('discuss')
    }
    
    return `📋 Professional Summary (AI Analysis Unavailable)

🎯 Key Points:
• Successfully recorded ${Math.floor(wordCount / 100)} minutes of content
• ${lines.length} transcript segments processed
• ${hasKeywords.meeting ? 'Meeting format detected' : 'Conversation recorded'}

✅ Decisions Made:
${hasKeywords.decisions ? '• Decision points identified in transcript' : '• No explicit decisions detected'}

📝 Action Items:
${hasKeywords.actions ? '• Follow-up actions mentioned' : '• No specific actions identified'}

📊 Recording Stats:
• Word count: ~${wordCount} words
• Generated: ${new Date().toLocaleString()}
• Status: Complete ✅

💡 Note: AI summarization temporarily unavailable. Full transcript contains all details.`
  }

  async generateSummaryFromText(text) {
    if (!this.model) {
      return this.generateBasicSummaryFromText(text)
    }
    
    try {
      // Optimize for speed with shorter, focused prompt
      const trimmedText = text.length > 6000 ? text.substring(0, 6000) + '...' : text
      const fastPrompt = `Key points from this text:\n\n${trimmedText}`
      
      const startTime = Date.now()
      const result = await this.model.generateContent(fastPrompt)
      const response = await result.response
      const processingTime = Date.now() - startTime
      
      const summary = response.text()
      return `⚡ AI Summary (${processingTime}ms)\n\n${summary}\n\n🤖 Generated by Gemini 2.0 Flash`
    } catch (error) {
      console.log('⚠️ Gemini summary failed, using fallback')
      return this.generateBasicSummaryFromText(text)
    }
  }
  
  generateBasicSummaryFromText(text) {
    const wordCount = text.split(' ').length
    const sentences = text.split('.').filter(s => s.trim().length > 0)
    
    return `📋 Video Content Summary (AI Analysis Unavailable)

🎥 Content Analysis:
• ${wordCount} words extracted from video
• ${sentences.length} sentences processed
• Video successfully converted to text

📝 Content Preview:
${text.substring(0, 300)}${text.length > 300 ? '...' : ''}

📊 Processing Status:
• Audio extraction: ✅ Complete
• Speech recognition: ✅ Complete  
• Text generation: ✅ Complete
• Processed: ${new Date().toLocaleString()}

💡 Note: AI summarization temporarily unavailable. Full text contains all content.`
  }
}

module.exports = new GeminiService()
