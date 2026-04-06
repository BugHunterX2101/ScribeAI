'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      if (res.ok) { router.push('/dashboard') }
      else {
        const data = await res.json()
        setError(data.error || 'Login failed')
      }
    } catch { setError('Network error') }
    finally { setLoading(false) }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', position: 'relative', overflow: 'hidden' }}>
      <div className="orb orb-blue" />
      <div className="orb orb-purple" />
      <div className="grid-overlay" />

      <div style={{ width: '100%', maxWidth: '420px', position: 'relative', zIndex: 2 }}>
        {/* Logo */}
        <div className="fade-up" style={{ textAlign: 'center', marginBottom: '40px' }}>
          <Link href="/" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '8px', fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: '800', color: 'var(--text)' }}>
            <span className="logo-dot" />
            ScribeAI
          </Link>
          <p style={{ color: 'var(--text3)', fontSize: '13px', marginTop: '6px' }}>Welcome back</p>
        </div>

        {/* Card */}
        <div className="glass-strong card-glow fade-up fade-up-delay-1" style={{ borderRadius: '20px', padding: '36px' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: '700', marginBottom: '28px', color: 'var(--text)' }}>Sign in</h2>

          {error && (
            <div style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: '10px', padding: '12px 16px', marginBottom: '20px', color: '#f87171', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>⚠</span> {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text3)', letterSpacing: '0.05em', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>Email</label>
              <input type="email" required className="input-field" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text3)', letterSpacing: '0.05em', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>Password</label>
              <input type="password" required className="input-field" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} />
            </div>

            <button type="submit" disabled={loading} className="btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: '8px', padding: '13px' }}>
              {loading ? <><div className="spinner" style={{ width: '16px', height: '16px' }} /> Signing in…</> : 'Sign in →'}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: '24px', fontSize: '13px', color: 'var(--text3)' }}>
            No account?{' '}
            <Link href="/auth/register" style={{ color: 'var(--accent2)', textDecoration: 'none', fontWeight: '500' }}>Create one →</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
