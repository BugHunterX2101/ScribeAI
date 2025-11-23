const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const fs = require('fs');
const path = require('path');
const { speechToText } = require('./speech-to-text.service');

ffmpeg.setFfmpegPath(ffmpegPath);

class VideoToTextService {
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