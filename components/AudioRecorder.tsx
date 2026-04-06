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
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [videoProcessingMsg, setVideoProcessingMsg] = useState('')

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const { socket, isConnected } = useSocket()
  const sessionIdRef = useRef<string | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const transcriptRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.userId) setCurrentUserId(d.userId) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!socket) return
    const onPartial = (d: { text: string }) => {
      setLiveTranscript(p => p + d.text + ' ')
      setTimeout(() => transcriptRef.current?.scrollTo({ top: 999999, behavior: 'smooth' }), 50)
    }
    const onStatus = (d: { status: RecordingStatus }) => setStatus(d.status)
    const onCompleted = (d: { summary?: string; transcript?: string }) => {
      setStatus('completed')
      setIsUploading(false)
      setTranscript(d.summary || d.transcript || '')
    }
    const onVideoProcessing = (d: { message: string }) => setVideoProcessingMsg(d.message)
    const onVideoError = (d: { error: string }) => { setError(d.error); setIsUploading(false); setStatus('idle') }

    socket.on('transcript:partial', onPartial)
    socket.on('status:update', onStatus)
    socket.on('session:completed', onCompleted)
    socket.on('video:processing', onVideoProcessing)
    socket.on('video:error', onVideoError)
    return () => {
      socket.off('transcript:partial', onPartial)
      socket.off('status:update', onStatus)
      socket.off('session:completed', onCompleted)
      socket.off('video:processing', onVideoProcessing)
      socket.off('video:error', onVideoError)
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [socket])

  const startRecording = async () => {
    try {
      setError(''); setTranscript(''); setLiveTranscript(''); setDuration(0)
      if (!socket || !isConnected) { setError('Not connected to server. Is the backend running on port 3001?'); return }

      let stream: MediaStream
      if (mode === 'mic') {
        stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 44100 } })
      } else {
        try {
          stream = await navigator.mediaDevices.getDisplayMedia({ audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 44100 } as MediaTrackConstraints, video: false })
        } catch {
          stream = await navigator.mediaDevices.getDisplayMedia({ audio: true, video: true })
          stream.getVideoTracks().forEach(t => t.stop())
        }
      }
      streamRef.current = stream
      const mr = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4' })
      mediaRecorderRef.current = mr

      mr.ondataavailable = e => {
        if (e.data.size > 0 && socket && sessionIdRef.current) {
          const reader = new FileReader()
          reader.onload = () => socket.emit('audio:chunk', { sessionId: sessionIdRef.current, data: (reader.result as string).split(',')[1], timestamp: Date.now(), size: e.data.size })
          reader.readAsDataURL(e.data)
        }
      }
      mr.onerror = () => setError('Recording error occurred')

      socket.emit('session:start', { userId: currentUserId, mode })
      socket.once('session:started', (d: { sessionId: string }) => {
        sessionIdRef.current = d.sessionId
        mr.start(1500)
        setStatus('recording')
        intervalRef.current = setInterval(() => setDuration(p => p + 1), 1000)
      })
      setTimeout(() => { if (!sessionIdRef.current) setError('Session failed to start. Check backend.') }, 10000)
    } catch (err: unknown) {
      setError(`Failed to access ${mode === 'mic' ? 'microphone' : 'tab audio'}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const pauseRecording = () => {
    if (mediaRecorderRef.current && status === 'recording') {
      mediaRecorderRef.current.pause()
      setStatus('paused')
      if (intervalRef.current) clearInterval(intervalRef.current)
      socket?.emit('session:pause', { sessionId: sessionIdRef.current })
    }
  }

  const resumeRecording = () => {
    if (mediaRecorderRef.current && status === 'paused') {
      mediaRecorderRef.current.resume()
      setStatus('recording')
      intervalRef.current = setInterval(() => setDuration(p => p + 1), 1000)
      socket?.emit('session:resume', { sessionId: sessionIdRef.current })
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && (status === 'recording' || status === 'paused')) {
      mediaRecorderRef.current.stop()
      setStatus('processing')
      if (intervalRef.current) clearInterval(intervalRef.current)
      socket?.emit('session:stop', { sessionId: sessionIdRef.current })
      streamRef.current?.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
  }

  const processVideo = async () => {
    if (!videoFile || !socket || !isConnected) { setError('Select a video file and ensure the server is connected'); return }
    if (videoFile.size > 100 * 1024 * 1024) { setError('File too large (max 100MB)'); return }
    const validTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/avi', 'video/mov', 'video/wmv']
    if (!validTypes.includes(videoFile.type)) { setError('Unsupported format. Use MP4, WebM, OGG, AVI, MOV, or WMV'); return }

    setIsUploading(true); setError(''); setTranscript(''); setStatus('processing')
    socket.emit('session:start', { userId: currentUserId, mode: 'video' })
    socket.once('session:started', async (d: { sessionId: string }) => {
      sessionIdRef.current = d.sessionId
      const reader = new FileReader()
      reader.onload = () => socket.emit('video:upload', { sessionId: sessionIdRef.current, data: (reader.result as string).split(',')[1], filename: videoFile.name, fileSize: videoFile.size })
      reader.onerror = () => { setError('Failed to read video file'); setIsUploading(false); setStatus('idle') }
      reader.readAsDataURL(videoFile)
    })
  }

  const fmt = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`

  const modeOptions = [
    { value: 'mic', label: 'Microphone', icon: '🎤' },
    { value: 'tab', label: 'Browser tab', icon: '🖥️' },
    { value: 'video', label: 'Video file', icon: '🎬' },
  ]

  return (
    <div className="glass-strong" style={{ borderRadius: '20px', overflow: 'hidden', border: '1px solid var(--border2)' }}>
      {/* Header bar */}
      <div style={{ padding: '20px 28px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: '700', fontSize: '15px' }}>Recording studio</span>
          <span className={`badge badge-${status}`}>
            {status === 'recording' && <span className="rec-dot" />}
            {status}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Connection indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: isConnected ? 'var(--green)' : 'var(--text3)' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: isConnected ? 'var(--green)' : 'var(--text3)', boxShadow: isConnected ? '0 0 8px var(--green)' : 'none', display: 'block' }} />
            {isConnected ? 'Connected' : 'Offline'}
          </div>

          {/* Timer */}
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: '700', color: status === 'recording' ? 'var(--red)' : 'var(--text2)', letterSpacing: '0.05em', minWidth: '60px' }}>
            {fmt(duration)}
          </span>
        </div>
      </div>

      <div style={{ padding: '28px' }}>
        {/* Mode selector */}
        <div style={{ marginBottom: '24px' }}>
          <p style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: '10px' }}>Source</p>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {modeOptions.map(m => (
              <button key={m.value} onClick={() => setMode(m.value as RecordingMode)} disabled={status !== 'idle'}
                style={{
                  padding: '9px 18px', borderRadius: '10px', border: '1px solid', cursor: status === 'idle' ? 'pointer' : 'not-allowed', fontSize: '13px', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s',
                  background: mode === m.value ? 'rgba(79,142,255,0.15)' : 'transparent',
                  borderColor: mode === m.value ? 'rgba(79,142,255,0.5)' : 'var(--border)',
                  color: mode === m.value ? 'var(--accent2)' : 'var(--text2)',
                }}>
                {m.icon} {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Video upload */}
        {mode === 'video' && (
          <div style={{ marginBottom: '24px', padding: '16px', background: 'rgba(8,12,24,0.5)', borderRadius: '12px', border: '1px solid var(--border)' }}>
            <p style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: '10px' }}>Video file</p>
            <input type="file" accept="video/mp4,video/webm,video/ogg,video/avi,video/mov,video/wmv"
              onChange={e => setVideoFile(e.target.files?.[0] || null)}
              disabled={status !== 'idle'}
              aria-label="Upload video file"
              className="input-field"
              style={{ padding: '8px 12px', cursor: 'pointer' }} />
            {videoFile && (
              <p style={{ fontSize: '12px', color: 'var(--text3)', marginTop: '8px' }}>
                {videoFile.name} · {(videoFile.size / 1024 / 1024).toFixed(1)} MB
              </p>
            )}
          </div>
        )}

        {/* Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px', flexWrap: 'wrap' }}>
          {status === 'idle' && mode !== 'video' && (
            <button onClick={startRecording} disabled={!isConnected} className="btn-primary"
              style={{ background: isConnected ? 'linear-gradient(135deg, #dc2626, #ef4444)' : undefined, boxShadow: isConnected ? '0 4px 20px rgba(239,68,68,0.3)' : undefined }}>
              ● Start recording
            </button>
          )}
          {status === 'idle' && mode === 'video' && (
            <button onClick={processVideo} disabled={!videoFile || !isConnected || isUploading} className="btn-primary">
              {isUploading ? <><div className="spinner" style={{ width: '14px', height: '14px' }} /> Processing…</> : '🎬 Process video'}
            </button>
          )}
          {status === 'recording' && (
            <>
              <button onClick={pauseRecording} className="btn-ghost">⏸ Pause</button>
              <button onClick={stopRecording} className="btn-ghost">⏹ Stop</button>
            </>
          )}
          {status === 'paused' && (
            <>
              <button onClick={resumeRecording} className="btn-primary">▶ Resume</button>
              <button onClick={stopRecording} className="btn-ghost">⏹ Stop</button>
            </>
          )}
          {status === 'recording' && (
            <div className="waveform" style={{ marginLeft: '4px' }}>
              {Array.from({ length: 7 }).map((_, i) => <div key={i} className="wave-bar" />)}
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: '10px', padding: '12px 16px', marginBottom: '20px', color: '#f87171', fontSize: '13px', display: 'flex', gap: '8px' }}>
            <span>⚠</span> {error}
          </div>
        )}

        {/* Output area */}
        <div>
          <p style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: '10px' }}>
            {status === 'completed' ? '⚡ AI summary' : status === 'recording' ? '🎤 Live transcript' : status === 'processing' ? '⏳ Processing' : 'Output'}
          </p>
          <div ref={transcriptRef} style={{ background: 'rgba(4,6,12,0.6)', borderRadius: '12px', border: '1px solid var(--border)', padding: '20px', minHeight: '180px', maxHeight: '360px', overflowY: 'auto' }}>
            {status === 'processing' && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '140px', gap: '12px' }}>
                <div className="spinner" style={{ width: '28px', height: '28px', borderWidth: '3px' }} />
                <p style={{ color: 'var(--text3)', fontSize: '13px' }}>{videoProcessingMsg || 'Generating transcript and summary…'}</p>
              </div>
            )}
            {status === 'completed' && transcript && (
              <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--text2)', lineHeight: '1.75' }}>{transcript}</pre>
            )}
            {status === 'recording' && (
              <div>
                {liveTranscript ? (
                  <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--text2)', lineHeight: '1.75' }}>{liveTranscript}</pre>
                ) : (
                  <p style={{ color: 'var(--text3)', fontSize: '13px', fontStyle: 'italic' }}>Listening… speak clearly into your microphone.</p>
                )}
              </div>
            )}
            {status === 'idle' && (
              <p style={{ color: 'var(--text3)', fontSize: '13px', fontStyle: 'italic' }}>AI summary will appear here after recording.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
