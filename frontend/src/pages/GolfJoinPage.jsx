export default function GolfJoinPage() {
  return (
    <div className="splash-page">
      <header className="splash-header">
        <div className="splash-header-inner">
          <a href="#/golf/splash" className="splash-logo">⛳ WAGL</a>
          <nav className="splash-nav">
            <a href="#/golf/splash" className="splash-nav-link">Home</a>
            <a href="#/golf/about" className="splash-nav-link">About Us</a>
            <a href="#/golf/contact" className="splash-nav-link">Contact</a>
            <a href="#/golf/join" className="splash-nav-link active">How to Join</a>
            <a href="#/golf/login" className="splash-nav-link splash-login-btn">Member Login</a>
          </nav>
        </div>
      </header>

      <section className="splash-content-page">
        <h1>How to Join WAGL</h1>
        <p>Joining the West Area Golf League is easy! Here's what you need to know:</p>

        <div className="join-steps">
          <div className="join-step">
            <span className="join-step-num">1</span>
            <div>
              <h3>Register Online</h3>
              <p>Create your account with your name, email, and phone number. It takes less than a minute.</p>
            </div>
          </div>
          <div className="join-step">
            <span className="join-step-num">2</span>
            <div>
              <h3>Show Up & Play</h3>
              <p>Join us any Thursday evening at the scheduled course. Check the schedule for this week's location and tee time.</p>
            </div>
          </div>
          <div className="join-step">
            <span className="join-step-num">3</span>
            <div>
              <h3>Submit Your Score</h3>
              <p>After your round, log your score through the app. Your handicap will be calculated automatically.</p>
            </div>
          </div>
          <div className="join-step">
            <span className="join-step-num">4</span>
            <div>
              <h3>Compete & Have Fun</h3>
              <p>Track your progress on the leaderboard, earn weekly points, and enjoy the season!</p>
            </div>
          </div>
        </div>

        <h2>What You Need</h2>
        <ul>
          <li>Your own golf clubs (rentals available at most courses)</li>
          <li>Green fees paid individually at each course</li>
          <li>A positive attitude and love for the game!</li>
        </ul>

        <h2>Season Details</h2>
        <ul>
          <li><strong>When:</strong> April through September, Thursday evenings</li>
          <li><strong>Where:</strong> Rotating courses in Weber & Davis counties</li>
          <li><strong>Format:</strong> 9 holes, front or back</li>
          <li><strong>Skill Level:</strong> All levels welcome — handicaps keep it fair</li>
        </ul>

        <div className="join-cta">
          <a href="#/golf/register" className="btn btn-primary splash-btn-lg">Register Now</a>
          <p className="join-cta-note">Already a member? <a href="#/golf/login">Log in here</a></p>
        </div>
      </section>

      <footer className="splash-footer">
        <p>© 2026 West Area Golf League (WAGL) • Northern Utah</p>
      </footer>
    </div>
  )
}
