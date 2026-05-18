import { useState, useEffect } from 'react'
import { getMyNotifications, markNotificationRead, deleteNotification, sendMessageToAdmin } from '../api/golfApi'

export default function GolfNotificationsPage() {
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expandedId, setExpandedId] = useState(null)
  const [replyId, setReplyId] = useState(null)
  const [replyBody, setReplyBody] = useState('')
  const [replySending, setReplySending] = useState(false)
  const [replyMsg, setReplyMsg] = useState('')

  useEffect(() => {
    async function load() {
      try { setNotifications(await getMyNotifications()) }
      catch (e) { setError(e.message) }
      finally { setLoading(false) }
    }
    load()
  }, [])

  function toggleExpand(notif) {
    if (expandedId === notif.id) {
      setExpandedId(null)
    } else {
      setExpandedId(notif.id)
      if (!notif.read) {
        markNotificationRead(notif.id).then(() => {
          window.dispatchEvent(new Event('notifications-updated'))
        }).catch(() => {})
        setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: 1 } : n))
      }
    }
  }

  async function handleDelete(id) {
    try {
      await deleteNotification(id)
      setNotifications(prev => prev.filter(n => n.id !== id))
      setExpandedId(null)
      window.dispatchEvent(new Event('notifications-updated'))
    } catch (e) { /* ignore */ }
  }

  function startReply(notif) {
    setReplyId(notif.id)
    setReplyBody('')
    setReplyMsg('')
  }

  async function handleReply(notif) {
    if (!replyBody.trim()) return
    setReplySending(true)
    setReplyMsg('')
    try {
      await sendMessageToAdmin(`Re: ${notif.subject}`, replyBody)
      setReplyMsg('Reply sent!')
      setReplyBody('')
      setReplyId(null)
    } catch (e) { setReplyMsg(e.message) }
    finally { setReplySending(false) }
  }

  if (loading) return <div className="golf-page"><p className="golf-loading">Loading notifications…</p></div>
  if (error) return <div className="golf-page"><p className="golf-error">{error}</p></div>

  return (
    <div className="golf-page golf-page-wide">
      <h2>🔔 Notifications</h2>
      {notifications.length === 0 ? (
        <p className="golf-empty">No notifications.</p>
      ) : (
        <div className="messages-list">
          {notifications.map(notif => (
            <div key={notif.id} className={`message-item${!notif.read ? ' unread' : ''}`}>
              <div className="message-header" onClick={() => toggleExpand(notif)}>
                <span className="message-from">📢 Admin</span>
                <span className="message-subject">{notif.subject}</span>
                <span className="message-date">{notif.created_at ? notif.created_at.slice(0, 16).replace('T', ' ') : ''}</span>
                {!notif.read && <span className="message-unread-dot" />}
              </div>
              {expandedId === notif.id && (
                <div className="message-body-section">
                  <p className="message-body-text">{notif.body}</p>
                  {replyId === notif.id ? (
                    <div className="notif-reply-form">
                      <textarea
                        value={replyBody}
                        onChange={e => setReplyBody(e.target.value)}
                        placeholder="Type your reply to admin…"
                        rows={3}
                        className="notif-reply-textarea"
                      />
                      <div className="message-actions">
                        <button className="btn btn-small btn-primary" onClick={() => handleReply(notif)} disabled={replySending}>
                          {replySending ? 'Sending…' : 'Send Reply'}
                        </button>
                        <button className="btn btn-small btn-secondary" onClick={() => setReplyId(null)}>Cancel</button>
                      </div>
                      {replyMsg && <p className={replyMsg.includes('sent') ? 'golf-success' : 'golf-error'} style={{ marginTop: 6 }}>{replyMsg}</p>}
                    </div>
                  ) : (
                    <div className="message-actions">
                      <button className="btn btn-small btn-primary" onClick={() => startReply(notif)}>↩️ Reply</button>
                      {notif.read === 1 && (
                        <button className="btn btn-small btn-danger" onClick={() => handleDelete(notif.id)}>Delete</button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
