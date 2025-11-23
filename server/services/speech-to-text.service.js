// Speech-to-Text Service - Works without Google Cloud credentials
// Uses simulation for now - can be upgraded later

class SpeechToTextService {
  constructor() {
    this.client = null;
    this.phraseIndex = 0;
    console.log('⚠️ Speech-to-Text running in simulation mode (no Google Cloud credentials required)');
  }

  isReady() {
    return true; // Always ready in simulation mode
  }

  async transcribeAudio(audioBuffer, sampleRate = 16000) {
    // Simulate realistic transcription based on audio characteristics
    return this.simulateTranscription(audioBuffer);
  }

  simulateTranscription(audioBuffer) {
    // Enhanced simulation with varied, natural phrases
    const audioSize = audioBuffer.length;
    
    const conversationPhrases = [
      "Thank you for joining today's discussion.",
      "Let's review the main points we need to cover.",
      "I'd like to share some thoughts on this topic.",
      "What are your views on this particular issue?",
      "That's a very interesting perspective to consider.",
      "Could you provide more details about that?",
      "I think we should explore this option further.",
      "Let me add some context to this discussion.",
      "Are there any questions about what we've covered?",
      "We should definitely move forward with this approach.",
      "I appreciate everyone's input on this matter.",
      "Let's discuss the next steps we need to take.",
      "This seems like the right direction to pursue.",
      "We need to consider all the available options.",
      "That makes perfect sense given the circumstances.",
      "I agree with what you're saying here.",
      "Let me clarify my position on this.",
      "We have a few different paths we could take.",
      "I think we're making good progress today.",
      "Does anyone else have thoughts on this?",
      "Let me explain my reasoning behind this.",
      "We should prioritize this in our planning.",
      "I can see both sides of this argument.",
      "Let's make sure we're all on the same page.",
      "We need to finalize these details soon.",
      "I have some concerns about this approach.",
      "That's an excellent point to bring up.",
      "We should schedule a follow-up meeting.",
      "Let me check my notes on that.",
      "I think we're almost done here."
    ];

    // Use a combination of audio size, timestamp, and counter for variety
    const timestamp = Date.now();
    const combinedIndex = (this.phraseIndex + Math.floor(audioSize / 1000) + Math.floor(timestamp / 10000)) % conversationPhrases.length;
    this.phraseIndex = (this.phraseIndex + 1) % conversationPhrases.length;
    
    // Vary confidence slightly for realism
    const baseConfidence = 0.85;
    const variance = (Math.random() - 0.5) * 0.1; // +/- 0.05
    const confidence = Math.min(0.95, Math.max(0.75, baseConfidence + variance));
    
    return {
      text: conversationPhrases[combinedIndex],
      confidence: parseFloat(confidence.toFixed(2)),
      timestamp: Date.now()
    };
  }

  // Convert base64 audio to buffer for processing
  processBase64Audio(base64Audio) {
    try {
      return Buffer.from(base64Audio, 'base64');
    } catch (error) {
      console.error('Audio processing error:', error);
      return Buffer.alloc(0);
    }
  }
}

module.exports = new SpeechToTextService();
