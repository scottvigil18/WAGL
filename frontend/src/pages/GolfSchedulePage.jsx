import { useState, useEffect } from 'react'
import { WAGL_SCHEDULE, isEventPlayed, formatEventDate } from '../utils/waglSchedule'
import { adminGetRsvps, getUser } from '../api/golfApi'

const TABS_ADMIN = ['Schedule', 'RSVPs']
const TABS_PLAYER = ['Schedule']

export default function GolfSchedulePage() {
  const user = getUser()
  const isAdmin = user?.role === 'admin'
  const tabs = isAdmin ? TABS_ADMIN : TABS_PLAYER
  const [activeTab, setActiveTab] = useState('Schedule')

  return (
    <div className="golf-page golf-page-wide">
      <h2>📅 Season Schedule</h2>
      {isAdmin && (
        <div className="leaderboard-tabs">
          {tabs.map(tab => (
            <button
              key={tab}
              className={`leaderboard-tab-btn${activeTab === tab ? ' active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>
      )}
      <div className={isAdmin ? 'leaderboard-tab-content' : ''}>
        {activeTab === 'Schedule' && <ScheduleTab />}
        {activeTab === 'RSVPs' && isAdmin && <RsvpsTab />}
      </div>
    </div>
  )
}

function ScheduleTab() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const nextEventIdx = WAGL_SCHEDULE.findIndex(e => new Date(e.date + 'T00:00:00') >= today)

  // Check if an event is currently in progress (event day, 4PM-9PM Mountain Time)
  function isInProgress(evtDate) {
    const now = new Date()
    const evtDay = new Date(evtDate + 'T00:00:00')
    // Check if today is the event date
    if (now.getFullYear() !== evtDay.getFullYear() || now.getMonth() !== evtDay.getMonth() || now.getDate() !== evtDay.getDate()) return false
    // Mountain Time offset: UTC-6 (MDT) or UTC-7 (MST)
    // Use local time since the user is in Mountain Time
    const hour = now.getHours()
    return hour >= 16 && hour < 21 // 4PM to 9PM
  }

  return (
    <div>
      <p className="schedule-legend">
        <span className="schedule-dot played" /> Played &nbsp;&nbsp;
        <span className="schedule-dot upcoming" /> Upcoming
      </p>
      <div className="golf-table-wrap">
        <table className="golf-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Date</th>
              <th>Time</th>
              <th>Course</th>
              <th>Contest</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {WAGL_SCHEDULE.map((evt, idx) => {
              const played = isEventPlayed(evt.date)
              const isNext = idx === nextEventIdx
              const inProgress = isInProgress(evt.date)
              return (
                <tr
                  key={evt.event}
                  className={inProgress ? 'schedule-row-next' : played ? 'schedule-row-played' : isNext ? 'schedule-row-next' : 'schedule-row-upcoming'}
                >
                  <td>{evt.event}</td>
                  <td>{formatEventDate(evt.date)}</td>
                  <td>{evt.time}</td>
                  <td>{evt.course}</td>
                  <td>{evt.contest}</td>
                  <td>
                    {inProgress
                      ? <span className="schedule-status next">In Progress</span>
                      : played
                        ? <span className="schedule-status played">Played</span>
                        : isNext
                          ? <span className="schedule-status next">Next Up</span>
                          : <span className="schedule-status upcoming">Upcoming</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function RsvpsTab() {
  const [selectedDate, setSelectedDate] = useState('')
  const [rsvps, setRsvps] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [teeSlots, setTeeSlots] = useState([])
  const [dragPlayer, setDragPlayer] = useState(null)
  const [startOffset, setStartOffset] = useState(0) // minutes offset from scheduled time
  const [teeInterval, setTeeInterval] = useState(9) // minutes between tee times (7-12)

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const upcomingEvents = WAGL_SCHEDULE.filter(evt => new Date(evt.date + 'T00:00:00') >= today)

  useEffect(() => {
    if (upcomingEvents.length > 0 && !selectedDate) {
      setSelectedDate(upcomingEvents[0].date)
    }
  }, [])

  useEffect(() => {
    if (!selectedDate) return
    setStartOffset(0) // reset offset when event changes
    async function load() {
      setLoading(true)
      setError('')
      try {
        const data = await adminGetRsvps(selectedDate)
        setRsvps(data)
        const yesPlayers = data.filter(r => r.response === 'yes')
        const numSlots = Math.max(Math.ceil(yesPlayers.length / 4) + 1, 2)
        const slots = []
        for (let i = 0; i < numSlots; i++) {
          const group = []
          for (let j = 0; j < 4; j++) {
            const playerIdx = i * 4 + j
            group.push(playerIdx < yesPlayers.length ? yesPlayers[playerIdx] : null)
          }
          slots.push(group)
        }
        setTeeSlots(slots)
      } catch (e) { setError(e.message) }
      finally { setLoading(false) }
    }
    load()
  }, [selectedDate])

  const selectedEvent = WAGL_SCHEDULE.find(e => e.date === selectedDate)
  const noRsvps = rsvps.filter(r => r.response === 'no')

  function getBaseMinutes() {
    if (!selectedEvent) return 16 * 60 + 10
    const match = selectedEvent.time.match(/(\d+):(\d+)\s*(PM|AM)?/i)
    if (!match) return 16 * 60 + 10
    let hours = parseInt(match[1], 10)
    const mins = parseInt(match[2], 10)
    if (match[3] && match[3].toUpperCase() === 'PM' && hours < 12) hours += 12
    return hours * 60 + mins
  }

  const startMinutes = getBaseMinutes() + startOffset

  function formatTime(totalMinutes) {
    const h = Math.floor(totalMinutes / 60)
    const m = totalMinutes % 60
    const period = h >= 12 ? 'PM' : 'AM'
    const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h
    return `${h12}:${m.toString().padStart(2, '0')} ${period}`
  }

  function addTeeTime() {
    setTeeSlots(prev => [...prev, [null, null, null, null]])
  }

  function handleDragStart(player, fromSlotIdx, fromPos) {
    setDragPlayer({ player, fromSlotIdx, fromPos })
  }

  function handleDrop(toSlotIdx, toPos) {
    if (!dragPlayer) return
    const { fromSlotIdx, fromPos } = dragPlayer
    setTeeSlots(prev => {
      const next = prev.map(slot => [...slot])
      const targetPlayer = next[toSlotIdx][toPos]
      next[toSlotIdx][toPos] = dragPlayer.player
      next[fromSlotIdx][fromPos] = targetPlayer
      return next
    })
    setDragPlayer(null)
  }

  function handleDragOver(e) {
    e.preventDefault()
  }

  function exportPdf() {
    window.print()
  }

  function emailTeeSheet() {
    const lines = teeSlots.map((group, idx) => {
      const time = formatTime(startMinutes + idx * teeInterval)
      const names = group.map(p => p ? `${p.first_name || p.username} ${p.last_name || ''}`.trim() : 'Open').join(', ')
      return `${time}: ${names}`
    }).join('\n')

    const subject = encodeURIComponent(`Tee Times - ${selectedEvent?.course || 'WAGL'} - ${selectedEvent?.date || ''}`)
    const body = encodeURIComponent(
      `WAGL Tee Times\n${selectedEvent?.course || ''} — ${formatEventDate(selectedEvent?.date || '')}\n\n${lines}\n\nSitting Out: ${noRsvps.map(r => `${r.first_name || r.username} ${r.last_name || ''}`.trim()).join(', ') || 'None'}`
    )
    window.location.href = `mailto:?subject=${subject}&body=${body}`
  }

  return (
    <div>
      <div className="admin-section-header">
        <h3>Tee Times & RSVPs</h3>
        <div className="tee-actions">
          <button className="btn btn-small btn-secondary" onClick={exportPdf} title="Export to PDF">📄 Export PDF</button>
          <button className="btn btn-small btn-secondary" onClick={emailTeeSheet} title="Email tee sheet">✉️ Email</button>
        </div>
      </div>

      <div className="weekly-controls" style={{ marginBottom: 16 }}>
        <label htmlFor="rsvp-week-select" className="weekly-label">Event:</label>
        <select
          id="rsvp-week-select"
          className="weekly-select"
          value={selectedDate}
          onChange={e => setSelectedDate(e.target.value)}
        >
          {upcomingEvents.length === 0 && <option value="">No upcoming events</option>}
          {upcomingEvents.map(evt => (
            <option key={evt.date} value={evt.date}>
              {formatEventDate(evt.date)} — {evt.course}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="golf-error">{error}</p>}

      {selectedEvent && (
        <div className="par-info-banner" style={{ marginBottom: 16 }}>
          📅 <strong>{selectedEvent.course}</strong> — {formatEventDate(selectedEvent.date)}
        </div>
      )}

      {/* Start time and interval adjusters */}
      <div className="start-time-adjuster">
        <span className="weekly-label">Start Time:</span>
        <button className="btn btn-small btn-secondary" onClick={() => setStartOffset(o => o - 1)} title="Subtract 1 minute">▼</button>
        <span className="start-time-display">{formatTime(startMinutes)}</span>
        <button className="btn btn-small btn-secondary" onClick={() => setStartOffset(o => o + 1)} title="Add 1 minute">▲</button>

        <span className="weekly-label" style={{ marginLeft: 24 }}>Interval:</span>
        <button className="btn btn-small btn-secondary" onClick={() => setTeeInterval(i => Math.max(7, i - 1))} title="Decrease interval">▼</button>
        <span className="start-time-display">{teeInterval} min</span>
        <button className="btn btn-small btn-secondary" onClick={() => setTeeInterval(i => Math.min(12, i + 1))} title="Increase interval">▲</button>
      </div>

      {loading ? (
        <p className="golf-loading">Loading RSVPs…</p>
      ) : (
        <>
          {teeSlots.length > 0 && (
            <div className="tee-time-grid" id="tee-time-printable">
              {teeSlots.map((group, slotIdx) => {
                const teeTime = formatTime(startMinutes + slotIdx * teeInterval)
                return (
                  <div key={slotIdx} className="tee-time-row">
                    <div className="tee-time-label">{teeTime}</div>
                    <div className="tee-time-slots">
                      {group.map((player, pos) => (
                        <div
                          key={pos}
                          className={`tee-slot${player ? ' filled' : ' empty'}${dragPlayer ? ' drop-target' : ''}`}
                          draggable={!!player}
                          onDragStart={() => player && handleDragStart(player, slotIdx, pos)}
                          onDragOver={handleDragOver}
                          onDrop={() => handleDrop(slotIdx, pos)}
                        >
                          {player
                            ? <span className="tee-slot-name">{player.first_name || player.username} {player.last_name || ''}</span>
                            : <span className="tee-slot-empty">Open</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <div className="tee-bottom-actions">
            <button className="btn btn-secondary btn-small" onClick={addTeeTime}>
              + Add Tee Time
            </button>
          </div>

          {noRsvps.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <h4>❌ Sitting Out ({noRsvps.length})</h4>
              <ul className="rsvp-list">
                {noRsvps.map(r => (
                  <li key={r.id}>{r.first_name || r.username} {r.last_name || ''}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  )
}
