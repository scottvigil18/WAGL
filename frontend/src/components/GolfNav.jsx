import { clearToken } from '../api/golfApi'

export default function GolfNav({ user, onLogout }) {
  const hash = window.location.hash || '#/'

  function handleLogout() {
    clearToken()
    if (onLogout) onLogout()
    window.location.hash = '#/golf/login'
  }

  return (
    <header className="golf-navbar">
      <div className="golf-nav-container">
        <a href="#/golf/leaderboard" className="golf-logo">⛳ Golf League</a>
        <nav className="golf-nav-links">
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
          {user?.role === 'admin' && (
            <a href="#/golf/admin" className={hash === '#/golf/admin' ? 'active' : ''}>
              Admin
            </a>
          )}
        </nav>
        <div className="golf-nav-user">
          <a href="#/golf/profile" className="golf-nav-username-link">{user?.username}</a>
          <button className="btn btn-small btn-secondary" onClick={handleLogout}>Logout</button>
        </div>
      </div>
    </header>
  )
}
