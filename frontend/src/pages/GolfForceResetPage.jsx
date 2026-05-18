import { useState } from 'react'
import { changeMyPassword } from '../api/golfApi'

export default function GolfForceResetPage({ onComplete }) {
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (newPw !== confirmPw) {
      setError('New passwords do not match')
      return
    }
    setSaving(true)
    try {
      await changeMyPassword(currentPw, newPw)
      if (onComplete) onComplete()
    } catch (err) { setError(err.message) }
    finally { setSaving(false) }
  }

  return (
    <div className="golf-auth-page">
      <div className="golf-auth-card">
        <h1>🔒 Password Reset Required</h1>
        <p style={{ marginBottom: 16, color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          Your administrator has required you to set a new password before continuing.
        </p>
        <form onSubmit={handleSubmit} className="golf-form">
          <label htmlFor="fr-current">Current Password</label>
          <input
            id="fr-current"
            type="password"
            value={currentPw}
            onChange={e => setCurrentPw(e.target.value)}
            required
            placeholder="Enter your current password"
          />
          <label htmlFor="fr-new">New Password</label>
          <input
            id="fr-new"
            type="password"
            value={newPw}
            onChange={e => setNewPw(e.target.value)}
            required
            minLength={6}
            placeholder="Min 6 characters"
          />
          <label htmlFor="fr-confirm">Confirm New Password</label>
          <input
            id="fr-confirm"
            type="password"
            value={confirmPw}
            onChange={e => setConfirmPw(e.target.value)}
            required
            placeholder="Re-enter new password"
          />
          {error && <p className="golf-error">{error}</p>}
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Set New Password'}
          </button>
        </form>
      </div>
    </div>
  )
}
