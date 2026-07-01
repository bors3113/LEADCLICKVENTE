'use client'

import { useActionState, useState, useEffect, useRef } from 'react'
import { login, signup, loginWithGoogle, type AuthState } from './actions'
import { Eye, EyeOff, AlertTriangle, CheckCircle2, ArrowRight, Loader2 } from 'lucide-react'

type Mode = 'signin' | 'signup'

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  )
}

export function LoginForm() {
  const [mode, setMode] = useState<Mode>('signin')
  const [showPw, setShowPw] = useState(false)
  const [visible, setVisible] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  const [loginState, loginAction, loginPending] = useActionState<AuthState, FormData>(login, null)
  const [signupState, signupAction, signupPending] = useActionState<AuthState, FormData>(signup, null)

  const state = mode === 'signin' ? loginState : signupState
  const formAction = mode === 'signin' ? loginAction : signupAction
  const isPending = loginPending || signupPending

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 60)
    return () => clearTimeout(t)
  }, [])

  const switchMode = (m: Mode) => {
    setMode(m)
    setShowPw(false)
    formRef.current?.reset()
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');

        .login-root * { box-sizing: border-box; }

        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes scanline {
          0%   { transform: translateY(-100%); }
          100% { transform: translateY(100vh); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-8px); max-height: 0; }
          to   { opacity: 1; transform: translateY(0);  max-height: 80px; }
        }
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(0,255,128,0); }
          50%       { box-shadow: 0 0 0 6px rgba(0,255,128,0.08); }
        }

        .login-card {
          animation: ${visible ? 'fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) both' : 'none'};
        }
        .login-cursor {
          animation: blink 1s step-end infinite;
        }
        .login-scanline {
          animation: scanline 6s linear infinite;
          opacity: 0.02;
        }
        .login-tab {
          position: relative;
          background: none;
          border: none;
          cursor: pointer;
          font-family: 'Syne', sans-serif;
          font-size: 13px;
          font-weight: 600;
          letter-spacing: 0.06em;
          padding: 10px 0;
          transition: color 0.2s;
          color: #3d5a4a;
          flex: 1;
          text-transform: uppercase;
        }
        .login-tab::after {
          content: '';
          position: absolute;
          bottom: 0; left: 0; right: 0;
          height: 2px;
          background: #00ff80;
          transform: scaleX(0);
          transition: transform 0.25s cubic-bezier(0.16,1,0.3,1);
        }
        .login-tab.active { color: #00ff80; }
        .login-tab.active::after { transform: scaleX(1); }
        .login-tab:hover:not(.active) { color: #7ab896; }

        .login-input {
          width: 100%;
          background: #080f0b;
          border: 1px solid rgba(0,255,128,0.12);
          border-radius: 6px;
          color: #c8e6d4;
          font-family: 'JetBrains Mono', monospace;
          font-size: 13px;
          padding: 11px 14px;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
          caret-color: #00ff80;
        }
        .login-input::placeholder { color: #2d4a38; }
        .login-input:focus {
          border-color: rgba(0,255,128,0.4);
          box-shadow: 0 0 0 3px rgba(0,255,128,0.06);
        }

        .login-submit {
          width: 100%;
          background: #00ff80;
          color: #050908;
          border: none;
          border-radius: 6px;
          padding: 13px;
          font-family: 'JetBrains Mono', monospace;
          font-size: 13px;
          font-weight: 600;
          letter-spacing: 0.08em;
          cursor: pointer;
          transition: opacity 0.15s, transform 0.15s, box-shadow 0.2s;
          display: flex; align-items: center; justify-content: center; gap: 8px;
        }
        .login-submit:hover:not(:disabled) {
          opacity: 0.92;
          transform: translateY(-1px);
          box-shadow: 0 4px 20px rgba(0,255,128,0.25);
        }
        .login-submit:active:not(:disabled) { transform: translateY(0); }
        .login-submit:disabled { opacity: 0.4; cursor: not-allowed; }

        .login-google {
          width: 100%;
          background: transparent;
          color: #8aab96;
          border: 1px solid rgba(0,255,128,0.12);
          border-radius: 6px;
          padding: 12px;
          font-family: 'Syne', sans-serif;
          font-size: 13px;
          font-weight: 600;
          letter-spacing: 0.04em;
          cursor: pointer;
          transition: background 0.2s, color 0.2s, border-color 0.2s;
          display: flex; align-items: center; justify-content: center; gap: 10px;
        }
        .login-google:hover {
          background: rgba(0,255,128,0.04);
          color: #c8e6d4;
          border-color: rgba(0,255,128,0.25);
        }

        .login-alert {
          animation: slideDown 0.3s cubic-bezier(0.16,1,0.3,1) both;
          overflow: hidden;
        }

        .login-eye {
          position: absolute; right: 12px; top: 50%;
          transform: translateY(-50%);
          background: none; border: none; cursor: pointer;
          color: #3d5a4a; padding: 2px;
          transition: color 0.15s;
          display: flex; align-items: center;
        }
        .login-eye:hover { color: #00ff80; }

        .login-spinner {
          width: 14px; height: 14px;
          border: 2px solid #050908;
          border-top-color: transparent;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }
      `}</style>

      <div className="login-root" style={{
        minHeight: '100vh',
        background: '#060a08',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        position: 'relative',
        overflow: 'hidden',
        fontFamily: "'Syne', sans-serif",
      }}>

        {/* Dot grid background */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          backgroundImage: 'radial-gradient(circle, rgba(0,255,128,0.07) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }} />

        {/* Scanline sweep */}
        <div className="login-scanline" style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'linear-gradient(to bottom, transparent 0%, rgba(0,255,128,1) 50%, transparent 100%)',
          height: '30%',
        }} />

        {/* Ambient glow */}
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '600px', height: '600px',
          background: 'radial-gradient(circle, rgba(0,255,128,0.04) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        {/* Card */}
        <div className="login-card" style={{
          width: '100%', maxWidth: '420px',
          background: 'rgba(10,16,12,0.97)',
          border: '1px solid rgba(0,255,128,0.18)',
          borderRadius: '12px',
          boxShadow: '0 0 0 1px rgba(0,255,128,0.05), 0 24px 48px rgba(0,0,0,0.6), 0 0 80px rgba(0,255,128,0.04)',
          overflow: 'hidden',
          position: 'relative',
          zIndex: 1,
        }}>

          {/* Top accent line */}
          <div style={{
            height: '2px',
            background: 'linear-gradient(90deg, transparent, #00ff80 30%, #00ff80 70%, transparent)',
            opacity: 0.6,
          }} />

          <div style={{ padding: '32px 32px 28px' }}>

            {/* Brand */}
            <div style={{ marginBottom: '28px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <div style={{
                  width: '28px', height: '28px',
                  background: 'rgba(0,255,128,0.12)',
                  border: '1px solid rgba(0,255,128,0.25)',
                  borderRadius: '6px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M2 7L6 11L12 3" stroke="#00ff80" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <span style={{
                  fontFamily: "'Syne', sans-serif",
                  fontSize: '17px', fontWeight: 800,
                  letterSpacing: '0.12em',
                  color: '#e2ebe6',
                  textTransform: 'uppercase',
                }}>ClickVente</span>
              </div>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '7px',
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '10px', color: '#3d5a4a',
                letterSpacing: '0.1em',
              }}>
                <span style={{
                  display: 'inline-block',
                  width: '6px', height: '6px',
                  borderRadius: '50%',
                  background: '#00ff80',
                  boxShadow: '0 0 6px #00ff80',
                }} />
                OPERATOR ACCESS TERMINAL
                <span className="login-cursor" style={{ color: '#00ff80' }}>_</span>
              </div>
            </div>

            {/* Tabs */}
            <div style={{
              display: 'flex', gap: '0',
              borderBottom: '1px solid rgba(0,255,128,0.08)',
              marginBottom: '24px',
            }}>
              <button className={`login-tab${mode === 'signin' ? ' active' : ''}`} onClick={() => switchMode('signin')}>
                Sign In
              </button>
              <button className={`login-tab${mode === 'signup' ? ' active' : ''}`} onClick={() => switchMode('signup')}>
                Create Account
              </button>
            </div>

            {/* Alert */}
            {state?.error && (
              <div className="login-alert" style={{
                display: 'flex', alignItems: 'flex-start', gap: '10px',
                background: 'rgba(255,60,60,0.06)',
                border: '1px solid rgba(255,60,60,0.2)',
                borderRadius: '6px',
                padding: '12px 14px',
                marginBottom: '20px',
                color: '#ff6b6b',
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '12px', lineHeight: '1.5',
              }}>
                <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: '1px' }} />
                {state.error}
              </div>
            )}

            {state?.message && (
              <div className="login-alert" style={{
                display: 'flex', alignItems: 'flex-start', gap: '10px',
                background: 'rgba(0,255,128,0.05)',
                border: '1px solid rgba(0,255,128,0.2)',
                borderRadius: '6px',
                padding: '12px 14px',
                marginBottom: '20px',
                color: '#00cc66',
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '12px', lineHeight: '1.5',
              }}>
                <CheckCircle2 size={14} style={{ flexShrink: 0, marginTop: '1px' }} />
                {state.message}
              </div>
            )}

            {/* Form */}
            <form action={formAction} ref={formRef} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{
                  display: 'block',
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '10px', fontWeight: 500,
                  letterSpacing: '0.12em', color: '#4a6b58',
                  marginBottom: '7px', textTransform: 'uppercase',
                }}>
                  Email
                </label>
                <input
                  className="login-input"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@company.com"
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '7px' }}>
                  <label style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '10px', fontWeight: 500,
                    letterSpacing: '0.12em', color: '#4a6b58',
                    textTransform: 'uppercase',
                  }}>
                    Password
                  </label>
                </div>
                <div style={{ position: 'relative' }}>
                  <input
                    className="login-input"
                    name="password"
                    type={showPw ? 'text' : 'password'}
                    required
                    autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                    placeholder="••••••••••"
                    style={{ paddingRight: '42px' }}
                  />
                  <button
                    type="button"
                    className="login-eye"
                    onClick={() => setShowPw(p => !p)}
                    tabIndex={-1}
                  >
                    {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <button type="submit" className="login-submit" disabled={isPending} style={{ marginTop: '4px' }}>
                {isPending ? (
                  <>
                    <div className="login-spinner" />
                    PROCESSING...
                  </>
                ) : mode === 'signin' ? (
                  <>SIGN IN <ArrowRight size={14} /></>
                ) : (
                  <>CREATE ACCOUNT <ArrowRight size={14} /></>
                )}
              </button>
            </form>

            {/* Divider */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              margin: '24px 0',
            }}>
              <div style={{ flex: 1, height: '1px', background: 'rgba(0,255,128,0.08)' }} />
              <span style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '10px', color: '#2d4038',
                letterSpacing: '0.12em', whiteSpace: 'nowrap',
              }}>// OR //</span>
              <div style={{ flex: 1, height: '1px', background: 'rgba(0,255,128,0.08)' }} />
            </div>

            {/* Google */}
            <form action={loginWithGoogle}>
              <button type="submit" className="login-google">
                <GoogleIcon />
                Continue with Google
              </button>
            </form>

            {/* Footer */}
            <p style={{
              marginTop: '24px',
              textAlign: 'center',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '10px',
              color: '#223028',
              letterSpacing: '0.06em',
            }}>
              SECURED · SUPABASE AUTH · END-TO-END ENCRYPTED
            </p>

          </div>
        </div>

      </div>
    </>
  )
}
