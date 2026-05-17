import { useState, useEffect, useRef } from 'react'
import { getPlayerPhotos, uploadPhoto, deletePhoto, getUser } from '../api/golfApi'

export default function PhotoGallery({ playerId, canUpload }) {
  const [photos, setPhotos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [caption, setCaption] = useState('')
  const [msg, setMsg] = useState('')
  const fileRef = useRef()
  const currentUser = getUser()

  useEffect(() => {
    loadPhotos()
  }, [playerId])

  async function loadPhotos() {
    setLoading(true)
    setError('')
    try {
      setPhotos(await getPlayerPhotos(playerId))
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  async function handleUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    setMsg('')
    try {
      const photo = await uploadPhoto(file, caption)
      setPhotos(prev => [photo, ...prev])
      setCaption('')
      if (fileRef.current) fileRef.current.value = ''
      setMsg('Photo uploaded!')
    } catch (e) { setMsg(e.message) }
    finally { setUploading(false) }
  }

  async function handleDelete(photoId) {
    if (!confirm('Delete this photo?')) return
    try {
      await deletePhoto(photoId)
      setPhotos(prev => prev.filter(p => p.id !== photoId))
    } catch (e) { setMsg(e.message) }
  }

  function canDeletePhoto(photo) {
    if (!currentUser) return false
    return currentUser.id === photo.player_id || currentUser.role === 'admin'
  }

  function daysRemaining(expiresAt) {
    const diff = new Date(expiresAt) - new Date()
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
  }

  if (loading) return <p className="golf-loading">Loading photos…</p>

  return (
    <div className="photo-gallery-section">
      <h3>📸 Photos</h3>

      {canUpload && (
        <div className="photo-upload-row">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={handleUpload}
            className="csv-file-input"
            disabled={uploading}
          />
          <input
            type="text"
            value={caption}
            onChange={e => setCaption(e.target.value)}
            placeholder="Caption (optional)"
            className="admin-inline-input"
            style={{ maxWidth: 200 }}
          />
          {uploading && <span className="golf-loading">Uploading…</span>}
        </div>
      )}

      {msg && <p className={msg.includes('uploaded') ? 'golf-success' : 'golf-error'}>{msg}</p>}
      {error && <p className="golf-error">{error}</p>}

      {photos.length === 0 ? (
        <p className="golf-empty">No photos yet.</p>
      ) : (
        <div className="photo-grid">
          {photos.map(photo => (
            <div key={photo.id} className="photo-card">
              <img src={photo.url} alt={photo.caption || 'Photo'} className="photo-img" />
              <div className="photo-meta">
                {photo.caption && <p className="photo-caption">{photo.caption}</p>}
                <span className="photo-expires">{daysRemaining(photo.expires_at)}d left</span>
                {canDeletePhoto(photo) && (
                  <button className="btn btn-small btn-danger" onClick={() => handleDelete(photo.id)}>Delete</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
