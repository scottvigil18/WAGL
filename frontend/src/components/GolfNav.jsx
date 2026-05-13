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
          <a href="#/golf/scores" className={hash === '#/golf/scores' ? 'active' : ''}>
            Submit Score
          </a>
          <a href="#/golf/history" className={hash === '#/golf/history' ? 'active' : ''}>
            My History
          </a>
        </nav>
        <div className="golf-nav-user">
          <span className="golf-nav-username">{user?.username}</span>
          <button className="btn btn-small btn-secondary" onClick={handleLogout}>Logout</button>
        </div>
      </div>
    </header>
  )
}
