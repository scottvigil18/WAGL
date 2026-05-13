import { useState, useEffect } from 'react'
import { getLeaderboard } from '../api/golfApi'

export default function GolfLeaderboardPage() {
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function fetchData() {
    setLoading(true)
    setError('')
    try {
      const data = await getLeaderboard()
      setPlayers(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  return (
    <div className="golf-page">
      <div className="golf-page-header">
        <h2>🏆 Leaderboard</h2>
        <button className="btn btn-secondary" onClick={fetchData} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {error && <p className="golf-error">{error}</p>}

      {loading ? (
        <p className="golf-loading">Loading leaderboard…</p>
      ) : players.length === 0 ? (
        <p className="golf-empty">No players yet</p>
      ) : (
        <div className="golf-table-wrap">
          <table className="golf-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Player</th>
                <th>Most Recent Score</th>
                <th>Holes</th>
                <th>Course</th>
                <th>Date Played</th>
                <th>Handicap Index</th>
              </tr>
            </thead>
            <tbody>
              {players.map((player, idx) => (
                <tr key={player.username}>
                  <td>{idx + 1}</td>
                  <td>{player.username}</td>
                  <td>{player.most_recent_score ?? '—'}</td>
                  <td>{player.holes ?? '—'}</td>
                  <td>{player.course_name ?? '—'}</td>
                  <td>{player.date_played ?? '—'}</td>
                  <td>{player.handicap_index != null ? player.handicap_index.toFixed(1) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
