import Link from 'next/link'

export default function Home() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
      {/* Background effects */}
      <div className="orb orb-blue" />
      <div className="orb orb-purple" />
      <div className="orb orb-teal" />
      <div className="grid-overlay" />

      {/* Nav */}
      <nav className="nav" style={{ position: 'relative', zIndex: 10 }}>
        <span className="nav-logo">
          <span className="logo-dot" />
          ScribeAI
        </span>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <Link href="/auth/login" className="btn-ghost" style={{ textDecoration: 'none' }}>Sign in</Link>
          <Link href="/auth/register" className="btn-primary" style={{ textDecoration: 'none' }}>Get started →</Link>
        </div>
      </nav>

      {/* Hero */}
      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 24px', position: 'relative', zIndex: 2 }}>
        <div style={{ maxWidth: '820px', textAlign: 'center' }}>

          {/* Badge */}
          <div className="fade-up" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 14px', borderRadius: '99px', background: 'rgba(79,142,255,0.1)', border: '1px solid rgba(79,142,255,0.25)', marginBottom: '40px' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#34d399', boxShadow: '0 0 8px #34d399', display: 'block' }} />
            <span style={{ fontSize: '12px', fontWeight: '600', letterSpacing: '0.05em', color: 'var(--accent2)', textTransform: 'uppercase' }}>Powered by Gemini 2.0 Flash</span>
          </div>

          {/* Headline */}
          <h1 className="fade-up fade-up-delay-1" style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(48px, 8vw, 84px)', fontWeight: '800', lineHeight: '1.0', letterSpacing: '-0.03em', marginBottom: '28px' }}>
            <span style={{ color: 'var(--text)' }}>Audio to insights</span>
            <br />
            <span className="gradient-text">in seconds.</span>
          </h1>

          <p className="fade-up fade-up-delay-2" style={{ fontSize: '18px', color: 'var(--text2)', maxWidth: '560px', margin: '0 auto 48px', lineHeight: '1.7', fontWeight: '300' }}>
            Record meetings, lectures, or conversations. ScribeAI transcribes in real-time and generates AI summaries with Gemini 2.0 Flash.
          </p>

          {/* CTA */}
          <div className="fade-up fade-up-delay-3" style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/auth/register" className="btn-primary" style={{ textDecoration: 'none', fontSize: '15px', padding: '14px 32px' }}>
              Start transcribing free →
            </Link>
            <Link href="/auth/login" className="btn-ghost" style={{ textDecoration: 'none', fontSize: '15px', padding: '14px 32px' }}>
              Sign in
            </Link>
          </div>

          {/* Feature pills */}
          <div className="fade-up fade-up-delay-4" style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap', marginTop: '56px' }}>
            {[
              { icon: '🎤', label: 'Live microphone' },
              { icon: '🖥️', label: 'Browser tab audio' },
              { icon: '🎬', label: 'Video upload' },
              { icon: '⚡', label: 'Sub-3s summaries' },
            ].map(f => (
              <div key={f.label} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '10px', background: 'rgba(13,18,37,0.7)', border: '1px solid var(--border)', fontSize: '13px', color: 'var(--text2)' }}>
                <span>{f.icon}</span> {f.label}
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Stats bar */}
      <div style={{ position: 'relative', zIndex: 2, borderTop: '1px solid var(--border)', background: 'rgba(8,12,24,0.6)', backdropFilter: 'blur(16px)', padding: '24px' }}>
        <div style={{ maxWidth: '720px', margin: '0 auto', display: 'flex', justifyContent: 'center', gap: '48px', flexWrap: 'wrap' }}>
          {[
            { value: '1.5s', label: 'Audio chunks' },
            { value: '<3s', label: 'AI summaries' },
            { value: '100MB', label: 'Max video size' },
            { value: '100%', label: 'Open source' },
          ].map(s => (
            <div key={s.label} style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: '800', color: 'var(--accent2)' }} className="text-glow">{s.value}</div>
              <div style={{ fontSize: '12px', color: 'var(--text3)', marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
