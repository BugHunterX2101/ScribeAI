'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function Register() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirm) { setError('Passwords do not match'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      if (res.ok) { router.push('/dashboard') }
      else {
        const data = await res.json()
        setError(data.error || 'Registration failed')
      }
    } catch { setError('Network error') }
    finally { setLoading(false) }
  }

  const strength = password.length === 0 ? 0 : password.length < 6 ? 1 : password.length < 10 ? 2 : 3
  const strengthColor = ['transparent', '#f87171', '#fbbf24', '#34d399'][strength]
  const strengthLabel = ['', 'Weak', 'Good', 'Strong'][strength]

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', position: 'relative', overflow: 'hidden' }}>
      <div className="orb orb-blue" />
      <div className="orb orb-purple" />
      <div className="grid-overlay" />

      <div style={{ width: '100%', maxWidth: '420px', position: 'relative', zIndex: 2 }}>
        <div className="fade-up" style={{ textAlign: 'center', marginBottom: '40px' }}>
          <Link href="/" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '8px', fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: '800', color: 'var(--text)' }}>
            <span className="logo-dot" />
            ScribeAI
          </Link>
          <p style={{ color: 'var(--text3)', fontSize: '13px', marginTop: '6px' }}>Free forever. No credit card.</p>
        </div>

        <div className="glass-strong card-glow fade-up fade-up-delay-1" style={{ borderRadius: '20px', padding: '36px' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: '700', marginBottom: '28px', color: 'var(--text)' }}>Create account</h2>

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
              <input type="password" required className="input-field" placeholder="Min. 8 characters" value={password} onChange={e => setPassword(e.target.value)} />
              {password.length > 0 && (
                <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ flex: 1, height: '3px', borderRadius: '2px', background: 'var(--surface)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(strength / 3) * 100}%`, background: strengthColor, transition: 'all 0.3s', borderRadius: '2px' }} />
                  </div>
                  <span style={{ fontSize: '11px', color: strengthColor, minWidth: '36px' }}>{strengthLabel}</span>
                </div>
              )}
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text3)', letterSpacing: '0.05em', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>Confirm password</label>
              <input type="password" required className="input-field" placeholder="Same as above" value={confirm} onChange={e => setConfirm(e.target.value)} style={{ borderColor: confirm && confirm !== password ? 'rgba(248,113,113,0.5)' : undefined }} />
            </div>

            <button type="submit" disabled={loading} className="btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: '8px', padding: '13px' }}>
              {loading ? <><div className="spinner" style={{ width: '16px', height: '16px' }} /> Creating…</> : 'Create account →'}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: '24px', fontSize: '13px', color: 'var(--text3)' }}>
            Already have an account?{' '}
            <Link href="/auth/login" style={{ color: 'var(--accent2)', textDecoration: 'none', fontWeight: '500' }}>Sign in →</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
