const TOKEN_KEY = 'golf_token'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY)
}

export function getUser() {
  const token = getToken()
  if (!token) return null
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return { id: payload.id, role: payload.role, username: payload.username }
  } catch {
    return null
  }
}

function authHeaders() {
  const token = getToken()
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  return headers
}

export async function register(username, password, email, phone, firstName, lastName) {
  const res = await fetch('/api/golf/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, email, phone, first_name: firstName, last_name: lastName }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Registration failed')
  return data
}

export async function checkUsername(username) {
  const res = await fetch(`/api/golf/check-username?username=${encodeURIComponent(username)}`)
  const data = await res.json()
  return data
}

export async function login(username, password) {
  const res = await fetch('/api/golf/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Login failed')
  return data
}

export async function getLeaderboard() {
  const res = await fetch('/api/golf/leaderboard')
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to fetch leaderboard')
  return data
}

export async function getPlayerProfile(playerId) {
  const res = await fetch(`/api/golf/players/${playerId}`)
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to fetch player profile')
  return data
}

export async function getWeeks() {
  const res = await fetch('/api/golf/weeks')
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to fetch weeks')
  return data
}

export async function getWeeklyLeaderboard(weekStart) {
  const res = await fetch(`/api/golf/leaderboard/weekly?week=${encodeURIComponent(weekStart)}`)
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to fetch weekly scores')
  return data
}

export async function getMyScores() {
  const res = await fetch('/api/golf/scores/me', {
    headers: authHeaders(),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to fetch scores')
  return data
}

export async function getMyProfile() {
  const res = await fetch('/api/golf/profile', { headers: authHeaders() })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to fetch profile')
  return data
}

export async function updateMyProfile(fields) {
  const res = await fetch('/api/golf/profile', {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(fields),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to update profile')
  return data
}

export async function submitScore(score, datePlayed, holes = 18, courseId = null) {
  const body = { score, date_played: datePlayed, holes }
  if (courseId) body.course_id = courseId
  const res = await fetch('/api/golf/scores', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to submit score')
  return data
}

export async function submitRsvp(eventDate, courseName, response) {
  const res = await fetch('/api/golf/rsvp', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ event_date: eventDate, course_name: courseName, response }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to save RSVP')
  return data
}

export async function editScore(id, score, datePlayed, holes) {
  const body = { score, date_played: datePlayed }
  if (holes !== undefined) body.holes = holes
  const res = await fetch(`/api/golf/scores/${id}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to edit score')
  return data
}

export async function getCourses() {
  const res = await fetch('/api/golf/courses')
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to fetch courses')
  return data
}

// ─── Admin API ────────────────────────────────────────────────────────────────

export async function adminGetPlayers() {
  const res = await fetch('/api/golf/admin/players', { headers: authHeaders() })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to fetch players')
  return data
}

export async function adminUpdatePlayer(id, fields) {
  const res = await fetch(`/api/golf/admin/players/${id}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(fields),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to update player')
  return data
}

export async function adminDeletePlayer(id) {
  const res = await fetch(`/api/golf/admin/players/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to delete player')
  return data
}

export async function adminArchivePlayer(id) {
  const res = await fetch(`/api/golf/admin/players/${id}/archive`, {
    method: 'POST',
    headers: authHeaders(),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to archive player')
  return data
}

export async function adminUnarchivePlayer(id) {
  const res = await fetch(`/api/golf/admin/players/${id}/unarchive`, {
    method: 'POST',
    headers: authHeaders(),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to restore player')
  return data
}

export async function adminGetScores() {
  const res = await fetch('/api/golf/admin/scores', { headers: authHeaders() })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to fetch scores')
  return data
}

export async function adminAddScore(fields) {
  const res = await fetch('/api/golf/admin/scores', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(fields),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to add score')
  return data
}

export async function adminUpdateScore(id, fields) {
  const res = await fetch(`/api/golf/admin/scores/${id}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(fields),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to update score')
  return data
}

export async function adminDeleteScore(id) {
  const res = await fetch(`/api/golf/admin/scores/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to delete score')
  return data
}

export async function adminImportCsv(file) {
  const formData = new FormData()
  formData.append('file', file)
  const token = getToken()
  const res = await fetch('/api/golf/admin/import-csv', {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'CSV import failed')
  return data
}

export async function adminGetRsvps(eventDate) {
  const url = eventDate
    ? `/api/golf/admin/rsvps?event_date=${encodeURIComponent(eventDate)}`
    : '/api/golf/admin/rsvps'
  const res = await fetch(url, { headers: authHeaders() })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to fetch RSVPs')
  return data
}
