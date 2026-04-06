'use client'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import AudioRecorder from '../../components/AudioRecorder'

interface DashboardStats {
  totalSessions: number
  hoursTranscribed: number
  completedSessions: number
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>({ totalSessions: 0, hoursTranscribed: 0, completedSessions: 0 })
  const [loading, setLoading] = useState(true)
  const [userEmail, setUserEmail] = useState('')

  useEffect(() => {
    fetchStats()
    fetch('/api/auth/me').then(r => r.ok ? r.json() : null).then(d => { if (d?.email) setUserEmail(d.email) })
  }, [])

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/sessions')
      if (res.ok) {
        const sessions = await res.json()
        setStats({
          totalSessions: sessions.length,
          hoursTranscribed: Math.round(sessions.reduce((s: number, sess: { duration?: number }) => s + (sess.duration || 0), 0) / 360) / 10,
          completedSessions: sessions.filter((s: { status: string }) => s.status === 'completed').length,
        })
      }
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.href = '/auth/login'
  }

  const statCards = [
    { label: 'Total sessions', value: stats.totalSessions, icon: '📋', color: 'var(--accent)', glow: 'rgba(79,142,255,0.15)' },
    { label: 'Hours transcribed', value: stats.hoursTranscribed, icon: '⏱', color: 'var(--green)', glow: 'rgba(52,211,153,0.12)' },
    { label: 'Completed', value: stats.completedSessions, icon: '✅', color: 'var(--accent3)', glow: 'rgba(167,139,250,0.12)' },
  ]

  return (
    <div style={{ minHeight: '100vh', position: 'relative' }}>
      <div className="orb orb-blue" style={{ opacity: 0.2 }} />
      <div className="orb orb-purple" style={{ opacity: 0.15 }} />
      <div className="grid-overlay" style={{ opacity: 0.5 }} />

      <nav className="nav">
        <Link href="/dashboard" className="nav-logo" style={{ textDecoration: 'none' }}>
          <span className="logo-dot" />
          ScribeAI
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Link href="/sessions" className="btn-ghost" style={{ textDecoration: 'none', fontSize: '13px', padding: '8px 16px' }}>Sessions</Link>
          {userEmail && <span style={{ fontSize: '12px', color: 'var(--text3)' }}>{userEmail}</span>}
          <button onClick={handleLogout} className="btn-ghost" style={{ fontSize: '13px', padding: '8px 16px' }}>Sign out</button>
        </div>
      </nav>

      <main style={{ maxWidth: '1100px', margin: '0 auto', padding: '40px 24px', position: 'relative', zIndex: 2 }}>

        {/* Header */}
        <div className="fade-up" style={{ marginBottom: '36px' }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '28px', fontWeight: '800', letterSpacing: '-0.02em', color: 'var(--text)' }}>Dashboard</h1>
          <p style={{ color: 'var(--text3)', fontSize: '14px', marginTop: '4px' }}>Record, transcribe and summarize — all in one place</p>
        </div>

        {/* Stat cards */}
        <div className="fade-up fade-up-delay-1" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '36px' }}>
          {statCards.map(card => (
            <div key={card.label} className="glass card-glow stat-card" style={{ borderRadius: '16px', boxShadow: loading ? 'none' : `0 0 40px ${card.glow}` }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span style={{ fontSize: '20px' }}>{card.icon}</span>
                <span style={{ fontSize: '10px', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text3)' }}>ALL TIME</span>
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '36px', fontWeight: '800', color: card.color, lineHeight: 1 }}>
                {loading ? '–' : card.value}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text3)', marginTop: '6px' }}>{card.label}</div>
            </div>
          ))}
        </div>

        {/* Quick links */}
        <div className="fade-up fade-up-delay-2" style={{ display: 'flex', gap: '12px', marginBottom: '36px', flexWrap: 'wrap' }}>
          <Link href="/sessions/new" className="btn-primary" style={{ textDecoration: 'none' }}>
            + New recording
          </Link>
          <Link href="/sessions" className="btn-ghost" style={{ textDecoration: 'none' }}>
            View all sessions →
          </Link>
        </div>

        {/* Recorder */}
        <div className="fade-up fade-up-delay-3">
          <AudioRecorder />
        </div>
      </main>
    </div>
  )
}
