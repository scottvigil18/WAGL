export default function GolfAboutPage() {
  return (
    <div className="splash-page">
      <header className="splash-header">
        <div className="splash-header-inner">
          <a href="#/golf/splash" className="splash-logo">⛳ WAGL</a>
          <nav className="splash-nav">
            <a href="#/golf/splash" className="splash-nav-link">Home</a>
            <a href="#/golf/about" className="splash-nav-link active">About Us</a>
            <a href="#/golf/contact" className="splash-nav-link">Contact</a>
            <a href="#/golf/join" className="splash-nav-link">How to Join</a>
            <a href="#/golf/login" className="splash-nav-link splash-login-btn">Member Login</a>
          </nav>
        </div>
      </header>

      <section className="splash-content-page">
        <h1>About WAGL</h1>
        <p>The <strong>West Area Golf League (WAGL)</strong> is a recreational golf league based in Northern Utah, serving golfers across Weber and Davis counties.</p>
        <h2>Our Mission</h2>
        <p>To provide a fun, competitive, and social golfing experience for players of all skill levels. Whether you're a seasoned golfer or just picking up the clubs, WAGL welcomes you.</p>
        <h2>How It Works</h2>
        <ul>
          <li>We play 9 holes every Thursday evening during the season (April–September)</li>
          <li>Courses rotate weekly across Weber and Davis counties</li>
          <li>Handicaps are tracked automatically so competition stays fair</li>
          <li>Weekly points are awarded based on handicap-adjusted performance</li>
          <li>Season standings determine the league champion</li>
        </ul>
        <h2>History</h2>
        <p>WAGL was founded by a group of friends who wanted a casual but organized way to play golf regularly. What started as a small group has grown into a thriving community of golfers who enjoy the camaraderie and friendly competition the league provides.</p>
        <a href="#/golf/join" className="btn btn-primary splash-btn">Join the League →</a>
      </section>

      <footer className="splash-footer">
        <p>© 2026 West Area Golf League (WAGL) • Northern Utah</p>
      </footer>
    </div>
  )
}
