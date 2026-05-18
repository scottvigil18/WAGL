import { useState, useEffect, useRef } from 'react'
import { getMyProfile, updateMyProfile, uploadAvatar, sendMessageToAdmin, changeMyPassword } from '../api/golfApi'
import { formatPhoneInput, formatPhoneDisplay } from '../utils/formatPhone'
import PhotoGallery from '../components/PhotoGallery'
import ContactAdminForm from '../components/ContactAdminForm'

export default function GolfProfilePage() {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)
  const [fields, setFields] = useState({})
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef()

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
      setProfile(prev => ({ ...prev, ...updated }))
      setEditing(false)
      setMsg('Profile updated successfully.')
    } catch (e) { setMsg(e.message) }
    finally { setSaving(false) }
  }

  async function handleAvatarChange(e) {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    setMsg('')
    try {
      const result = await uploadAvatar(file)
      // Add cache-buster to force browser to reload the image
      const avatarUrl = result.avatar + '?t=' + Date.now()
      setProfile(prev => ({ ...prev, avatar: avatarUrl }))
      setMsg('Avatar updated.')
    } catch (e) { setMsg(e.message) }
    finally { setUploading(false) }
  }

  if (loading) return <div className="golf-page"><p className="golf-loading">Loading profile…</p></div>
  if (error) return <div className="golf-page"><p className="golf-error">{error}</p></div>

  return (
    <div className="golf-page golf-page-wide">
      <div className="score-header">
        <div className="score-header-avatar">
          {profile?.avatar ? (
            <img src={profile.avatar} alt="Avatar" className="score-avatar-img" />
          ) : (
            <span className="score-avatar-default">👤</span>
          )}
        </div>
        <h2>My Profile</h2>
      </div>
      <ProfileTabs profile={profile} setProfile={setProfile} editing={editing} setEditing={setEditing}
        fields={fields} setFields={setFields} saving={saving} setSaving={setSaving} msg={msg} setMsg={setMsg}
        uploading={uploading} setUploading={setUploading} fileRef={fileRef}
        startEdit={startEdit} handleSave={handleSave} handleAvatarChange={handleAvatarChange} />
    </div>
  )
}

function ProfileTabs({ profile, setProfile, editing, setEditing, fields, setFields, saving, setSaving, msg, setMsg, uploading, setUploading, fileRef, startEdit, handleSave, handleAvatarChange }) {
  const [activeTab, setActiveTab] = useState('Profile')
  const tabs = profile.role !== 'admin'
    ? ['Profile', 'Change Password', 'Contact Admin']
    : ['Profile', 'Change Password']

  return (
    <>
      <div className="leaderboard-tabs">
        {tabs.map(tab => (
          <button
            key={tab}
            className={`leaderboard-tab-btn${activeTab === tab ? ' active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>
      <div className="leaderboard-tab-content">
        {activeTab === 'Profile' && (
          <ProfileContent profile={profile} setProfile={setProfile} editing={editing} setEditing={setEditing}
            fields={fields} setFields={setFields} saving={saving} setSaving={setSaving} msg={msg} setMsg={setMsg}
            uploading={uploading} setUploading={setUploading} fileRef={fileRef}
            startEdit={startEdit} handleSave={handleSave} handleAvatarChange={handleAvatarChange} />
        )}
        {activeTab === 'Change Password' && <ChangePasswordForm />}
        {activeTab === 'Contact Admin' && <ContactAdminForm />}
      </div>
    </>
  )
}

function ChangePasswordForm() {
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [saving, setSaving] = useState(false)
  const [pwMsg, setPwMsg] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setPwMsg('')
    if (newPw !== confirmPw) {
      setPwMsg('New passwords do not match')
      return
    }
    setSaving(true)
    try {
      await changeMyPassword(currentPw, newPw)
      setPwMsg('Password changed successfully!')
      setCurrentPw('')
      setNewPw('')
      setConfirmPw('')
    } catch (err) { setPwMsg(err.message) }
    finally { setSaving(false) }
  }

  return (
    <div className="profile-card" style={{ maxWidth: 400 }}>
      <h3 style={{ color: '#166534', marginBottom: 16 }}>🔒 Change Password</h3>
      <form onSubmit={handleSubmit} className="golf-form">
        <label htmlFor="pw-current">Current Password</label>
        <input
          id="pw-current"
          type="password"
          value={currentPw}
          onChange={ev => setCurrentPw(ev.target.value)}
          required
          placeholder="Enter current password"
        />
        <label htmlFor="pw-new">New Password</label>
        <input
          id="pw-new"
          type="password"
          value={newPw}
          onChange={ev => setNewPw(ev.target.value)}
          required
          minLength={6}
          placeholder="Min 6 characters"
        />
        <label htmlFor="pw-confirm">Confirm New Password</label>
        <input
          id="pw-confirm"
          type="password"
          value={confirmPw}
          onChange={ev => setConfirmPw(ev.target.value)}
          required
          placeholder="Re-enter new password"
        />
        {pwMsg && <p className={pwMsg.includes('success') ? 'golf-success' : 'golf-error'}>{pwMsg}</p>}
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Changing…' : 'Change Password'}
        </button>
      </form>
    </div>
  )
}

function ProfileContent({ profile, setProfile, editing, setEditing, fields, setFields, saving, setSaving, msg, setMsg, uploading, setUploading, fileRef, startEdit, handleSave, handleAvatarChange }) {
  const localFileRef = useRef()

  function handleUploadClick() {
    localFileRef.current?.click()
  }

  function handleFileChange(e) {
    handleAvatarChange(e)
    // Reset the input so the same file can be re-selected
    if (localFileRef.current) localFileRef.current.value = ''
  }

  return (
    <div className="profile-layout">
      <div className="profile-layout-left">
        <div className="profile-card">
          <div className="profile-avatar-section">
            <div className="profile-avatar">
              {profile.avatar ? (
                <img src={profile.avatar} alt="Avatar" className="profile-avatar-img" />
              ) : (
                <div className="profile-avatar-placeholder">
                  {(profile.first_name || profile.username || '?')[0].toUpperCase()}
                </div>
              )}
            </div>
            <div className="profile-avatar-upload">
              <input
                ref={localFileRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
              <button
                className="btn btn-small btn-primary"
                onClick={handleUploadClick}
                disabled={uploading}
                type="button"
              >
                {uploading ? 'Uploading…' : '📷 Upload Avatar'}
              </button>
              <span className="profile-avatar-hint">JPG, PNG, GIF — max 2 MB</span>
            </div>
          </div>

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
                <span className="profile-label">Handicap Index</span>
                <span className="profile-value profile-handicap">
                  {profile.handicap_index != null ? profile.handicap_index.toFixed(1) : '—'}
                </span>
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

      {profile && (
        <div className="profile-layout-right">
          <PhotoGallery playerId={profile.id} canUpload={false} />
        </div>
      )}
    </div>
  )
}
