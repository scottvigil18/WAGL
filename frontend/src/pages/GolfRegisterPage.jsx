import { useState } from 'react'
import { register, login, setToken } from '../api/golfApi'

export default function GolfRegisterPage({ onLogin }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)
    try {
      await register(username, password)
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
        <h1>⛳ Golf League Register</h1>
        <form onSubmit={handleSubmit} className="golf-form">
          <label htmlFor="reg-username">Username</label>
          <input
            id="reg-username"
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value)}
            placeholder="Choose a username (min 3 chars)"
            required
            minLength={3}
          />
          <label htmlFor="reg-password">Password</label>
          <input
            id="reg-password"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Choose a password (min 6 chars)"
            required
            minLength={6}
          />
          <label htmlFor="reg-confirm">Confirm Password</label>
          <input
            id="reg-confirm"
            type="password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            placeholder="Confirm your password"
            required
          />
          {error && <p className="golf-error">{error}</p>}
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Registering…' : 'Register'}
          </button>
        </form>
        <p className="golf-auth-link">
          Already have an account? <a href="#/golf/login">Login</a>
        </p>
      </div>
    </div>
  )
}
