import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { ShieldAlert, LogIn, Bug } from 'lucide-react'

export default function Login() {
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
    } catch (err) {
      setError('Invalid credentials or server error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-main)', alignItems: 'center', justifyContent: 'center' }}>
      <div className="card" style={{ padding: 40, width: 400, maxWidth: '90%', textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
          <div style={{ background: 'rgba(59,130,246,0.1)', padding: 16, borderRadius: '50%' }}>
            <Bug size={32} style={{ color: 'var(--accent-blue)' }} />
          </div>
        </div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 24, marginBottom: 8 }}>
          DengueWatch
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 32 }}>
          Sign in to access the outbreak forecasting system.
        </p>

        {error && (
          <div style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--accent-red)', padding: '10px 14px', borderRadius: 8, fontSize: 12, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShieldAlert size={14} /> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16, textAlign: 'left' }}>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, display: 'block' }}>EMAIL</label>
            <input 
              type="email" 
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
            />
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, display: 'block' }}>PASSWORD</label>
            <input 
              type="password" 
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
            />
          </div>
          <button 
            type="submit" 
            className="btn btn-primary" 
            disabled={loading}
            style={{ marginTop: 8, padding: 12, display: 'flex', justifyContent: 'center', gap: 8 }}
          >
            {loading ? <span className="spinner" style={{ width: 14, height: 14 }} /> : <LogIn size={16} />}
            Sign In
          </button>
        </form>

        <div style={{ marginTop: 24, paddingTop: 24, borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--text-muted)' }}>
          <p>Demo accounts:</p>
          <p style={{ fontFamily: 'var(--font-mono)' }}>admin@denguewatch.gov / admin123</p>
          <p style={{ fontFamily: 'var(--font-mono)' }}>officer@denguewatch.gov / officer123</p>
        </div>
      </div>
    </div>
  )
}
