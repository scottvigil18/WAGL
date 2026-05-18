import { useState, useEffect } from 'react'
import { getPlayerProfile, getUser } from '../api/golfApi'
import { formatPhoneDisplay } from '../utils/formatPhone'
import PhotoGallery from '../components/PhotoGallery'

export default function GolfPlayerProfilePage({ playerId }) {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const currentUser = getUser()

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError('')
      try {
        setProfile(await getPlayerProfile(playerId))
      } catch (e) { setError(e.message) }
      finally { setLoading(false) }
    }
    load()
  }, [playerId])

  if (loading) return <div className="golf-page"><p className="golf-loading">Loading player profile…</p></div>
  if (error) return <div className="golf-page"><p className="golf-error">{error}</p></div>
  if (!profile) return <div className="golf-page"><p className="golf-empty">Player not found.</p></div>

  return (
    <div className="golf-page golf-page-wide">
      <div className="score-header">
        <div className="score-header-avatar">
          {profile.avatar ? (
            <img src={profile.avatar} alt="Avatar" className="score-avatar-img" />
          ) : (
            <span className="score-avatar-default">{(profile.first_name || profile.username || '?')[0].toUpperCase()}</span>
          )}
        </div>
        <h2>{profile.first_name || profile.username} {profile.last_name || ''}</h2>
      </div>
      <div className="profile-card">
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
            <span className="profile-value">{profile.handicap_index != null ? profile.handicap_index.toFixed(1) : '—'}</span>
          </div>
          <div className="profile-field">
            <span className="profile-label">Scores Submitted</span>
            <span className="profile-value">{profile.score_count}</span>
          </div>
          <div className="profile-field">
            <span className="profile-label">Member Since</span>
            <span className="profile-value">{profile.created_at ? profile.created_at.slice(0, 10) : '—'}</span>
          </div>
        </div>
        <a href="#/golf/leaderboard" className="btn btn-secondary">← Back to Leaderboard</a>
      </div>

      <PhotoGallery playerId={playerId} canUpload={false} />
    </div>
  )
}
