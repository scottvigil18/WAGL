import { useState, useEffect, useRef } from 'react'
import { getAllPhotos, uploadPhoto, deletePhoto, approvePhoto, rejectPhoto, getUser } from '../api/golfApi'

export default function GolfPhotosPage() {
  const [photos, setPhotos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [caption, setCaption] = useState('')
  const [msg, setMsg] = useState('')
  const [lightbox, setLightbox] = useState(null)
  const [selectedFile, setSelectedFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const fileRef = useRef()
  const currentUser = getUser()

  useEffect(() => { loadPhotos() }, [])

  async function loadPhotos() {
    setLoading(true)
    setError('')
    try {
      setPhotos(await getAllPhotos())
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  function handleFileSelect(e) {
    const file = e.target.files[0]
    if (!file) return
    setSelectedFile(file)
    setPreviewUrl(URL.createObjectURL(file))
    setMsg('')
  }

  function cancelUpload() {
    setSelectedFile(null)
    setPreviewUrl(null)
    setCaption('')
    if (fileRef.current) fileRef.current.value = ''
  }

  async function handleSubmitPhoto() {
    if (!selectedFile) return
    setUploading(true)
    setMsg('')
    try {
      const photo = await uploadPhoto(selectedFile, caption)
      setPhotos(prev => [{ ...photo, username: currentUser?.username, first_name: '', last_name: '' }, ...prev])
      setCaption('')
      setSelectedFile(null)
      setPreviewUrl(null)
      if (fileRef.current) fileRef.current.value = ''
      setMsg('Photo uploaded! Awaiting admin approval.')
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

  async function handleApprove(photoId) {
    try {
      await approvePhoto(photoId)
      setPhotos(prev => prev.map(p => p.id === photoId ? { ...p, approved: 1 } : p))
      window.dispatchEvent(new Event('photos-updated'))
    } catch (e) { setMsg(e.message) }
  }

  async function handleReject(photoId) {
    if (!confirm('Reject and delete this photo?')) return
    try {
      await rejectPhoto(photoId)
      setPhotos(prev => prev.filter(p => p.id !== photoId))
      window.dispatchEvent(new Event('photos-updated'))
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

  return (
    <div className="golf-page golf-page-wide">
      <h2>📸 Photos</h2>

      <div className="photo-upload-section">
        {!selectedFile ? (
          <div className="photo-upload-row">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="csv-file-input"
            />
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Select a photo to share</span>
          </div>
        ) : (
          <div className="photo-preview-section">
            <div className="photo-preview-card">
              <img src={previewUrl} alt="Preview" className="photo-preview-img" />
              <div className="photo-preview-form">
                <input
                  type="text"
                  value={caption}
                  onChange={e => setCaption(e.target.value)}
                  placeholder="Add a caption…"
                  className="admin-inline-input"
                />
                <div className="photo-preview-actions">
                  <button className="btn btn-primary" onClick={handleSubmitPhoto} disabled={uploading}>
                    {uploading ? 'Uploading…' : '📤 Post Photo'}
                  </button>
                  <button className="btn btn-secondary" onClick={cancelUpload} disabled={uploading}>
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {msg && <p className={msg.includes('uploaded') ? 'golf-success' : 'golf-error'}>{msg}</p>}
      {error && <p className="golf-error">{error}</p>}

      {loading ? (
        <p className="golf-loading">Loading photos…</p>
      ) : (
        <>
          {/* Admin: Pending approval section */}
          {currentUser?.role === 'admin' && photos.filter(p => !p.approved).length > 0 && (
            <div className="pending-photos-section">
              <h3>⚠️ Pending Approval ({photos.filter(p => !p.approved).length})</h3>
              <div className="photo-grid">
                {photos.filter(p => !p.approved).map(photo => (
                  <div key={photo.id} className="photo-card photo-pending">
                    <img src={photo.url} alt={photo.caption || 'Photo'} className="photo-img photo-clickable" onClick={() => setLightbox(photo)} />
                    <div className="photo-meta">
                      <span className="photo-author">{photo.first_name || photo.username}</span>
                      {photo.caption && <p className="photo-caption">{photo.caption}</p>}
                      <div className="photo-approval-actions">
                        <button className="btn btn-small btn-primary" onClick={() => handleApprove(photo.id)}>✓ Approve</button>
                        <button className="btn btn-small btn-danger" onClick={() => handleReject(photo.id)}>✕ Reject</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Approved photos feed */}
          {photos.filter(p => p.approved).length === 0 && photos.filter(p => !p.approved && p.player_id === currentUser?.id).length === 0 ? (
            <p className="golf-empty">No photos yet. Be the first to share!</p>
          ) : (
            <div className="photo-grid">
              {photos.filter(p => p.approved || (p.player_id === currentUser?.id && !p.approved)).map(photo => (
                <div key={photo.id} className={`photo-card${!photo.approved ? ' photo-pending' : ''}`}>
                  <img src={photo.url} alt={photo.caption || 'Photo'} className="photo-img photo-clickable" onClick={() => setLightbox(photo)} />
                  <div className="photo-meta">
                    <span className="photo-author">{photo.first_name || photo.username}</span>
                    {photo.caption && <p className="photo-caption">{photo.caption}</p>}
                    {!photo.approved && <span className="photo-pending-badge">Pending</span>}
                    <span className="photo-expires">{daysRemaining(photo.expires_at)}d</span>
                    {canDeletePhoto(photo) && (
                      <button className="btn btn-small btn-danger" onClick={() => handleDelete(photo.id)}>✕</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Lightbox modal */}
      {lightbox && (
        <div className="lightbox-overlay" onClick={() => setLightbox(null)}>
          <div className="lightbox-content" onClick={e => e.stopPropagation()}>
            <button className="lightbox-close" onClick={() => setLightbox(null)}>✕</button>
            <img src={lightbox.url} alt={lightbox.caption || 'Photo'} className="lightbox-img" />
            {lightbox.caption && <p className="lightbox-caption">{lightbox.caption}</p>}
            <p className="lightbox-author">By {lightbox.first_name || lightbox.username}</p>
          </div>
        </div>
      )}
    </div>
  )
}
