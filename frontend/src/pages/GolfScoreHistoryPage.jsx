import { useState, useEffect } from 'react'
import { getMyScores } from '../api/golfApi'

export default function GolfScoreHistoryPage({ user }) {
  const [scores, setScores] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function fetchScores() {
    setLoading(true)
    setError('')
    try {
      setScores(await getMyScores())
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchScores() }, [])

  return (
    <div className="golf-page golf-page-wide">
      <h2>📋 My Score History</h2>

      {error && <p className="golf-error">{error}</p>}

      {loading ? (
        <p className="golf-loading">Loading scores…</p>
      ) : scores.length === 0 ? (
        <p className="golf-empty">No scores submitted yet.</p>
      ) : (
        <div className="golf-table-wrap">
          <table className="golf-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Course</th>
                <th>Score</th>
                <th>Holes</th>
                <th>Submitted At</th>
              </tr>
            </thead>
            <tbody>
              {scores.map(entry => (
                <tr key={entry.id}>
                  <td>{entry.date_played}</td>
                  <td>{entry.course_name || '—'}</td>
                  <td>{entry.score}</td>
                  <td>{entry.holes || 9}</td>
                  <td>{entry.created_at ? entry.created_at.slice(0, 16).replace('T', ' ') : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
