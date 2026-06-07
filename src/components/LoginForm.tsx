'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import toast from 'react-hot-toast'

export default function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const { signIn, user, profile, loading: authLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!authLoading && user) {
      if (profile?.role === 'superadmin') {
        router.replace('/admin/dashboard')
      } else {
        router.replace('/employee/dashboard')
      }
    }
  }, [user, profile, authLoading, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { error: signInError } = await signIn(email, password)
      if (signInError) {
        setError('Incorrect email or password.')
      } else {
        toast.success('Welcome back!')
      }
    } catch {
      setError('An unexpected error occurred.')
    } finally {
      setLoading(false)
    }
  }

  if (authLoading || user) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#071628' }}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold-500" />
      </div>
    )
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 overflow-hidden relative"
      style={{ background: '#071628' }}
    >
      {/* Background atmosphere */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Radial gradient layers */}
        <div className="absolute inset-0" style={{
          background: `
            radial-gradient(ellipse 100% 55% at 50% 110%, rgba(10,30,60,.95) 0%, transparent 55%),
            radial-gradient(ellipse 70% 50% at 15% 60%,  rgba(12,35,64,.85) 0%, transparent 55%),
            radial-gradient(ellipse 60% 40% at 85% 40%,  rgba(20,50,90,.6)  0%, transparent 50%),
            linear-gradient(160deg, #071628 0%, #0C2340 30%, #0A1E38 60%, #071628 100%)
          `
        }} />
        {/* Subtle grid */}
        <div className="absolute inset-0" style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.03) 1px, transparent 1px)`,
          backgroundSize: '55px 55px'
        }} />
        {/* SEIV watermark */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 font-serif font-semibold select-none pointer-events-none whitespace-nowrap leading-none"
          style={{ fontSize: 'clamp(120px,22vw,260px)', color: 'rgba(37,99,168,.12)', letterSpacing: '-.04em' }}>
          SEIV
        </div>
        {/* Glow blobs */}
        <div className="absolute -top-20 -left-24 rounded-full" style={{ width: 500, height: 300, background: 'radial-gradient(ellipse, rgba(14,52,100,.7) 0%, transparent 70%)', filter: 'blur(80px)' }} />
        <div className="absolute bottom-12 -right-12 rounded-full" style={{ width: 400, height: 250, background: 'radial-gradient(ellipse, rgba(201,168,76,.06) 0%, transparent 70%)', filter: 'blur(80px)' }} />
      </div>

      {/* Login card */}
      <div
        className="relative z-10 w-full flex rounded-2xl overflow-hidden"
        style={{
          maxWidth: 760,
          border: '1px solid rgba(37,99,168,.35)',
          boxShadow: '0 40px 100px rgba(0,0,0,.8), 0 0 0 1px rgba(255,255,255,.03)',
          animation: 'lsRise .7s cubic-bezier(.22,1,.36,1) both',
        }}
      >
        {/* ── LEFT INFO PANEL ── */}
        <div
          className="hidden md:flex flex-col justify-between p-10 relative overflow-hidden"
          style={{
            width: 340,
            flexShrink: 0,
            background: 'rgba(12,35,64,.85)',
            borderRight: '1px solid rgba(255,255,255,.06)',
          }}
        >
          {/* Grid overlay */}
          <div className="absolute inset-0 pointer-events-none opacity-[.03]" style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,1) 1px,transparent 1px)',
            backgroundSize: '44px 44px'
          }} />

          {/* Brand */}
          <div className="relative z-10">
            <Image
              src="/siev_white.png"
              alt="SEIV"
              width={90}
              height={54}
              className="object-contain"
              priority
            />
          </div>

          {/* Headline */}
          <div className="relative z-10">
            <p className="font-sans font-semibold tracking-widest text-xs uppercase mb-3" style={{ color: '#C9A84C' }}>
              SEIV
            </p>
            <h1 className="font-serif font-medium leading-tight mb-2 text-white" style={{ fontSize: 38, letterSpacing: '-.025em' }}>
              Sales<br /><em className="font-light" style={{ color: 'rgba(255,255,255,.45)' }}>Sub-Ledger</em>
            </h1>
            <div className="w-8 h-px my-5" style={{ background: 'rgba(255,255,255,.12)' }} />
            <p className="font-sans text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,.3)' }}>
              Reconcile daily takings, track credit clients, and close your books — all in one place.
            </p>
          </div>

          {/* Info rows */}
          <div className="relative z-10 flex flex-col gap-2">
            {[
              { icon: 'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z', label: 'Location', value: 'Kampala, Uganda' },
              { icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z', label: 'System', value: 'SEIV v2 · 2026' },
            ].map(row => (
              <div key={row.label} className="flex items-center gap-3 px-3 py-2.5 rounded-xl" style={{ background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.06)' }}>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(201,168,76,.08)', border: '1px solid rgba(201,168,76,.15)' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#C9A84C" strokeWidth="1.6"><path d={row.icon} /></svg>
                </div>
                <div>
                  <p className="font-sans font-bold uppercase tracking-wider" style={{ fontSize: 9, color: 'rgba(255,255,255,.3)' }}>{row.label}</p>
                  <p className="font-sans text-xs" style={{ color: 'rgba(255,255,255,.6)' }}>{row.value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── RIGHT FORM PANEL ── */}
        <div className="flex-1 flex flex-col justify-center px-10 py-12 relative" style={{ background: 'rgba(7,22,40,.96)' }}>
          {/* Top gold line */}
          <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(90deg,transparent,rgba(201,168,76,.2) 40%,rgba(201,168,76,.2) 60%,transparent)' }} />

          {/* Online indicator */}
          <div className="absolute top-4 right-5 flex items-center gap-1.5">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: '#22C55E' }} />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5" style={{ background: '#22C55E' }} />
            </span>
            <span className="font-sans font-semibold tracking-widest" style={{ fontSize: 9, color: 'rgba(255,255,255,.25)' }}>ONLINE</span>
          </div>

          {/* Form header */}
          <p className="font-sans font-bold tracking-widest uppercase mb-2" style={{ fontSize: 9, color: '#C9A84C' }}>
            Welcome Back
          </p>
          <h2 className="font-serif font-medium text-white mb-1" style={{ fontSize: 26, letterSpacing: '-.02em' }}>
            Sign In
          </h2>
          <p className="font-sans text-xs mb-8" style={{ color: 'rgba(255,255,255,.3)' }}>
            Enter your credentials to continue
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
            {/* Email */}
            <div>
              <label className="block font-sans font-bold uppercase tracking-wider mb-1.5" style={{ fontSize: 9, color: 'rgba(255,255,255,.35)' }}>
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={e => { setEmail(e.target.value); setError('') }}
                onKeyDown={e => e.key === 'Enter' && handleSubmit(e as any)}
                placeholder="you@example.com"
                autoComplete="email"
                required
                className="w-full font-sans text-sm text-white outline-none rounded-xl px-4 py-3 transition-all duration-200"
                style={{
                  background: 'rgba(255,255,255,.06)',
                  border: '1px solid rgba(255,255,255,.09)',
                  fontSize: 13,
                }}
                onFocus={e => { e.currentTarget.style.borderColor = 'rgba(201,168,76,.55)'; e.currentTarget.style.background = 'rgba(201,168,76,.04)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(201,168,76,.08)' }}
                onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,.09)'; e.currentTarget.style.background = 'rgba(255,255,255,.06)'; e.currentTarget.style.boxShadow = 'none' }}
              />
            </div>

            {/* Password */}
            <div>
              <label className="block font-sans font-bold uppercase tracking-wider mb-1.5" style={{ fontSize: 9, color: 'rgba(255,255,255,.35)' }}>
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError('') }}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                  className="w-full font-sans text-sm text-white outline-none rounded-xl px-4 py-3 pr-11 transition-all duration-200"
                  style={{
                    background: 'rgba(255,255,255,.06)',
                    border: '1px solid rgba(255,255,255,.09)',
                    fontSize: 13,
                  }}
                  onFocus={e => { e.currentTarget.style.borderColor = 'rgba(201,168,76,.55)'; e.currentTarget.style.background = 'rgba(201,168,76,.04)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(201,168,76,.08)' }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,.09)'; e.currentTarget.style.background = 'rgba(255,255,255,.06)'; e.currentTarget.style.boxShadow = 'none' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 transition-colors"
                  style={{ color: 'rgba(255,255,255,.25)' }}
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Error */}
            <p className="font-sans text-xs text-center min-h-[16px]" style={{ color: '#FF8A8A' }}>
              {error}
            </p>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full font-sans font-bold rounded-xl py-3.5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: '#C9A84C',
                color: '#000',
                fontSize: 13,
                letterSpacing: '.03em',
              }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.background = '#E8C97A' }}
              onMouseLeave={e => { e.currentTarget.style.background = '#C9A84C' }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Signing in…
                </span>
              ) : 'Sign In'}
            </button>
          </form>

          <p className="font-sans text-center mt-6" style={{ fontSize: 9, letterSpacing: '.1em', color: 'rgba(255,255,255,.15)' }}>
            <strong style={{ color: 'rgba(255,255,255,.25)' }}>SEIV</strong> · See clearly · 2026
          </p>
        </div>
      </div>

      {/* Entrance animation */}
      <style>{`
        @keyframes lsRise {
          from { opacity: 0; transform: translateY(36px) scale(.97); }
          to   { opacity: 1; transform: translateY(0)    scale(1); }
        }
      `}</style>
    </div>
  )
}
