import { useState, useEffect } from 'react'
import { submitScore, getCourses } from '../api/golfApi'

export default function GolfScoreForm({ onScoreSubmitted }) {
  const [score, setScore] = useState('')
  const [holes, setHoles] = useState('18')
  const [courseId, setCourseId] = useState('')
  const [datePlayed, setDatePlayed] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [courses, setCourses] = useState([])

  useEffect(() => {
    getCourses()
      .then(data => setCourses(data))
      .catch(() => {})
  }, [])

  // Group courses by county
  const grouped = courses.reduce((acc, c) => {
    if (!acc[c.county]) acc[c.county] = []
    acc[c.county].push(c)
    return acc
  }, {})

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)
    try {
      await submitScore(Number(score), datePlayed, Number(holes), courseId ? Number(courseId) : null)
      setSuccess('Score submitted successfully!')
      setScore('')
      setDatePlayed('')
      setHoles('18')
      setCourseId('')
      if (onScoreSubmitted) onScoreSubmitted()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="golf-page">
      <h2>🏌️ Submit Score</h2>
      <div className="golf-auth-card">
        <form onSubmit={handleSubmit} className="golf-form">
          <label htmlFor="course-input">Golf Course</label>
          <select
            id="course-input"
            value={courseId}
            onChange={e => setCourseId(e.target.value)}
            required
          >
            <option value="">Select a course…</option>
            {Object.entries(grouped).map(([county, list]) => (
              <optgroup key={county} label={`${county} County`}>
                {list.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.holes}h)
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <label htmlFor="holes-input">Holes Played</label>
          <select
            id="holes-input"
            value={holes}
            onChange={e => setHoles(e.target.value)}
            required
          >
            <option value="9">9 Holes</option>
            <option value="18">18 Holes</option>
          </select>
          <label htmlFor="score-input">Score</label>
          <input
            id="score-input"
            type="number"
            min="1"
            value={score}
            onChange={e => setScore(e.target.value)}
            placeholder="Enter your score"
            required
          />
          <label htmlFor="date-input">Date Played</label>
          <input
            id="date-input"
            type="date"
            value={datePlayed}
            onChange={e => setDatePlayed(e.target.value)}
            required
          />
          {error && <p className="golf-error">{error}</p>}
          {success && <p className="golf-success">{success}</p>}
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Submitting…' : 'Submit Score'}
          </button>
        </form>
      </div>
    </div>
  )
}
