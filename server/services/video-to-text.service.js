const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const fs = require('fs');
const path = require('path');
const { speechToText } = require('./speech-to-text.service');

ffmpeg.setFfmpegPath(ffmpegPath);

/**
 * Video-to-Text Processing Service
 * 
 * Handles video file uploads, audio extraction using FFmpeg, and speech-to-text conversion.
 * Optimized for speed with ultrafast preset and multi-threading support.
 * 
 * @class VideoToTextService
 * @author ScribeAI Team
 * @version 1.2.0
 */
class VideoToTextService {
  /**
   * Initialize video processing service with temporary directory setup
   * 
   * Creates temp directory for video/audio processing files with automatic cleanup.
   * Configures FFmpeg with optimized settings for fastest processing.
   * 
   * @constructor
   */
  constructor() {
    this.tempDir = path.join(__dirname, '../temp');
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  async extractAudioFromVideo(videoBuffer, sessionId) {
    return new Promise((resolve, reject) => {
      const videoPath = path.join(this.tempDir, `${sessionId}_video.mp4`);
      const audioPath = path.join(this.tempDir, `${sessionId}_audio.wav`);

      // Write video buffer to file
      fs.writeFileSync(videoPath, videoBuffer);

      ffmpeg(videoPath)
        .output(audioPath)
        .audioCodec('pcm_s16le')
        .audioFrequency(16000)
        .audioChannels(1)
        .audioFilters('volume=2.0')  // Boost volume for better recognition
        .outputOptions([
          '-preset', 'ultrafast',    // Fastest encoding
          '-threads', '0',           // Use all CPU cores
          '-ac', '1'                 // Force mono
        ])
        .on('progress', (progress) => {
          console.log(`⚡ Audio extraction: ${Math.round(progress.percent || 0)}%`)
        })
        .on('end', () => {
          console.log('✅ Audio extraction completed')
          fs.unlinkSync(videoPath);
          resolve(audioPath);
        })
        .on('error', (err) => {
          console.error('❌ FFmpeg error:', err);
          if (fs.existsSync(videoPath)) fs.unlinkSync(videoPath);
          if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
          reject(err);
        })
        .run();
    });
  }

  /**
   * Process video file to extract transcript text
   * 
   * Complete pipeline: Video → Audio Extraction → Speech Recognition → Transcript
   * Optimized for performance with automatic cleanup and error handling.
   * 
   * @param {Buffer} videoBuffer - Raw video file data as Buffer
   * @param {string} sessionId - Unique session identifier for file naming
   * @returns {Promise<string>} Extracted transcript text
   * 
   * @throws {Error} When video processing fails (invalid format, no audio, etc.)
   * 
   * @example
   * const videoBuffer = fs.readFileSync('meeting.mp4')
   * const transcript = await videoService.processVideoToText(videoBuffer, 'session-123')
   * // Returns: "Welcome to today's meeting. First agenda item..."
   */
  async processVideoToText(videoBuffer, sessionId) {
    try {
      console.log('🎬 Processing video to text for session:', sessionId);
      
      // Extract audio from video
      const audioPath = await this.extractAudioFromVideo(videoBuffer, sessionId);
      
      // Convert audio to text
      const audioBuffer = fs.readFileSync(audioPath);
      const transcript = await speechToText(audioBuffer);
      
      // Clean up audio file
      fs.unlinkSync(audioPath);
      
      return transcript;
    } catch (error) {
      console.error('Video to text processing error:', error);
      throw error;
    }
  }

  cleanup(sessionId) {
    const videoPath = path.join(this.tempDir, `${sessionId}_video.mp4`);
    const audioPath = path.join(this.tempDir, `${sessionId}_audio.wav`);
    
    [videoPath, audioPath].forEach(filePath => {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    });
  }
}

module.exports = new VideoToTextService();