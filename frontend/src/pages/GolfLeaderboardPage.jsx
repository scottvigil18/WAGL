import { useState, useEffect } from 'react'
import { getLeaderboard, getWeeks, getWeeklyLeaderboard, getContestWinners, getSeasons } from '../api/golfApi'
import { WAGL_SCHEDULE, isEventPlayed, formatEventDate } from '../utils/waglSchedule'

const TABS = ['Season Standings', 'Weekly Scores', 'Contest Winners']

export default function GolfLeaderboardPage() {
  const [activeTab, setActiveTab] = useState('Season Standings')

  return (
    <div className="golf-page golf-page-wide">
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
        {activeTab === 'Contest Winners'   && <ContestWinners />}
      </div>
    </div>
  )
}

// ─── Season Standings ─────────────────────────────────────────────────────────

function SeasonStandings() {
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [flightFilter, setFlightFilter] = useState('all')
  const [seasons, setSeasons] = useState([])
  const [selectedYear, setSelectedYear] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const PAGE_SIZE = 10

  async function load(year) {
    setLoading(true)
    setError('')
    try { setPlayers(await getLeaderboard(year || undefined)) }
    catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => {
    getSeasons().then(yrs => {
      setSeasons(yrs)
      const currentYear = new Date().getFullYear().toString()
      const defaultYear = yrs.includes(currentYear) ? currentYear : (yrs[0] || '')
      setSelectedYear(defaultYear)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (selectedYear) load(selectedYear)
    else load()
  }, [selectedYear])

  if (loading) return <p className="golf-loading">Loading standings…</p>
  if (error)   return <p className="golf-error">{error}</p>
  if (players.length === 0) return <p className="golf-empty">No players yet.</p>

  // Calculate flight boundaries based on players with handicaps
  const playersWithHandicap = players.filter(p => p.handicap_index != null)
    .sort((a, b) => a.handicap_index - b.handicap_index)
  const thirdSize = Math.ceil(playersWithHandicap.length / 3)
  const lowCutoff = playersWithHandicap[thirdSize - 1]?.handicap_index ?? Infinity
  const highCutoff = playersWithHandicap[thirdSize * 2 - 1]?.handicap_index ?? Infinity

  function getPlayerFlight(p) {
    if (p.handicap_index == null) return 'none'
    if (p.handicap_index <= lowCutoff) return 'low'
    if (p.handicap_index <= highCutoff) return 'mid'
    return 'high'
  }

  const filteredPlayers = (flightFilter === 'all'
    ? players
    : players.filter(p => getPlayerFlight(p) === flightFilter)
  ).sort((a, b) => (b.season_total_points || 0) - (a.season_total_points || 0))

  const totalPages = Math.ceil(filteredPlayers.length / PAGE_SIZE)
  const paginatedPlayers = filteredPlayers.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  return (
    <>
      <div className="leaderboard-refresh-row">
        <div className="flight-filter">
          <span className="weekly-label">Season:</span>
          <select className="weekly-select" style={{ minWidth: 90 }} value={selectedYear} onChange={e => setSelectedYear(e.target.value)}>
            {seasons.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <span className="weekly-label" style={{ marginLeft: 16 }}>Flight:</span>
          <button className={`btn btn-small${flightFilter === 'all' ? ' btn-primary' : ' btn-secondary'}`} onClick={() => { setFlightFilter('all'); setCurrentPage(1) }}>All</button>
          <button className={`btn btn-small${flightFilter === 'low' ? ' btn-primary' : ' btn-secondary'}`} onClick={() => { setFlightFilter('low'); setCurrentPage(1) }}>Low</button>
          <button className={`btn btn-small${flightFilter === 'mid' ? ' btn-primary' : ' btn-secondary'}`} onClick={() => { setFlightFilter('mid'); setCurrentPage(1) }}>Mid</button>
          <button className={`btn btn-small${flightFilter === 'high' ? ' btn-primary' : ' btn-secondary'}`} onClick={() => { setFlightFilter('high'); setCurrentPage(1) }}>High</button>
        </div>
        <button className="btn btn-secondary btn-small" onClick={() => load(selectedYear)} disabled={loading}>
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
            {paginatedPlayers.map((p, idx) => {
              const rank = (currentPage - 1) * PAGE_SIZE + idx
              return (
              <tr key={p.id}>
                <td className="rank-cell">
                  {rank === 0 ? '🥇' : rank === 1 ? '🥈' : rank === 2 ? '🥉' : rank + 1}
                </td>
                <td><a href={`#/golf/player/${p.id}`} className="player-link"><strong>{p.first_name || p.username} {p.last_name || ''}</strong></a></td>
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
            )})}
          </tbody>
        </table>
      </div>
      <p className="leaderboard-note">
        ℹ️ Points: 3 base + 0-4 bonus (within flight). Max 7 per week.
      </p>
      {totalPages > 1 && (
        <div className="pagination-controls">
          <button className="btn btn-small btn-secondary" onClick={() => setCurrentPage(pg => Math.max(1, pg - 1))} disabled={currentPage === 1}>
            ← Prev
          </button>
          <span className="pagination-info">Page {currentPage} of {totalPages} ({filteredPlayers.length} players)</span>
          <button className="btn btn-small btn-secondary" onClick={() => setCurrentPage(pg => Math.min(totalPages, pg + 1))} disabled={currentPage === totalPages}>
            Next →
          </button>
        </div>
      )}
    </>
  )
}

// ─── Weekly Scores ────────────────────────────────────────────────────────────

function WeeklyScores() {
  const [selectedWeek, setSelectedWeek] = useState('all')
  const [scores, setScores] = useState([])
  const [loadingScores, setLoadingScores] = useState(true)
  const [error, setError] = useState('')

  // All WAGL schedule events (past ones for filtering)
  const today = new Date()
  today.setHours(23, 59, 59, 999)
  const playedEvents = WAGL_SCHEDULE.filter(evt => new Date(evt.date + 'T00:00:00') <= today)

  useEffect(() => {
    loadScores()
  }, [selectedWeek])

  async function loadScores() {
    setLoadingScores(true)
    setError('')
    try {
      if (selectedWeek === 'all') {
        setScores(await getWeeklyLeaderboard(''))
      } else {
        setScores(await getWeeklyLeaderboard(selectedWeek))
      }
    } catch (e) { setError(e.message) }
    finally { setLoadingScores(false) }
  }

  return (
    <>
      <div className="weekly-controls">
        <label htmlFor="week-select" className="weekly-label">Filter by Event:</label>
        <select
          id="week-select"
          className="weekly-select"
          value={selectedWeek}
          onChange={e => setSelectedWeek(e.target.value)}
        >
          <option value="all">All Scores</option>
          {[...playedEvents].reverse().map(evt => (
            <option key={evt.date} value={evt.date}>
              Event {evt.event} — {formatEventDate(evt.date)} — {evt.course}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="golf-error">{error}</p>}

      {loadingScores ? (
        <p className="golf-loading">Loading scores…</p>
      ) : scores.length === 0 ? (
        <p className="golf-empty">No scores recorded yet.</p>
      ) : (
        <div className="golf-table-wrap">
          <table className="golf-table">
            <thead>
              <tr>
                <th>Player</th>
                <th>Score</th>
                <th>Holes</th>
                <th>Course</th>
                <th>Date Played</th>
                <th>Weekly Points</th>
              </tr>
            </thead>
            <tbody>
              {scores.map((s, idx) => (
                <tr key={`${s.id}-${idx}`}>
                  <td><strong>{s.first_name || s.username} {s.last_name || ''}</strong></td>
                  <td>{s.score}</td>
                  <td>{s.holes}</td>
                  <td>{s.course_name ?? '—'}</td>
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
  )
}

// ─── Contest Winners ──────────────────────────────────────────────────────────

function ContestWinners() {
  const [selectedDate, setSelectedDate] = useState('all')
  const [winners, setWinners] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const today = new Date()
  today.setHours(23, 59, 59, 999)
  const playedEvents = WAGL_SCHEDULE.filter(evt => new Date(evt.date + 'T00:00:00') <= today)

  useEffect(() => {
    loadWinners()
  }, [selectedDate])

  async function loadWinners() {
    setLoading(true)
    setError('')
    try {
      const date = selectedDate === 'all' ? undefined : selectedDate
      setWinners(await getContestWinners(date))
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  const categoryLabels = {
    mens_closest: "🎯 Men's Closest to the Hole",
    womens_closest: "🎯 Women's Closest to the Hole",
    longest_putt: "🏌️ Longest Putt",
  }

  // Group winners by event_date
  const grouped = winners.reduce((acc, w) => {
    if (!acc[w.event_date]) acc[w.event_date] = []
    acc[w.event_date].push(w)
    return acc
  }, {})

  return (
    <>
      <div className="weekly-controls">
        <label htmlFor="contest-select" className="weekly-label">Filter by Event:</label>
        <select
          id="contest-select"
          className="weekly-select"
          value={selectedDate}
          onChange={e => setSelectedDate(e.target.value)}
        >
          <option value="all">All Events</option>
          {[...playedEvents].reverse().map(evt => (
            <option key={evt.date} value={evt.date}>
              Event {evt.event} — {formatEventDate(evt.date)} — {evt.course}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="golf-error">{error}</p>}

      {loading ? (
        <p className="golf-loading">Loading contest winners…</p>
      ) : winners.length === 0 ? (
        <p className="golf-empty">No contest winners recorded yet.</p>
      ) : (
        <div className="contest-winners-list">
          {Object.entries(grouped).sort((a, b) => b[0].localeCompare(a[0])).map(([date, entries]) => {
            const event = WAGL_SCHEDULE.find(e => e.date === date)
            return (
              <div key={date} className="contest-week-card">
                <h4 className="contest-week-title">
                  {event ? `Event ${event.event}: ${event.course}` : date} — {formatEventDate(date)}
                </h4>
                <div className="contest-entries">
                  {entries.map(w => (
                    <div key={w.id} className="contest-entry">
                      <span className="contest-category">{categoryLabels[w.category] || w.category}</span>
                      <span className="contest-winner-name">{w.player_name}</span>
                      {w.distance && <span className="contest-distance">{w.distance}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}

// ─── Season Schedule ──────────────────────────────────────────────────────────
// Moved to its own page: GolfSchedulePage.jsx