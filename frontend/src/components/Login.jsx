import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { ShieldAlert, LogIn, Shield, X } from 'lucide-react'

export default function Login({ onClose }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await login(email, password)
      if (onClose) onClose()
    } catch (err) {
      setError('Invalid admin credentials or server error')
    } finally {
      setLoading(false)
    }
  }

  const content = (
    <div
      className="card"
      style={{
        padding: 36,
        width: 420,
        maxWidth: '92%',
        textAlign: 'center',
        position: 'relative',
        boxShadow: '0 24px 48px rgba(0,0,0,0.5)',
        border: '1px solid var(--border)',
      }}
      onClick={e => e.stopPropagation()}
    >
      {onClose && (
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 16,
            right: 16,
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: 4,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 6,
          }}
          title="Close"
        >
          <X size={18} />
        </button>
      )}

      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
        <div style={{ background: 'rgba(59,130,246,0.12)', padding: 14, borderRadius: '50%' }}>
          <Shield size={30} style={{ color: 'var(--accent-blue)' }} />
        </div>
      </div>
      <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22, marginBottom: 6 }}>
        Admin Sign In
      </h2>
      <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 24 }}>
        Enter administrator credentials to unlock pipeline execution and system controls.
      </p>

      {error && (
        <div style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--accent-red)', padding: '10px 14px', borderRadius: 8, fontSize: 12, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left' }}>
          <ShieldAlert size={14} /> {error}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16, textAlign: 'left' }}>
        <div>
          <label style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, display: 'block', fontWeight: 600 }}>ADMIN EMAIL</label>
          <input 
            type="email" 
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="admin@denguewatch.gov"
            required
            autoFocus
            style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
          />
        </div>
        <div>
          <label style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, display: 'block', fontWeight: 600 }}>PASSWORD</label>
          <input 
            type="password" 
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
          />
        </div>
        <button 
          type="submit" 
          className="btn btn-primary" 
          disabled={loading}
          style={{ marginTop: 8, padding: 12, display: 'flex', justifyContent: 'center', gap: 8, fontWeight: 600 }}
        >
          {loading ? <span className="spinner" style={{ width: 14, height: 14 }} /> : <LogIn size={16} />}
          Sign In as Admin
        </button>
      </form>
    </div>
  )

  if (onClose) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.65)',
          backdropFilter: 'blur(5px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
        }}
        onClick={onClose}
      >
        {content}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-main)', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      {content}
    </div>
  )
}
