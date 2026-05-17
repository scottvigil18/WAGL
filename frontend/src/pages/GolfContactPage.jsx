export default function GolfContactPage() {
  return (
    <div className="splash-page">
      <header className="splash-header">
        <div className="splash-header-inner">
          <a href="#/golf/splash" className="splash-logo">⛳ WAGL</a>
          <nav className="splash-nav">
            <a href="#/golf/splash" className="splash-nav-link">Home</a>
            <a href="#/golf/about" className="splash-nav-link">About Us</a>
            <a href="#/golf/contact" className="splash-nav-link active">Contact</a>
            <a href="#/golf/join" className="splash-nav-link">How to Join</a>
            <a href="#/golf/login" className="splash-nav-link splash-login-btn">Member Login</a>
          </nav>
        </div>
      </header>

      <section className="splash-content-page">
        <h1>Contact Us</h1>
        <p>Have questions about the West Area Golf League? We'd love to hear from you.</p>
        <div className="contact-info-grid">
          <div className="contact-card">
            <h3>📧 Email</h3>
            <p>Reach out to the league administrator for general inquiries, membership questions, or feedback.</p>
          </div>
          <div className="contact-card">
            <h3>⛳ On the Course</h3>
            <p>The best way to connect is to join us on Thursday evenings! Come out and meet the group.</p>
          </div>
          <div className="contact-card">
            <h3>👤 Members</h3>
            <p>Current members can message the admin directly through their profile page after logging in.</p>
          </div>
        </div>
        <h2>Location</h2>
        <p>We play across Weber and Davis counties in Northern Utah, rotating through courses from Ogden to Bountiful.</p>
        <a href="#/golf/join" className="btn btn-primary splash-btn">Interested? Learn How to Join →</a>
      </section>

      <footer className="splash-footer">
        <p>© 2026 West Area Golf League (WAGL) • Northern Utah</p>
      </footer>
    </div>
  )
}
