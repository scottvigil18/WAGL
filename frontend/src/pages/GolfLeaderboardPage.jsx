import { useState, useEffect } from 'react'
import { getLeaderboard, getWeeks, getWeeklyLeaderboard } from '../api/golfApi'

const TABS = ['Season Standings', 'Weekly Scores']

export default function GolfLeaderboardPage() {
  const [activeTab, setActiveTab] = useState('Season Standings')

  return (
    <div className="golf-page">
      <div className="golf-page-header">
        <h2>🏆 Leaderboard</h2>
      </div>
      <div className="leaderboard-tabs">
        {TABS.map(tab => (
          <button
            key={tab}
            className={`leaderboard-tab-btn${activeTab === tab ? ' active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>
      <div className="leaderboard-tab-content">
        {activeTab === 'Season Standings'  && <SeasonStandings />}
        {activeTab === 'Weekly Scores'     && <WeeklyScores />}
      </div>
    </div>
  )
}

// ─── Season Standings ─────────────────────────────────────────────────────────

function SeasonStandings() {
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try { setPlayers(await getLeaderboard()) }
    catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  if (loading) return <p className="golf-loading">Loading standings…</p>
  if (error)   return <p className="golf-error">{error}</p>
  if (players.length === 0) return <p className="golf-empty">No players yet.</p>

  return (
    <>
      <div className="leaderboard-refresh-row">
        <button className="btn btn-secondary btn-small" onClick={load} disabled={loading}>
          Refresh
        </button>
      </div>
      <div className="golf-table-wrap">
        <table className="golf-table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Player</th>
              <th>Handicap Index</th>
              <th>Season Total Points</th>
              <th>Weekly Points</th>
              <th>Last Score</th>
              <th>Holes</th>
              <th>Last Course Played</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {players.map((p, idx) => (
              <tr key={p.id}>
                <td className="rank-cell">
                  {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}
                </td>
                <td><a href={`#/golf/player/${p.id}`} className="player-link"><strong>{p.username}</strong></a></td>
                <td>{p.handicap_index != null ? p.handicap_index.toFixed(1) : '—'}</td>
                <td className="points-cell">
                  {p.season_total_points != null
                    ? <span className="weekly-points-badge">{p.season_total_points}</span>
                    : <span className="points-pending">TBD</span>}
                </td>
                <td className="points-cell">
                  {p.weekly_points != null
                    ? <span className="weekly-points-badge">{p.weekly_points}</span>
                    : <span className="points-pending">TBD</span>}
                </td>
                <td>{p.most_recent_score ?? '—'}</td>
                <td>{p.holes ?? '—'}</td>
                <td>{p.scored_this_week ? (p.course_name ?? '—') : ''}</td>
                <td>{p.date_played ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="leaderboard-note">
        ℹ️ Weekly points calculation coming soon — standings currently sorted by handicap index.
      </p>
    </>
  )
}

// ─── Weekly Scores ────────────────────────────────────────────────────────────

function WeeklyScores() {
  const [weeks, setWeeks] = useState([])
  const [selectedWeek, setSelectedWeek] = useState('')
  const [scores, setScores] = useState([])
  const [loadingWeeks, setLoadingWeeks] = useState(true)
  const [loadingScores, setLoadingScores] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadWeeks() {
      setLoadingWeeks(true)
      try {
        const data = await getWeeks()
        setWeeks(data)
        if (data.length > 0) {
          setSelectedWeek(data[0].week_start)
        }
      } catch (e) { setError(e.message) }
      finally { setLoadingWeeks(false) }
    }
    loadWeeks()
  }, [])

  useEffect(() => {
    if (!selectedWeek) return
    async function loadScores() {
      setLoadingScores(true)
      setError('')
      try { setScores(await getWeeklyLeaderboard(selectedWeek)) }
      catch (e) { setError(e.message) }
      finally { setLoadingScores(false) }
    }
    loadScores()
  }, [selectedWeek])

  const selectedLabel = weeks.find(w => w.week_start === selectedWeek)?.label || ''

  return (
    <>
      <div className="weekly-controls">
        <label htmlFor="week-select" className="weekly-label">Select Week:</label>
        {loadingWeeks ? (
          <span className="golf-loading">Loading weeks…</span>
        ) : weeks.length === 0 ? (
          <span className="golf-empty">No scored weeks yet.</span>
        ) : (
          <select
            id="week-select"
            className="weekly-select"
            value={selectedWeek}
            onChange={e => setSelectedWeek(e.target.value)}
          >
            {weeks.map(w => (
              <option key={w.week_start} value={w.week_start}>{w.label}</option>
            ))}
          </select>
        )}
      </div>

      {error && <p className="golf-error">{error}</p>}

      {selectedWeek && (
        <>
          <h3 className="weekly-heading">{selectedLabel}</h3>
          {loadingScores ? (
            <p className="golf-loading">Loading scores…</p>
          ) : scores.length === 0 ? (
            <p className="golf-empty">No scores recorded for this week.</p>
          ) : (
            <div className="golf-table-wrap">
              <table className="golf-table">
                <thead>
                  <tr>
                    <th>Player</th>
                    <th>Score</th>
                    <th>Holes</th>
                    <th>Course</th>
                    <th>Course Rating</th>
                    <th>Slope</th>
                    <th>Date Played</th>
                    <th>Weekly Points</th>
                  </tr>
                </thead>
                <tbody>
                  {scores.map((s, idx) => (
                    <tr key={`${s.id}-${idx}`}>
                      <td><strong>{s.username}</strong></td>
                      <td>{s.score}</td>
                      <td>{s.holes}</td>
                      <td>{s.course_name ?? '—'}</td>
                      <td>{s.course_rating ?? '—'}</td>
                      <td>{s.slope_rating ?? '—'}</td>
                      <td>{s.date_played}</td>
                      <td>
                        {s.weekly_points != null
                          ? <span className="weekly-points-badge">{s.weekly_points}</span>
                          : <span className="points-pending">TBD</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </>
  )
}

// ─── Season Schedule ──────────────────────────────────────────────────────────
// Moved to its own page: GolfSchedulePage.jsx