/**
 * 2026 WAGL Season Schedule
 * 20 events — dates are in 2026, times are local (Mountain Time)
 */
export const WAGL_SCHEDULE = [
  { event: 1,  date: '2026-04-16', time: '4:16 PM',  course: "The Barn" },
  { event: 2,  date: '2026-04-23', time: '4:10 PM',  course: "Glen Eagle" },
  { event: 3,  date: '2026-04-30', time: '4:10 PM',  course: "Schneiter's Bluff" },
  { event: 4,  date: '2026-05-07', time: '4:10 PM',  course: "Mt. Ogden" },
  { event: 5,  date: '2026-05-14', time: '4:10 PM',  course: "Sun Hills" },
  { event: 6,  date: '2026-05-21', time: '4:10 PM',  course: "Lakeside" },
  { event: 7,  date: '2026-05-28', time: '4:19 PM',  course: "Davis Park" },
  { event: 8,  date: '2026-06-04', time: '4:10 PM',  course: "Valley View" },
  { event: 9,  date: '2026-06-11', time: '4:10 PM',  course: "Crane Field" },
  { event: 10, date: '2026-06-18', time: '4:10 PM',  course: "Schneiter's Riverside" },
  { event: 11, date: '2026-07-09', time: '4:10 PM',  course: "Schneiter's Bluff" },
  { event: 12, date: '2026-07-16', time: '4:10 PM',  course: "Mt. Ogden" },
  { event: 13, date: '2026-07-23', time: '4:19 PM',  course: "Davis Park" },
  { event: 14, date: '2026-07-30', time: '4:10 PM',  course: "Schneiter's Riverside" },
  { event: 15, date: '2026-08-06', time: '4:10 PM',  course: "Crane Field" },
  { event: 16, date: '2026-08-13', time: '4:10 PM',  course: "Lakeside" },
  { event: 17, date: '2026-08-20', time: '4:10 PM',  course: "Valley View" },
  { event: 18, date: '2026-08-27', time: '4:20 PM',  course: "Glen Eagle" },
  { event: 19, date: '2026-09-03', time: '4:10 PM',  course: "The Barn" },
  { event: 20, date: '2026-09-10', time: '4:16 PM',  course: "Sun Hills" },
]

/**
 * Returns true if the event date is in the past (before today).
 */
export function isEventPlayed(eventDate) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return new Date(eventDate + 'T00:00:00') < today
}

/**
 * Format a YYYY-MM-DD date as "Thu, Apr 16, 2026"
 */
export function formatEventDate(dateStr) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
  })
}

/**
 * Map from schedule short names to database course names.
 */
export const COURSE_NAME_MAP = {
  "The Barn": "The Barn Golf Club",
  "Glen Eagle": "Glen Eagle Golf Club",
  "Schneiter's Bluff": "Schneiter's Bluff Golf Course",
  "Mt. Ogden": "Mount Ogden Golf Course",
  "Sun Hills": "Sun Hills Golf Course",
  "Lakeside": "Lakeside Golf Course",
  "Davis Park": "Davis Park Golf Course",
  "Valley View": "Valley View Golf Course",
  "Crane Field": "Crane Field Golf Course",
  "Schneiter's Riverside": "Schneiter's Riverside Golf Course",
}

/**
 * Returns the current week's scheduled event (if today is within the event's week, Mon-Sun).
 * Returns null if no event this week.
 */
export function getCurrentWeekEvent() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  // Find event where today is within 3 days before or after the event date (covers the week)
  return WAGL_SCHEDULE.find(evt => {
    const evtDate = new Date(evt.date + 'T00:00:00')
    const diffDays = Math.abs((today - evtDate) / (1000 * 60 * 60 * 24))
    return diffDays <= 3
  }) || null
}

/**
 * Returns the most recent past or today's event (for pre-populating score submission).
 */
export function getMostRecentEvent() {
  const today = new Date()
  today.setHours(23, 59, 59, 999)
  const pastEvents = WAGL_SCHEDULE.filter(evt => new Date(evt.date + 'T00:00:00') <= today)
  return pastEvents.length > 0 ? pastEvents[pastEvents.length - 1] : null
}

/**
 * Returns the next upcoming event (first event with date >= today).
 */
export function getNextEvent() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return WAGL_SCHEDULE.find(evt => new Date(evt.date + 'T00:00:00') >= today) || null
}

/**
 * Returns the event AFTER the next upcoming event (the "following week").
 * NOTE: This is used for RSVP — it should return the NEXT scheduled event
 * (the one the player hasn't played yet), not two weeks out.
 */
export function getFollowingWeekEvent() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  // Return the next upcoming event (first event with date >= today)
  return WAGL_SCHEDULE.find(evt => new Date(evt.date + 'T00:00:00') >= today) || null
}
