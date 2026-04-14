'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Stage = 'loading' | 'set-password' | 'success' | 'error'

export default function SetPasswordPage() {
  const supabase = createClient()
  const router   = useRouter()

  const [stage, setStage]           = useState<Stage>('loading')
  const [password, setPassword]     = useState('')
  const [confirm, setConfirm]       = useState('')
  const [showPw, setShowPw]         = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [userName, setUserName]     = useState('')

  useEffect(() => {
    async function initSession() {
      // Method 1: Cookie session (PKCE flow — user came through /auth/callback)
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        const name = session.user.user_metadata?.full_name || ''
        setUserName(name.split(' ')[0] || '')
        setStage('set-password')
        return
      }

      // Method 2: Hash tokens (implicit flow fallback)
      const hash   = window.location.hash.substring(1)
      const params = new URLSearchParams(hash)
      const accessToken  = params.get('access_token')
      const refreshToken = params.get('refresh_token')

      if (accessToken && refreshToken) {
        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        })
        if (!error && data.session) {
          const name = data.session.user.user_metadata?.full_name || ''
          setUserName(name.split(' ')[0] || '')
          setStage('set-password')
          window.history.replaceState(null, '', window.location.pathname)
          return
        }
      }

      setStage('error')
    }
    initSession()
  }, [])

  function getStrength(pw: string): { label: string; color: string; pct: string } {
    if (!pw) return { label: '', color: 'transparent', pct: '0%' }
    const score = [
      pw.length >= 8,
      /[A-Z]/.test(pw),
      /[a-z]/.test(pw),
      /[0-9]/.test(pw),
      /[^A-Za-z0-9]/.test(pw),
    ].filter(Boolean).length
    if (score <= 2) return { label: 'Weak',   color: '#e05c3a', pct: '25%' }
    if (score === 3) return { label: 'Fair',   color: '#c8a96e', pct: '55%' }
    if (score === 4) return { label: 'Good',   color: '#5DCAA5', pct: '80%' }
    return               { label: 'Strong', color: '#5DCAA5', pct: '100%' }
  }

  async function handleSubmit() {
    setError(null)
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (password !== confirm) { setError('Passwords don\'t match.'); return }
    setSubmitting(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) {
      setError(updateError.message || 'Something went wrong. Please try again.')
      setSubmitting(false)
      return
    }
    setStage('success')
    setTimeout(() => router.push('/portal'), 2000)
  }

  const strength = getStrength(password)

  const base: React.CSSProperties = {
    minHeight: '100vh',
    background: '#0e1a10',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 20px',
  }

  if (stage === 'loading') return (
    <div style={base}>
      <p style={{ color: 'rgba(245,240,232,0.4)', fontFamily: 'sans-serif', fontSize: 15 }}>Setting up your account\u2026</p>
    </div>
  )

  if (stage === 'error') return (
    <div style={base}>
      <div style={{ background: '#1a2e1c', borderRadius: 8, padding: '52px 44px', maxWidth: 440, width: '100%', textAlign: 'center' }}>
        <h1 style={{ color: '#f5f0e8', fontFamily: 'Georgia,serif', fontWeight: 400, fontSize: 24, margin: '0 0 16px' }}>This link has expired</h1>
        <p style={{ color: 'rgba(245,240,232,0.6)', fontFamily: 'sans-serif', fontSize: 15, lineHeight: 1.6, marginBottom: 32 }}>
          Setup links expire after 24 hours. Go to the sign-in page and use &quot;Forgot password&quot; to get a fresh one sent to your email.
        </p>
        <a href="/login" style={{ display: 'block', background: '#c8a96e', color: '#1a2e1c', textDecoration: 'none', textAlign: 'center', padding: '15px', borderRadius: 6, fontFamily: 'sans-serif', fontSize: 13, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          Go to sign-in page
        </a>
      </div>
    </div>
  )

  if (stage === 'success') return (
    <div style={base}>
      <div style={{ background: '#1a2e1c', borderRadius: 8, padding: '52px 44px', maxWidth: 440, width: '100%', textAlign: 'center' }}>
        <div style={{ fontSize: 36, color: '#c8a96e', marginBottom: 20 }}>{'\u2713'}</div>
        <h1 style={{ color: '#f5f0e8', fontFamily: 'Georgia,serif', fontWeight: 400, fontSize: 24, margin: '0 0 12px' }}>Password created</h1>
        <p style={{ color: 'rgba(245,240,232,0.6)', fontFamily: 'sans-serif', fontSize: 15, margin: 0 }}>Taking you to your portal now\u2026</p>
      </div>
    </div>
  )

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'rgba(245,240,232,0.06)',
    border: '1px solid rgba(245,240,232,0.12)',
    borderRadius: 6,
    color: '#f5f0e8',
    fontFamily: 'sans-serif',
    fontSize: 16,
    padding: '14px 48px 14px 16px',
    outline: 'none',
  }

  return (
    <div style={base}>
      <div style={{ width: '100%', maxWidth: 460 }}>
        <div style={{ height: 3, background: '#c8a96e', borderRadius: '6px 6px 0 0' }} />
        <div style={{ background: '#1a2e1c', borderRadius: '0 0 6px 6px', padding: '48px 44px 44px' }}>
          <p style={{ fontFamily: 'sans-serif', fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#c8a96e', margin: '0 0 16px' }}>
            Vital Kaua&#x02BB;i &middot; Member Portal
          </p>
          <h1 style={{ color: '#f5f0e8', fontFamily: 'Georgia,serif', fontWeight: 400, fontSize: 28, margin: '0 0 8px' }}>
            {userName ? `Welcome, ${userName}.` : 'Create your password'}
          </h1>
          <p style={{ color: 'rgba(245,240,232,0.55)', fontFamily: 'sans-serif', fontSize: 15, margin: '0 0 36px', lineHeight: 1.6 }}>
            Create a password you&apos;ll use every time you sign in.
          </p>

          {error && (
            <div style={{ background: 'rgba(224,92,58,0.12)', border: '1px solid rgba(224,92,58,0.3)', borderRadius: 6, color: '#e05c3a', fontFamily: 'sans-serif', fontSize: 14, padding: '12px 16px', marginBottom: 20 }}>
              {error}
            </div>
          )}

          <label style={{ display: 'block', fontFamily: 'sans-serif', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(245,240,232,0.5)', marginBottom: 8 }}>
            Password
          </label>
          <div style={{ position: 'relative', marginBottom: 12 }}>
            <input
              type={showPw ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Create a strong password"
              style={inputStyle}
              autoComplete="new-password"
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            />
            <button
              onClick={() => setShowPw(p => !p)}
              style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(245,240,232,0.4)', fontSize: 16, padding: 0 }}
            >
              {showPw ? '\uD83D\uDE48' : '\uD83D\uDC41'}
            </button>
          </div>

          {password.length > 0 && (
            <>
              <div style={{ height: 3, background: 'rgba(245,240,232,0.08)', borderRadius: 2, marginBottom: 6, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: strength.pct, background: strength.color, borderRadius: 2, transition: 'width 0.3s, background 0.3s' }} />
              </div>
              <div style={{ fontFamily: 'sans-serif', fontSize: 12, color: strength.color, textAlign: 'right', marginBottom: 20 }}>{strength.label}</div>
            </>
          )}

          <label style={{ display: 'block', fontFamily: 'sans-serif', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(245,240,232,0.5)', marginBottom: 8 }}>
            Confirm password
          </label>
          <div style={{ position: 'relative', marginBottom: 24 }}>
            <input
              type={showPw ? 'text' : 'password'}
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="Re-enter your password"
              style={{ ...inputStyle, borderColor: confirm && confirm !== password ? 'rgba(224,92,58,0.5)' : 'rgba(245,240,232,0.12)' }}
              autoComplete="new-password"
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={submitting}
            style={{ width: '100%', background: submitting ? 'rgba(200,169,110,0.5)' : '#c8a96e', color: '#1a2e1c', border: 'none', borderRadius: 6, fontFamily: 'sans-serif', fontSize: 13, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', padding: '16px', cursor: submitting ? 'not-allowed' : 'pointer' }}
          >
            {submitting ? 'Creating account\u2026' : 'Create password & enter portal'}
          </button>

          <p style={{ fontFamily: 'sans-serif', fontSize: 12, color: 'rgba(245,240,232,0.3)', textAlign: 'center', marginTop: 16, lineHeight: 1.6 }}>
            Min. 8 characters. Mix of letters and numbers recommended.
          </p>
        </div>
      </div>
    </div>
  )
}
