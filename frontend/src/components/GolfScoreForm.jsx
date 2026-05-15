import { useState, useEffect } from 'react'
import { submitScore, submitRsvp, getCourses } from '../api/golfApi'
import { getMostRecentEvent, getFollowingWeekEvent, COURSE_NAME_MAP, formatEventDate } from '../utils/waglSchedule'

export default function GolfScoreForm({ onScoreSubmitted }) {
  const [score, setScore] = useState('')
  const [courseId, setCourseId] = useState('')
  const [nineSelection, setNineSelection] = useState('front')
  const [datePlayed, setDatePlayed] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [courses, setCourses] = useState([])
  const [playingNextWeek, setPlayingNextWeek] = useState(null) // null | 'yes' | 'no'

  // Next week's event info
  const followingWeekEvent = getFollowingWeekEvent()

  async function handleRsvp(response) {
    setPlayingNextWeek(response)
    if (followingWeekEvent) {
      try {
        await submitRsvp(followingWeekEvent.date, followingWeekEvent.course, response)
      } catch (e) {
        // Silently fail — RSVP is non-critical
        console.error('RSVP save failed:', e)
      }
    }
  }

  useEffect(() => {
    getCourses()
      .then(data => {
        setCourses(data)
        // Pre-populate based on the most recent scheduled event
        const recentEvent = getMostRecentEvent()
        if (recentEvent) {
          setDatePlayed(recentEvent.date)
          // Find the matching course in the database
          const dbCourseName = COURSE_NAME_MAP[recentEvent.course]
          if (dbCourseName) {
            const match = data.find(c => c.name === dbCourseName)
            if (match) setCourseId(String(match.id))
          }
        }
      })
      .catch(() => {})
  }, [])

  // Group courses by county
  const grouped = courses.reduce((acc, c) => {
    if (!acc[c.county]) acc[c.county] = []
    acc[c.county].push(c)
    return acc
  }, {})

  // Selected course object
  const selectedCourse = courses.find(c => String(c.id) === String(courseId))

  // Par for the selected nine
  const par = selectedCourse
    ? (nineSelection === 'front' ? selectedCourse.par_front : selectedCourse.par_back)
    : null

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)
    try {
      await submitScore(Number(score), datePlayed, 9, courseId ? Number(courseId) : null)
      setSuccess('Score submitted successfully!')
      setScore('')
      setDatePlayed('')
      setCourseId('')
      setNineSelection('front')
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

          <label htmlFor="date-input">Date Played</label>
          <input
            id="date-input"
            type="date"
            value={datePlayed}
            onChange={e => setDatePlayed(e.target.value)}
            required
          />

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

          <label>Nine Played</label>
          <div className="nine-radio-group">
            <label className={`nine-radio-option${nineSelection === 'front' ? ' selected' : ''}`}>
              <input
                type="radio"
                name="nine"
                value="front"
                checked={nineSelection === 'front'}
                onChange={() => setNineSelection('front')}
              />
              <span>Front 9</span>
              {selectedCourse && (
                <span className="nine-par-badge">Par {selectedCourse.par_front}</span>
              )}
            </label>
            <label className={`nine-radio-option${nineSelection === 'back' ? ' selected' : ''}`}>
              <input
                type="radio"
                name="nine"
                value="back"
                checked={nineSelection === 'back'}
                onChange={() => setNineSelection('back')}
              />
              <span>Back 9</span>
              {selectedCourse && (
                <span className="nine-par-badge">Par {selectedCourse.par_back}</span>
              )}
            </label>
          </div>

          {par !== null && (
            <div className="par-info-banner">
              ⛳ Course par for {nineSelection === 'front' ? 'Front 9' : 'Back 9'}: <strong>{par}</strong>
            </div>
          )}

          <label htmlFor="holes-input">Holes Played</label>
          <input
            id="holes-input"
            type="text"
            value="9 Holes"
            readOnly
            className="golf-form-readonly"
          />

          <label htmlFor="score-input">Score</label>
          <input
            id="score-input"
            type="number"
            min="1"
            value={score}
            onChange={e => setScore(e.target.value)}
            placeholder={par !== null ? `Par is ${par}` : 'Enter your score'}
            required
          />

          {error && <p className="golf-error">{error}</p>}
          {success && <p className="golf-success">{success}</p>}
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Submitting…' : 'Submit Score'}
          </button>
        </form>

        {/* Next week RSVP */}
        {followingWeekEvent && (
          <div className="next-week-rsvp">
            <p className="next-week-prompt">
              <strong>Next week:</strong> {followingWeekEvent.course} — {formatEventDate(followingWeekEvent.date)} at {followingWeekEvent.time}
            </p>
            <p className="next-week-question">Will you be playing?</p>
            <div className="nine-radio-group">
              <label className={`nine-radio-option${playingNextWeek === 'yes' ? ' selected' : ''}`}>
                <input
                  type="radio"
                  name="nextweek"
                  value="yes"
                  checked={playingNextWeek === 'yes'}
                  onChange={() => handleRsvp('yes')}
                />
                <span>Yes, I'm in</span>
              </label>
              <label className={`nine-radio-option${playingNextWeek === 'no' ? ' selected' : ''}`}>
                <input
                  type="radio"
                  name="nextweek"
                  value="no"
                  checked={playingNextWeek === 'no'}
                  onChange={() => handleRsvp('no')}
                />
                <span>No, sitting out</span>
              </label>
            </div>
            {playingNextWeek === 'yes' && (
              <p className="golf-success" style={{marginTop: 8}}>👍 See you at {followingWeekEvent.course}!</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
