export default function GolfSplashPage() {
  return (
    <div className="splash-page">
      <header className="splash-header">
        <div className="splash-header-inner">
          <span className="splash-logo">⛳ WAGL</span>
          <nav className="splash-nav">
            <a href="#/golf/splash" className="splash-nav-link active">Home</a>
            <a href="#/golf/about" className="splash-nav-link">About Us</a>
            <a href="#/golf/contact" className="splash-nav-link">Contact</a>
            <a href="#/golf/join" className="splash-nav-link">How to Join</a>
            <a href="#/golf/login" className="splash-nav-link splash-login-btn">Member Login</a>
          </nav>
        </div>
      </header>

      <section className="splash-hero">
        <div className="splash-hero-overlay">
          <h1 className="splash-title">West Area Golf League</h1>
          <p className="splash-subtitle">Northern Utah's Premier Weekly Golf League</p>
          <p className="splash-tagline">Weber & Davis County courses • Thursday evenings • All skill levels welcome</p>
          <div className="splash-cta">
            <a href="#/golf/join" className="btn btn-primary splash-btn">Join the League</a>
            <a href="#/golf/login" className="btn btn-secondary splash-btn">Member Login</a>
          </div>
        </div>
      </section>

      <section className="splash-features">
        <div className="splash-feature">
          <span className="splash-feature-icon">🏌️</span>
          <h3>Weekly Play</h3>
          <p>20 events across the season, rotating through the best 9-hole courses in Weber and Davis counties.</p>
        </div>
        <div className="splash-feature">
          <span className="splash-feature-icon">📊</span>
          <h3>Handicap Tracking</h3>
          <p>Automatic handicap calculation keeps competition fair for golfers of all skill levels.</p>
        </div>
        <div className="splash-feature">
          <span className="splash-feature-icon">🏆</span>
          <h3>Season Leaderboard</h3>
          <p>Track your progress, earn weekly points, and compete for the season championship.</p>
        </div>
        <div className="splash-feature">
          <span className="splash-feature-icon">👥</span>
          <h3>Great Community</h3>
          <p>Meet fellow golfers, enjoy friendly competition, and build lasting friendships on the course.</p>
        </div>
      </section>

      <section className="splash-courses">
        <h2>Our Courses</h2>
        <p className="splash-courses-sub">We play across Northern Utah's finest courses</p>
        <div className="splash-course-grid">
          <div className="splash-course-card">
            <h4>Weber County</h4>
            <ul>
              <li>The Barn Golf Club</li>
              <li>Mount Ogden Golf Course</li>
              <li>Schneiter's Riverside</li>
              <li>Wolf Creek Resort</li>
              <li>El Monte Golf Course</li>
            </ul>
          </div>
          <div className="splash-course-card">
            <h4>Davis County</h4>
            <ul>
              <li>Glen Eagle Golf Club</li>
              <li>Schneiter's Bluff</li>
              <li>Sun Hills Golf Course</li>
              <li>Davis Park Golf Course</li>
              <li>Valley View Golf Course</li>
              <li>Crane Field Golf Course</li>
              <li>Lakeside Golf Course</li>
              <li>Hubbard Memorial</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="splash-season">
        <h2>2026 Season</h2>
        <p>April through September • 20 events • Thursday evenings starting at 4:10 PM</p>
        <a href="#/golf/login" className="btn btn-primary splash-btn">View Full Schedule →</a>
      </section>

      <footer className="splash-footer">
        <p>© 2026 West Area Golf League (WAGL) • Northern Utah</p>
        <div className="splash-footer-links">
          <a href="#/golf/about">About</a>
          <a href="#/golf/contact">Contact</a>
          <a href="#/golf/join">Join</a>
          <a href="#/golf/login">Login</a>
        </div>
      </footer>
    </div>
  )
}
