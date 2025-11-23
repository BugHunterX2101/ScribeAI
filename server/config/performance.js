// Performance optimization configuration
module.exports = {
  // Gemini API optimizations
  gemini: {
    maxOutputTokens: 800,     // Faster generation with limited output
    temperature: 0.3,         // Lower for faster, more focused responses
    topP: 0.8,
    topK: 20,                 // Reduced for speed
    maxInputLength: 6000,     // Limit input text for faster processing
    timeoutMs: 10000         // 10 second timeout for generation
  },
  
  // Audio processing optimizations  
  audio: {
    chunkSize: 1500,          // 1.5 second chunks for faster processing
    sampleRate: 16000,        // Optimized sample rate
    channels: 1,              // Mono for speed
    bitDepth: 16              // Standard bit depth
  },
  
  // Video processing optimizations
  video: {
    maxFileSize: 100 * 1024 * 1024,  // 100MB limit
    audioCodec: 'pcm_s16le',
    preset: 'ultrafast',              // Fastest FFmpeg preset
    threads: 0,                       // Use all CPU cores
    volumeBoost: 2.0                  // Improve audio recognition
  },
  
  // General performance settings
  general: {
    enableParallelProcessing: true,   // Process transcription and summary in parallel
    enableProgressFeedback: true,     // Real-time progress updates
    cacheResults: false,              // Disable caching for real-time processing
    maxConcurrentSessions: 10         // Limit concurrent processing sessions
  }
}