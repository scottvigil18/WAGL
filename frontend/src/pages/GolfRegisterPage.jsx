import { useState } from 'react'
import { register, login, setToken, checkUsername } from '../api/golfApi'
import { formatPhoneInput } from '../utils/formatPhone'

export default function GolfRegisterPage({ onLogin }) {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [username, setUsername] = useState('')
  const [usernameStatus, setUsernameStatus] = useState('') // '', 'checking', 'taken', 'available'
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleUsernameBlur() {
    if (!username || username.trim().length < 3) {
      setUsernameStatus('')
      return
    }
    setUsernameStatus('checking')
    try {
      const result = await checkUsername(username.trim())
      if (result.available) {
        setUsernameStatus('available')
      } else {
        setUsernameStatus('taken')
        setUsername('')
        setError('Username is already taken. Please choose another.')
      }
    } catch {
      setUsernameStatus('')
    }
  }

  const [registered, setRegistered] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)
    try {
      await register(username, password, email, phone, firstName, lastName)
      setRegistered(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="golf-auth-page">
      <div className="golf-auth-card">
        <h1>⛳ WAGL Register</h1>
        {registered ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <p className="golf-success" style={{ fontSize: '1.1rem', marginBottom: 12 }}>✅ Registration submitted!</p>
            <p style={{ color: 'var(--text-muted)' }}>Your account is pending admin approval. You'll be able to log in once approved.</p>
            <a href="#/golf/login" className="btn btn-primary" style={{ marginTop: 16, display: 'inline-block' }}>Back to Login</a>
          </div>
        ) : (
        <>
        <form onSubmit={handleSubmit} className="golf-form">
          <label htmlFor="reg-firstname">First Name</label>
          <input
            id="reg-firstname"
            type="text"
            value={firstName}
            onChange={e => setFirstName(e.target.value)}
            placeholder="First name"
            required
          />
          <label htmlFor="reg-lastname">Last Name</label>
          <input
            id="reg-lastname"
            type="text"
            value={lastName}
            onChange={e => setLastName(e.target.value)}
            placeholder="Last name"
            required
          />
          <label htmlFor="reg-username">Username</label>
          <input
            id="reg-username"
            type="text"
            value={username}
            onChange={e => { setUsername(e.target.value); setUsernameStatus(''); setError('') }}
            onBlur={handleUsernameBlur}
            placeholder="Choose a username (min 3 chars)"
            required
            minLength={3}
          />
          {usernameStatus === 'checking' && <p className="golf-loading" style={{margin: '2px 0', fontSize: '0.8rem'}}>Checking availability…</p>}
          {usernameStatus === 'available' && <p className="golf-success" style={{margin: '2px 0', fontSize: '0.8rem'}}>✓ Username available</p>}
          {usernameStatus === 'taken' && <p className="golf-error" style={{margin: '2px 0', fontSize: '0.8rem'}}>✗ Username taken</p>}
          <label htmlFor="reg-email">Email</label>
          <input
            id="reg-email"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="your@email.com"
            required
          />
          <label htmlFor="reg-phone">Phone Number</label>
          <input
            id="reg-phone"
            type="tel"
            value={phone}
            onChange={e => setPhone(formatPhoneInput(e.target.value))}
            placeholder="xxx-xxx-xxxx"
            required
            maxLength={12}
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
        </>
        )}
      </div>
    </div>
  )
}
