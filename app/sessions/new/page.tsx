import Link from 'next/link'
import AudioRecorder from '@/components/AudioRecorder'

export default function NewSession() {
  return (
    <div style={{ minHeight: '100vh', position: 'relative' }}>
      <div className="orb orb-blue" style={{ opacity: 0.18 }} />
      <div className="orb orb-purple" style={{ opacity: 0.12 }} />
      <div className="grid-overlay" style={{ opacity: 0.4 }} />

      <nav className="nav">
        <Link href="/dashboard" className="nav-logo" style={{ textDecoration: 'none' }}><span className="logo-dot" />ScribeAI</Link>
        <Link href="/sessions" style={{ fontSize: '13px', color: 'var(--text3)', textDecoration: 'none' }}>All sessions →</Link>
      </nav>

      <main style={{ maxWidth: '900px', margin: '0 auto', padding: '40px 24px', position: 'relative', zIndex: 2 }}>
        <div className="fade-up" style={{ marginBottom: '28px' }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '26px', fontWeight: '800', letterSpacing: '-0.02em' }}>New recording</h1>
          <p style={{ color: 'var(--text3)', fontSize: '13px', marginTop: '4px' }}>Choose your source and start capturing</p>
        </div>
        <div className="fade-up fade-up-delay-1">
          <AudioRecorder />
        </div>
      </main>
    </div>
  )
}
