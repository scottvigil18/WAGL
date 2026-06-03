export default function GolfRulesPage() {
  return (
    <div className="golf-page golf-page-wide">
      <h2>📖 League Rules & Scoring</h2>

      <div className="handicap-explanation">
        <h4>Handicap Calculation</h4>
        <div className="handicap-steps">
          <div className="handicap-step">
            <span className="handicap-step-num">1</span>
            <div>
              <strong>Collect Recent Scores</strong>
              <p>Your last 20 scores are used (or all scores if fewer than 20).</p>
            </div>
          </div>
          <div className="handicap-step">
            <span className="handicap-step-num">2</span>
            <div>
              <strong>Calculate Over Par</strong>
              <p>For each score, subtract par (36 for 9 holes).</p>
              <p className="handicap-example">Example: Score of 42 → 42 - 36 = <strong>6 over par</strong></p>
            </div>
          </div>
          <div className="handicap-step">
            <span className="handicap-step-num">3</span>
            <div>
              <strong>Use Best 75%</strong>
              <p>Sort from lowest to highest. Drop the worst 25% and keep the best 75%.</p>
              <p className="handicap-example">Example: 20 scores → use the best 15</p>
            </div>
          </div>
          <div className="handicap-step">
            <span className="handicap-step-num">4</span>
            <div>
              <strong>Average & Round</strong>
              <p>Average the remaining over-par values and round to the nearest whole number. That's your handicap.</p>
              <p className="handicap-example">Example: Average of best 15 = 8.3 → Handicap = <strong>8</strong></p>
            </div>
          </div>
        </div>

        <h4 style={{marginTop: 32}}>Weekly Points System</h4>
        <table className="golf-table" style={{maxWidth: 500, tableLayout: 'auto'}}>
          <thead>
            <tr><th>Component</th><th>Points</th><th>Description</th></tr>
          </thead>
          <tbody>
            <tr><td>Base</td><td><strong>3</strong></td><td>Awarded for playing (everyone who submits a score)</td></tr>
            <tr><td>Bonus</td><td><strong>0–4</strong></td><td>Based on performance within your flight (best = 4, worst = 0)</td></tr>
            <tr><td>Total</td><td><strong>3–7</strong></td><td>Maximum possible per week</td></tr>
          </tbody>
        </table>

        <h4 style={{marginTop: 32}}>Flight Assignments</h4>
        <p>Players are divided into 3 flights based on handicap:</p>
        <ul>
          <li><strong>Low Flight</strong> — Top third (lowest handicaps, strongest players)</li>
          <li><strong>Mid Flight</strong> — Middle third</li>
          <li><strong>High Flight</strong> — Bottom third (highest handicaps, newer players)</li>
        </ul>
        <p>Bonus points are calculated <em>within</em> each flight, so you compete against players of similar skill level.</p>

        <h4 style={{marginTop: 32}}>Handicap Contest Winners</h4>
        <p>On handicap weeks, one winner is selected from each flight:</p>
        <ul>
          <li><strong>Gross Score</strong> = Your actual score for the round</li>
          <li><strong>Net Score</strong> = Gross Score minus your Handicap</li>
          <li>The lowest net score in each flight wins</li>
        </ul>

        <h4 style={{marginTop: 32}}>Key Rules</h4>
        <ul>
          <li>Par for 9 holes = 36</li>
          <li>Scores must be submitted within 24 hours of the date played</li>
          <li>Only the admin can edit or delete submitted scores</li>
          <li>Handicaps update automatically when new scores are submitted</li>
          <li>Handicaps persist across seasons</li>
          <li>Season total points accumulate across all weeks in the year</li>
          <li>The season leaderboard is sorted by total points (highest first)</li>
        </ul>

        <h4 style={{marginTop: 32}}>Weekly Contests</h4>
        <p>Events alternate between two contest types:</p>
        <ul>
          <li><strong>Closest to the Hole & Long Putt</strong> — Men's closest, Women's closest, and Longest putt prizes</li>
          <li><strong>Handicap</strong> — Best net score wins in each flight (Low, Mid, High)</li>
        </ul>
      </div>
    </div>
  )
}
