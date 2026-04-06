'use client'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'

interface SessionDetail {
  id: string
  title: string
  status: string
  duration: number
  createdAt: string
  transcripts: { id: string; content: string; summary: string | null }[]
}

export default function SessionDetail() {
  const params = useParams()
  const router = useRouter()
  const [session, setSession] = useState<SessionDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'summary' | 'transcript'>('summary')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (params.id) fetchSession(params.id as string)
  }, [params.id])

  const fetchSession = async (id: string) => {
    try {
      const res = await fetch(`/api/sessions/${id}`)
      if (res.ok) setSession(await res.json())
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`

  const download = () => {
    if (!session?.transcripts[0]) return
    const content = `${session.title}\n${'─'.repeat(40)}\n\nSUMMARY\n${session.transcripts[0].summary ?? 'N/A'}\n\n${'─'.repeat(40)}\n\nFULL TRANSCRIPT\n${session.transcripts[0].content}`
    const url = URL.createObjectURL(new Blob([content], { type: 'text/plain' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `${session.title}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const copyToClipboard = async () => {
    const text = activeTab === 'summary' ? session?.transcripts[0]?.summary : session?.transcripts[0]?.content
    if (!text) return
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDelete = async () => {
    if (!session || !confirm('Delete this session?')) return
    await fetch(`/api/sessions/${session.id}`, { method: 'DELETE' })
    router.push('/sessions')
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto 12px', width: '28px', height: '28px', borderWidth: '3px' }} /><p style={{ color: 'var(--text3)' }}>Loading…</p></div>
    </div>
  )

  if (!session) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <p style={{ color: 'var(--text3)', marginBottom: '16px' }}>Session not found</p>
        <Link href="/sessions" className="btn-ghost" style={{ textDecoration: 'none' }}>← Back to sessions</Link>
      </div>
    </div>
  )

  const transcript = session.transcripts[0]

  return (
    <div style={{ minHeight: '100vh', position: 'relative' }}>
      <div className="orb orb-blue" style={{ opacity: 0.15 }} />
      <div className="orb orb-purple" style={{ opacity: 0.1 }} />
      <div className="grid-overlay" style={{ opacity: 0.4 }} />

      <nav className="nav">
        <Link href="/sessions" className="nav-logo" style={{ textDecoration: 'none' }}><span className="logo-dot" />← Sessions</Link>
        <div style={{ display: 'flex', gap: '10px' }}>
          {transcript && (
            <>
              <button onClick={copyToClipboard} className="btn-ghost" style={{ fontSize: '13px', padding: '8px 16px' }}>
                {copied ? '✓ Copied' : 'Copy'}
              </button>
              <button onClick={download} className="btn-primary" style={{ fontSize: '13px', padding: '8px 18px' }}>
                ↓ Download
              </button>
            </>
          )}
          <button onClick={handleDelete} className="btn-danger" style={{ fontSize: '13px', padding: '8px 16px' }}>Delete</button>
        </div>
      </nav>

      <main style={{ maxWidth: '860px', margin: '0 auto', padding: '40px 24px', position: 'relative', zIndex: 2 }}>
        {/* Header */}
        <div className="fade-up" style={{ marginBottom: '32px' }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '26px', fontWeight: '800', letterSpacing: '-0.02em', marginBottom: '10px' }}>{session.title}</h1>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
            <span className={`badge badge-${session.status}`} style={{ textTransform: 'capitalize' }}>{session.status}</span>
            <span style={{ fontSize: '12px', color: 'var(--text3)' }}>⏱ {fmt(session.duration)}</span>
            <span style={{ fontSize: '12px', color: 'var(--text3)' }}>📅 {new Date(session.createdAt).toLocaleString()}</span>
          </div>
        </div>

        {transcript ? (
          <>
            {/* Tabs */}
            <div className="fade-up fade-up-delay-1" style={{ display: 'flex', gap: '4px', padding: '4px', background: 'rgba(8,12,24,0.6)', borderRadius: '12px', border: '1px solid var(--border)', marginBottom: '20px', width: 'fit-content' }}>
              {(['summary', 'transcript'] as const).map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)} style={{
                  padding: '8px 20px', borderRadius: '9px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '600', fontFamily: 'var(--font-display)', transition: 'all 0.2s',
                  background: activeTab === tab ? 'var(--surface)' : 'transparent',
                  color: activeTab === tab ? 'var(--text)' : 'var(--text3)',
                  boxShadow: activeTab === tab ? '0 2px 8px rgba(0,0,0,0.3)' : 'none',
                }}>
                  {tab === 'summary' ? '⚡ Summary' : '📝 Transcript'}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="glass fade-up fade-up-delay-2" style={{ borderRadius: '16px', padding: '28px' }}>
              {activeTab === 'summary' ? (
                <div>
                  <p style={{ fontSize: '12px', fontWeight: '600', color: 'var(--accent2)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '16px' }}>AI-Generated Summary</p>
                  <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--text2)', lineHeight: '1.8' }}>
                    {transcript.summary ?? 'No summary available for this session.'}
                  </pre>
                </div>
              ) : (
                <div>
                  <p style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '16px' }}>Full Transcript</p>
                  <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--text2)', lineHeight: '1.8' }}>
                    {transcript.content}
                  </pre>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="glass fade-up fade-up-delay-1" style={{ borderRadius: '16px', padding: '48px', textAlign: 'center' }}>
            <p style={{ color: 'var(--text3)', fontSize: '14px' }}>
              {session.status === 'processing' ? '⏳ Processing… refresh in a moment' : 'No transcript available yet.'}
            </p>
          </div>
        )}
      </main>
    </div>
  )
}
