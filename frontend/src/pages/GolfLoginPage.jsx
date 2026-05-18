import { useState } from 'react'
import { login, setToken } from '../api/golfApi'

export default function GolfLoginPage({ onLogin }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showReset, setShowReset] = useState(false)
  const [resetUsername, setResetUsername] = useState('')
  const [resetMsg, setResetMsg] = useState('')
  const [resetSending, setResetSending] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await login(username, password)
      setToken(data.token)
      onLogin({ id: data.id, username: data.username, role: data.role, force_password_reset: data.force_password_reset })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleResetRequest(e) {
    e.preventDefault()
    setResetMsg('')
    setResetSending(true)
    try {
      const res = await fetch('/api/golf/request-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: resetUsername }),
      })
      const data = await res.json()
      setResetMsg(data.message || 'Request submitted.')
      setResetUsername('')
    } catch (err) {
      setResetMsg('Something went wrong. Please try again.')
    } finally {
      setResetSending(false)
    }
  }

  return (
    <div className="golf-auth-page">
      <div className="golf-auth-card">
        <h1>⛳ WAGL Login</h1>

        {!showReset ? (
          <>
            <form onSubmit={handleSubmit} className="golf-form">
              <label htmlFor="login-username">Username</label>
              <input
                id="login-username"
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Enter username"
                required
              />
              <label htmlFor="login-password">Password</label>
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter password"
                required
              />
              {error && <p className="golf-error">{error}</p>}
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Logging in…' : 'Login'}
              </button>
            </form>
            <p className="golf-auth-link">
              <a href="#" onClick={e => { e.preventDefault(); setShowReset(true) }}>Forgot Password?</a>
            </p>
            <p className="golf-auth-link">
              Don't have an account? <a href="#/golf/register">Register</a>
            </p>
          </>
        ) : (
          <>
            <p style={{ marginBottom: 12, fontSize: '0.9rem', color: 'var(--text-muted)' }}>
              Enter your username and the league admin will be notified to reset your password.
            </p>
            <form onSubmit={handleResetRequest} className="golf-form">
              <label htmlFor="reset-username">Username</label>
              <input
                id="reset-username"
                type="text"
                value={resetUsername}
                onChange={e => setResetUsername(e.target.value)}
                placeholder="Enter your username"
                required
              />
              {resetMsg && <p className={resetMsg.includes('notified') ? 'golf-success' : 'golf-error'}>{resetMsg}</p>}
              <button type="submit" className="btn btn-primary" disabled={resetSending}>
                {resetSending ? 'Sending…' : 'Request Password Reset'}
              </button>
            </form>
            <p className="golf-auth-link">
              <a href="#" onClick={e => { e.preventDefault(); setShowReset(false) }}>← Back to Login</a>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
