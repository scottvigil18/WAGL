import { useState } from 'react'
import { login, setToken } from '../api/golfApi'

export default function GolfLoginPage({ onLogin }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await login(username, password)
      setToken(data.token)
      onLogin({ id: data.id, username: data.username, role: data.role })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="golf-auth-page">
      <div className="golf-auth-card">
        <h1>⛳ WAGL Login</h1>
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
          Don't have an account? <a href="#/golf/register">Register</a>
        </p>
      </div>
    </div>
  )
}
