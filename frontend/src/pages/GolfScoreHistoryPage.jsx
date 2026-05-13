import { useState, useEffect } from 'react'
import { getMyScores, editScore } from '../api/golfApi'

export default function GolfScoreHistoryPage({ user }) {
  const [scores, setScores] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editValues, setEditValues] = useState({ score: '', date_played: '', holes: '' })
  const [editError, setEditError] = useState('')

  async function fetchScores() {
    setLoading(true)
    setError('')
    try {
      const data = await getMyScores()
      setScores(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchScores() }, [])

  function startEdit(entry) {
    setEditingId(entry.id)
    setEditValues({ score: entry.score, date_played: entry.date_played, holes: entry.holes || 18 })
    setEditError('')
  }

  function cancelEdit() {
    setEditingId(null)
    setEditError('')
  }

  async function saveEdit(id) {
    setEditError('')
    try {
      await editScore(id, Number(editValues.score), editValues.date_played, Number(editValues.holes))
      setEditingId(null)
      fetchScores()
    } catch (err) {
      setEditError(err.message)
    }
  }

  return (
    <div className="golf-page">
      <h2>📋 My Score History</h2>

      {error && <p className="golf-error">{error}</p>}

      {loading ? (
        <p className="golf-loading">Loading scores…</p>
      ) : scores.length === 0 ? (
        <p className="golf-empty">No scores submitted yet</p>
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
                {user?.role === 'admin' && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {scores.map(entry => (
                <tr key={entry.id}>
                  {editingId === entry.id ? (
                    <>
                      <td>
                        <input
                          type="date"
                          value={editValues.date_played}
                          onChange={e => setEditValues({ ...editValues, date_played: e.target.value })}
                        />
                      </td>
                      <td>{entry.course_name || '—'}</td>
                      <td>
                        <input
                          type="number"
                          min="1"
                          value={editValues.score}
                          onChange={e => setEditValues({ ...editValues, score: e.target.value })}
                        />
                      </td>
                      <td>
                        <select
                          value={editValues.holes}
                          onChange={e => setEditValues({ ...editValues, holes: e.target.value })}
                        >
                          <option value="9">9</option>
                          <option value="18">18</option>
                        </select>
                      </td>
                      <td>{entry.created_at}</td>
                      <td>
                        <button className="btn btn-small btn-primary" onClick={() => saveEdit(entry.id)}>Save</button>
                        <button className="btn btn-small btn-secondary" onClick={cancelEdit}>Cancel</button>
                        {editError && <span className="golf-error">{editError}</span>}
                      </td>
                    </>
                  ) : (
                    <>
                      <td>{entry.date_played}</td>
                      <td>{entry.course_name || '—'}</td>
                      <td>{entry.score}</td>
                      <td>{entry.holes || 18}</td>
                      <td>{entry.created_at}</td>
                      {user?.role === 'admin' && (
                        <td>
                          <button className="btn btn-small btn-secondary" onClick={() => startEdit(entry)}>Edit</button>
                        </td>
                      )}
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
