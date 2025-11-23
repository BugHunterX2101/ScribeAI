'use client'

import { useState, useRef, useEffect } from 'react'
import { useSocket } from './SocketProvider'

type RecordingMode = 'mic' | 'tab' | 'video'
type RecordingStatus = 'idle' | 'recording' | 'paused' | 'processing' | 'completed'

export default function AudioRecorder() {
  const [status, setStatus] = useState<RecordingStatus>('idle')
  const [mode, setMode] = useState<RecordingMode>('mic')
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [liveTranscript, setLiveTranscript] = useState('')
  const [duration, setDuration] = useState(0)
  const [error, setError] = useState('')

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const { socket, isConnected } = useSocket()
  const sessionIdRef = useRef<string | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (!socket) return
    
    const handleTranscriptPartial = (data: any) => {
      console.log('📝 Partial transcript received:', data.text)
      setLiveTranscript(prev => prev + data.text + ' ')
    }

    const handleStatusUpdate = (data: any) => {
      setStatus(data.status)
    }

    const handleSessionCompleted = (data: any) => {
      setStatus('completed')
      setIsUploading(false)
      if (data.summary) {
        setTranscript(data.summary)
      } else if (data.transcript) {
        setTranscript(data.transcript)
      }
    }

    socket.on('transcript:partial', handleTranscriptPartial)
    socket.on('status:update', handleStatusUpdate)
    socket.on('session:completed', handleSessionCompleted)
    socket.on('video:processing', (data: any) => {
      console.log('🎬 Video processing:', data.message)
    })
    socket.on('video:error', (data: any) => {
      setError(data.error)
      setIsUploading(false)
      setStatus('idle')
    })

    return () => {
      socket.off('transcript:partial', handleTranscriptPartial)
      socket.off('status:update', handleStatusUpdate)
      socket.off('session:completed', handleSessionCompleted)
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [socket])

  const startRecording = async () => {
    try {
      console.log('🎬 Starting recording...')
      console.log('Socket:', socket ? 'Available' : 'Not available')
      console.log('Connected:', isConnected)
      
      setError('')
      setTranscript('')
      setLiveTranscript('')
      setDuration(0)
      
      if (!socket || !isConnected) {
        setError('Socket not connected. Please check if server is running on port 3002.')
        console.error('❌ Socket connection failed')
        return
      }

      console.log('🎤 Requesting media access for:', mode)
      
      let stream: MediaStream
      if (mode === 'mic') {
        stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            sampleRate: 44100
          }
        })
        console.log('✅ Microphone access granted')
      } else {
        // For tab audio, we need to request display media with audio
        try {
          stream = await navigator.mediaDevices.getDisplayMedia({ 
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              sampleRate: 44100
            },
            video: false 
          })
          console.log('✅ Tab audio access granted')
        } catch (tabError) {
          // Fallback: try with video=true and hide video track
          stream = await navigator.mediaDevices.getDisplayMedia({ 
            audio: true,
            video: true
          })
          // Stop video track to only capture audio
          const videoTracks = stream.getVideoTracks()
          videoTracks.forEach(track => track.stop())
          console.log('✅ Tab audio access granted (with video fallback)')
        }
      }

      streamRef.current = stream
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
      })
      
      mediaRecorderRef.current = mediaRecorder

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0 && socket && sessionIdRef.current) {
          console.log('Audio chunk captured:', event.data.size, 'bytes')
          const reader = new FileReader()
          reader.onload = () => {
            const base64 = (reader.result as string).split(',')[1]
            socket.emit('audio:chunk', {
              sessionId: sessionIdRef.current,
              data: base64,
              timestamp: Date.now()
            })
          }
          reader.readAsDataURL(event.data)
        }
      }

      mediaRecorder.onerror = (event) => {
        setError('Recording error occurred')
        console.error('MediaRecorder error:', event)
      }

      // Start session
      console.log('📡 Emitting session:start event')
      socket.emit('session:start', {
        userId: 'temp-user-id',
        mode
      })

      socket.once('session:started', (data: any) => {
        console.log('✅ Session started:', data.sessionId)
        sessionIdRef.current = data.sessionId
        mediaRecorder.start(3000) // 3 second chunks
        setStatus('recording')
        
        intervalRef.current = setInterval(() => {
          setDuration(prev => prev + 1)
        }, 1000)
      })
      
      // Add timeout for session start
      setTimeout(() => {
        if (!sessionIdRef.current) {
          setError('Session failed to start. Server may not be responding.')
          console.error('❌ Session start timeout')
        }
      }, 10000)

    } catch (err: any) {
      setError(`Failed to access ${mode === 'mic' ? 'microphone' : 'tab audio'}: ${err.message}`)
      console.error('Recording start error:', err)
    }
  }



  const pauseRecording = () => {
    if (mediaRecorderRef.current && status === 'recording') {
      mediaRecorderRef.current.pause()
      setStatus('paused')
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
      socket?.emit('session:pause', { sessionId: sessionIdRef.current })
    }
  }

  const resumeRecording = () => {
    if (mediaRecorderRef.current && status === 'paused') {
      mediaRecorderRef.current.resume()
      setStatus('recording')
      intervalRef.current = setInterval(() => {
        setDuration(prev => prev + 1)
      }, 1000)
      socket?.emit('session:resume', { sessionId: sessionIdRef.current })
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && (status === 'recording' || status === 'paused')) {
      mediaRecorderRef.current.stop()
      setStatus('processing')
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
      socket?.emit('session:stop', { sessionId: sessionIdRef.current })
      
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
        streamRef.current = null
      }
    }
  }

  const processVideo = async () => {
    if (!videoFile || !socket || !isConnected) {
      setError('Please select a video file and ensure connection')
      return
    }

    // Validate file size (max 100MB)
    const maxSizeInBytes = 100 * 1024 * 1024 // 100MB
    if (videoFile.size > maxSizeInBytes) {
      setError('Video file is too large. Please select a file smaller than 100MB.')
      return
    }

    // Validate file type
    const validTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/avi', 'video/mov', 'video/wmv']
    if (!validTypes.includes(videoFile.type)) {
      setError('Please select a valid video file (MP4, WebM, OGG, AVI, MOV, WMV)')
      return
    }

    try {
      setIsUploading(true)
      setError('')
      setTranscript('')
      setStatus('processing')

      // Start session for video processing
      socket.emit('session:start', {
        userId: 'temp-user-id',
        mode: 'video'
      })

      socket.once('session:started', async (data: any) => {
        sessionIdRef.current = data.sessionId
        
        try {
          // Convert video to base64 and send in chunks if large
          const reader = new FileReader()
          reader.onload = () => {
            const base64 = (reader.result as string).split(',')[1]
            socket.emit('video:upload', {
              sessionId: sessionIdRef.current,
              data: base64,
              filename: videoFile.name,
              fileSize: videoFile.size
            })
          }
          reader.onerror = () => {
            setError('Failed to read video file. Please try again.')
            setIsUploading(false)
            setStatus('idle')
          }
          reader.readAsDataURL(videoFile)
        } catch (readerError) {
          setError('Failed to process video file. Please try a different file.')
          setIsUploading(false)
          setStatus('idle')
        }
      })

      // Add timeout for session start
      setTimeout(() => {
        if (isUploading && status === 'processing') {
          setError('Video processing timeout. Please try again with a smaller file.')
          setIsUploading(false)
          setStatus('idle')
        }
      }, 300000) // 5 minute timeout

    } catch (err: any) {
      setError(`Video processing failed: ${err.message}`)
      setIsUploading(false)
      setStatus('idle')
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Audio Recording</h2>
          
          {/* Mode Selection */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Recording Source
            </label>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as RecordingMode)}
              disabled={status !== 'idle'}
              title="Select recording source"
              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="mic">Microphone</option>
              <option value="tab">Browser Tab</option>
              <option value="video">Video Upload</option>
            </select>
          </div>



          {/* Video Upload */}
          {mode === 'video' && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Upload Video File
              </label>
              <div className="space-y-2">
                <input
                  type="file"
                  accept="video/mp4,video/webm,video/ogg,video/avi,video/mov,video/wmv"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null
                    setVideoFile(file)
                    if (file) {
                      console.log('📁 Video file selected:', file.name, 'Size:', (file.size / 1024 / 1024).toFixed(2), 'MB')
                    }
                  }}
                  disabled={status !== 'idle'}
                  aria-label="Upload Video File"
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50"
                />
                {videoFile && (
                  <div className="text-sm text-gray-600">
                    <p><strong>File:</strong> {videoFile.name}</p>
                    <p><strong>Size:</strong> {(videoFile.size / 1024 / 1024).toFixed(2)} MB</p>
                    <p><strong>Type:</strong> {videoFile.type}</p>
                  </div>
                )}
                <p className="text-xs text-gray-500">
                  Supported formats: MP4, WebM, OGG, AVI, MOV, WMV (Max 100MB)
                </p>
              </div>
            </div>
          )}

          {/* Recording Controls */}
          <div className="flex items-center space-x-4 mb-6">
            {status === 'idle' && mode !== 'video' && (
              <button
                onClick={startRecording}
                disabled={!isConnected}
                className={`px-6 py-3 rounded-full font-medium ${
                  isConnected 
                    ? 'bg-red-600 hover:bg-red-700 text-white cursor-pointer' 
                    : 'bg-gray-400 text-gray-200 cursor-not-allowed'
                }`}
              >
                {isConnected ? 'Start Recording' : 'Connecting...'}
              </button>
            )}
            
            {status === 'idle' && mode === 'video' && (
              <button
                onClick={processVideo}
                disabled={!videoFile || !isConnected || isUploading}
                title={!videoFile ? 'Please select a video file' : !isConnected ? 'Not connected to server' : 'Process the selected video file'}
                className={`px-6 py-3 rounded-full font-medium transition-colors ${
                  videoFile && isConnected && !isUploading
                    ? 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer' 
                    : 'bg-gray-400 text-gray-200 cursor-not-allowed'
                }`}
              >
                {isUploading ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Processing Video...
                  </span>
                ) : (
                  '🎬 Process Video'
                )}
              </button>
            )}
            
            {status === 'processing' && mode === 'video' && (
              <div className="flex items-center space-x-2">
                <svg className="animate-spin h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span className="text-blue-600 font-medium">Processing video, please wait...</span>
              </div>
            )}
            
            {status === 'recording' && (
              <>
                <button
                  onClick={pauseRecording}
                  className="bg-yellow-600 hover:bg-yellow-700 text-white px-6 py-3 rounded-full font-medium"
                >
                  Pause
                </button>
                <button
                  onClick={stopRecording}
                  className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded-full font-medium"
                >
                  End Recording
                </button>
              </>
            )}
            
            {status === 'paused' && (
              <>
                <button
                  onClick={resumeRecording}
                  className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-full font-medium"
                >
                  Resume
                </button>
                <button
                  onClick={stopRecording}
                  className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded-full font-medium"
                >
                  End Recording
                </button>
              </>
            )}
            


            <div className="text-lg font-mono">
              {formatTime(duration)}
            </div>
            
            <div className={`px-3 py-1 rounded-full text-sm font-medium ${
              status === 'recording' ? 'bg-red-100 text-red-800' :
              status === 'paused' ? 'bg-yellow-100 text-yellow-800' :
              status === 'processing' ? 'bg-blue-100 text-blue-800' :
              status === 'completed' ? 'bg-green-100 text-green-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </div>
          </div>

          {error && (
            <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}
        </div>

        {/* Summary Display */}
        <div className="border-t pt-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            {status === 'completed' ? 'Recording Summary' : 'Live Recording'}
          </h3>
          <div className="bg-gray-50 rounded-lg p-4 min-h-[200px] max-h-[400px] overflow-y-auto">
            {status === 'processing' ? (
              <p className="text-blue-600 italic">Processing recording and generating summary...</p>
            ) : status === 'completed' && transcript ? (
              <p className="text-gray-800 whitespace-pre-wrap">{transcript}</p>
            ) : status === 'recording' ? (
              <div>
                <p className="text-green-600 italic mb-2">Recording in progress...</p>
                {liveTranscript && (
                  <div className="mt-4 p-3 bg-green-50 rounded border-l-4 border-green-400">
                    <p className="text-sm font-medium text-green-800 mb-1">Live Transcript:</p>
                    <p className="text-gray-700 whitespace-pre-wrap">{liveTranscript}</p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-gray-500 italic">Summary will appear here after recording...</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}