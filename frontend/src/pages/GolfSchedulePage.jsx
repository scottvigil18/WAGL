import { WAGL_SCHEDULE, isEventPlayed, formatEventDate } from '../utils/waglSchedule'

export default function GolfSchedulePage() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const nextEventIdx = WAGL_SCHEDULE.findIndex(e => new Date(e.date + 'T00:00:00') >= today)

  return (
    <div className="golf-page">
      <h2>📅 Season Schedule</h2>
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
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {WAGL_SCHEDULE.map((evt, idx) => {
              const played = isEventPlayed(evt.date)
              const isNext = idx === nextEventIdx
              return (
                <tr
                  key={evt.event}
                  className={played ? 'schedule-row-played' : isNext ? 'schedule-row-next' : 'schedule-row-upcoming'}
                >
                  <td>{evt.event}</td>
                  <td>{formatEventDate(evt.date)}</td>
                  <td>{evt.time}</td>
                  <td>{evt.course}</td>
                  <td>
                    {played
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
