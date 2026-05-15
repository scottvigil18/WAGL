import { useState, useEffect } from 'react'
import { getMyProfile, updateMyProfile } from '../api/golfApi'
import { formatPhoneInput, formatPhoneDisplay } from '../utils/formatPhone'

export default function GolfProfilePage() {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)
  const [fields, setFields] = useState({})
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const data = await getMyProfile()
        setProfile(data)
      } catch (e) { setError(e.message) }
      finally { setLoading(false) }
    }
    load()
  }, [])

  function startEdit() {
    setFields({
      first_name: profile.first_name || '',
      last_name: profile.last_name || '',
      username: profile.username || '',
      email: profile.email || '',
      phone: formatPhoneInput(profile.phone || ''),
    })
    setEditing(true)
    setMsg('')
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setMsg('')
    try {
      const updated = await updateMyProfile(fields)
      setProfile(updated)
      setEditing(false)
      setMsg('Profile updated successfully.')
    } catch (e) { setMsg(e.message) }
    finally { setSaving(false) }
  }

  if (loading) return <div className="golf-page"><p className="golf-loading">Loading profile…</p></div>
  if (error) return <div className="golf-page"><p className="golf-error">{error}</p></div>

  return (
    <div className="golf-page">
      <h2>👤 My Profile</h2>
      <div className="profile-card">
        {!editing ? (
          <>
            <div className="profile-grid">
              <div className="profile-field">
                <span className="profile-label">First Name</span>
                <span className="profile-value">{profile.first_name || '—'}</span>
              </div>
              <div className="profile-field">
                <span className="profile-label">Last Name</span>
                <span className="profile-value">{profile.last_name || '—'}</span>
              </div>
              <div className="profile-field">
                <span className="profile-label">Username</span>
                <span className="profile-value">{profile.username}</span>
              </div>
              <div className="profile-field">
                <span className="profile-label">Email</span>
                <span className="profile-value">{profile.email || '—'}</span>
              </div>
              <div className="profile-field">
                <span className="profile-label">Phone</span>
                <span className="profile-value">{formatPhoneDisplay(profile.phone)}</span>
              </div>
              <div className="profile-field">
                <span className="profile-label">Member Since</span>
                <span className="profile-value">{profile.created_at ? profile.created_at.slice(0, 10) : '—'}</span>
              </div>
            </div>
            {msg && <p className="golf-success">{msg}</p>}
            <button className="btn btn-primary" onClick={startEdit}>Edit Profile</button>
          </>
        ) : (
          <form onSubmit={handleSave} className="golf-form">
            <label htmlFor="profile-firstname">First Name</label>
            <input
              id="profile-firstname"
              type="text"
              value={fields.first_name}
              onChange={e => setFields(f => ({ ...f, first_name: e.target.value }))}
              required
            />
            <label htmlFor="profile-lastname">Last Name</label>
            <input
              id="profile-lastname"
              type="text"
              value={fields.last_name}
              onChange={e => setFields(f => ({ ...f, last_name: e.target.value }))}
              required
            />
            <label htmlFor="profile-username">Username</label>
            <input
              id="profile-username"
              type="text"
              value={fields.username}
              onChange={e => setFields(f => ({ ...f, username: e.target.value }))}
              required
              minLength={3}
            />
            <label htmlFor="profile-email">Email</label>
            <input
              id="profile-email"
              type="email"
              value={fields.email}
              onChange={e => setFields(f => ({ ...f, email: e.target.value }))}
              required
            />
            <label htmlFor="profile-phone">Phone</label>
            <input
              id="profile-phone"
              type="tel"
              value={fields.phone}
              onChange={e => setFields(f => ({ ...f, phone: formatPhoneInput(e.target.value) }))}
              required
              maxLength={12}
              placeholder="xxx-xxx-xxxx"
            />
            {msg && <p className="golf-error">{msg}</p>}
            <div className="profile-form-actions">
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setEditing(false)}>
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
