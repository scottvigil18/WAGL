import { clearToken, getPendingPhotoCount, adminGetUnreadCount, getUnreadNotificationCount, getUser } from '../api/golfApi'
import { useState, useEffect } from 'react'

export default function GolfNav({ user, onLogout }) {
  const hash = window.location.hash || '#/'
  const [pendingCount, setPendingCount] = useState(0)
  const [unreadMsgCount, setUnreadMsgCount] = useState(0)
  const [notifCount, setNotifCount] = useState(0)

  useEffect(() => {
    if (user?.role === 'admin') {
      const fetchCounts = () => {
        getPendingPhotoCount().then(d => setPendingCount(d.count)).catch(() => {})
        adminGetUnreadCount().then(d => setUnreadMsgCount(d.count)).catch(() => {})
      }
      fetchCounts()
      const interval = setInterval(fetchCounts, 30000)
      const handler = () => fetchCounts()
      window.addEventListener('photos-updated', handler)
      window.addEventListener('messages-updated', handler)
      return () => { clearInterval(interval); window.removeEventListener('photos-updated', handler); window.removeEventListener('messages-updated', handler) }
    } else if (user) {
      // Player: check for notifications
      const fetchNotifs = () => getUnreadNotificationCount().then(d => setNotifCount(d.count)).catch(() => {})
      fetchNotifs()
      const interval = setInterval(fetchNotifs, 30000)
      const handler = () => fetchNotifs()
      window.addEventListener('notifications-updated', handler)
      return () => { clearInterval(interval); window.removeEventListener('notifications-updated', handler) }
    }
  }, [user])

  function handleLogout() {
    clearToken()
    if (onLogout) onLogout()
    window.location.hash = '#/golf/splash'
  }

  return (
    <header className="golf-navbar">
      <div className="golf-nav-container">
        <a href="#/golf/leaderboard" className="golf-logo">⛳ Golf League</a>
        <nav className="golf-nav-links">
          {user?.role === 'admin' && (
            <a href="#/golf/admin" className={hash === '#/golf/admin' ? 'active' : ''}>
              Admin
            </a>
          )}
          {user?.role === 'admin' && pendingCount > 0 && (
            <a href="#/golf/photos" className="nav-notification-link">
              <span className="nav-badge">{pendingCount}</span> Photos
            </a>
          )}
          {user?.role === 'admin' && unreadMsgCount > 0 && (
            <a href="#/golf/admin" className="nav-notification-link" onClick={() => setTimeout(() => window.dispatchEvent(new Event('messages-updated')), 100)}>
              <span className="nav-badge">{unreadMsgCount}</span> Messages
            </a>
          )}
          <a href="#/golf/leaderboard" className={hash === '#/golf/leaderboard' ? 'active' : ''}>
            Leaderboard
          </a>
          {user?.role !== 'admin' && (
            <a href="#/golf/scores" className={hash === '#/golf/scores' ? 'active' : ''}>
              Submit Score
            </a>
          )}
          {user?.role !== 'admin' && (
            <a href="#/golf/history" className={hash === '#/golf/history' ? 'active' : ''}>
              My History
            </a>
          )}
          <a href="#/golf/schedule" className={hash === '#/golf/schedule' ? 'active' : ''}>
            Schedule
          </a>
          <a href="#/golf/photos" className={hash === '#/golf/photos' ? 'active' : ''}>
            Photos
          </a>
        </nav>
        <div className="golf-nav-user">
          {notifCount > 0 && user?.role !== 'admin' && (
            <a href="#/golf/notifications" className="nav-notification-link" title="You have notifications">
              🔔 <span className="nav-badge">{notifCount}</span>
            </a>
          )}
          <a href="#/golf/profile" className="golf-nav-username-link">{user?.username}</a>
          <button className="btn btn-small btn-secondary" onClick={handleLogout}>Logout</button>
        </div>
      </div>
    </header>
  )
}
