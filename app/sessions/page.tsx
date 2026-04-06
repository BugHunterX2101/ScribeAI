'use client'
import Link from 'next/link'
import { useState, useEffect } from 'react'

interface Session {
  id: string
  title: string
  status: string
  duration: number
  createdAt: string
  transcripts: { id: string; summary: string | null }[]
}

const statusClass: Record<string, string> = {
  completed: 'badge badge-completed',
  processing: 'badge badge-processing',
  recording: 'badge badge-recording',
  paused: 'badge badge-paused',
  idle: 'badge badge-idle',
}

export default function Sessions() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => { fetchSessions() }, [])

  const fetchSessions = async () => {
    try {
      const res = await fetch('/api/sessions')
      if (res.ok) setSessions(await res.json())
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this session and all its transcripts?')) return
    setDeletingId(id)
    const res = await fetch(`/api/sessions/${id}`, { method: 'DELETE' })
    if (res.ok) setSessions(s => s.filter(x => x.id !== id))
    setDeletingId(null)
  }

  const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`

  return (
    <div style={{ minHeight: '100vh', position: 'relative' }}>
      <div className="orb orb-blue" style={{ opacity: 0.15 }} />
      <div className="orb orb-purple" style={{ opacity: 0.12 }} />
      <div className="grid-overlay" style={{ opacity: 0.4 }} />

      <nav className="nav">
        <Link href="/dashboard" className="nav-logo" style={{ textDecoration: 'none' }}><span className="logo-dot" />ScribeAI</Link>
        <Link href="/sessions/new" className="btn-primary" style={{ textDecoration: 'none', fontSize: '13px', padding: '8px 18px' }}>+ New recording</Link>
      </nav>

      <main style={{ maxWidth: '900px', margin: '0 auto', padding: '40px 24px', position: 'relative', zIndex: 2 }}>
        <div className="fade-up" style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '26px', fontWeight: '800', letterSpacing: '-0.02em' }}>Sessions</h1>
            <p style={{ color: 'var(--text3)', fontSize: '13px', marginTop: '4px' }}>
              {sessions.length > 0 ? `${sessions.length} recording${sessions.length !== 1 ? 's' : ''}` : 'No recordings yet'}
            </p>
          </div>
          <Link href="/dashboard" style={{ fontSize: '13px', color: 'var(--text3)', textDecoration: 'none' }}>← Dashboard</Link>
        </div>

        {loading ? (
          <div className="glass fade-up" style={{ borderRadius: '16px', padding: '48px', textAlign: 'center' }}>
            <div className="spinner" style={{ margin: '0 auto 12px' }} />
            <p style={{ color: 'var(--text3)', fontSize: '14px' }}>Loading sessions…</p>
          </div>
        ) : sessions.length === 0 ? (
          <div className="glass fade-up" style={{ borderRadius: '20px', padding: '64px 32px', textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎤</div>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: '700', marginBottom: '8px' }}>No sessions yet</h3>
            <p style={{ color: 'var(--text3)', fontSize: '14px', marginBottom: '28px' }}>Start your first recording to see it here</p>
            <Link href="/sessions/new" className="btn-primary" style={{ textDecoration: 'none' }}>Start recording →</Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {sessions.map((session, i) => (
              <div key={session.id} className={`glass card-glow fade-up fade-up-delay-${Math.min(i + 1, 4)}`} style={{ borderRadius: '16px', padding: '20px 24px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
                  <Link href={`/sessions/${session.id}`} style={{ textDecoration: 'none', flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                      <span className={statusClass[session.status] || 'badge badge-idle'}>
                        {session.status === 'recording' && <span className="rec-dot" />}
                        {session.status}
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--text3)' }}>{fmt(session.duration)}</span>
                    </div>
                    <p style={{ fontFamily: 'var(--font-display)', fontWeight: '600', fontSize: '15px', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: session.transcripts[0]?.summary ? '6px' : 0 }}>
                      {session.title}
                    </p>
                    {session.transcripts[0]?.summary && (
                      <p style={{ fontSize: '12px', color: 'var(--text3)', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                        {session.transcripts[0].summary.substring(0, 120)}…
                      </p>
                    )}
                  </Link>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                    <span style={{ fontSize: '11px', color: 'var(--text3)', whiteSpace: 'nowrap' }}>
                      {new Date(session.createdAt).toLocaleDateString()}
                    </span>
                    <button onClick={() => handleDelete(session.id)} disabled={deletingId === session.id} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: '16px', padding: '4px', lineHeight: 1, transition: 'color 0.2s' }}
                      onMouseEnter={e => (e.currentTarget.style.color = '#f87171')}
                      onMouseLeave={e => (e.currentTarget.style.color = 'var(--text3)')}>
                      {deletingId === session.id ? '⏳' : '×'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
