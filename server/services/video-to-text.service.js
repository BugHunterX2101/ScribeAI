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
        .on('end', () => {
          // Clean up video file
          fs.unlinkSync(videoPath);
          resolve(audioPath);
        })
        .on('error', (err) => {
          console.error('FFmpeg error:', err);
          // Clean up files
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