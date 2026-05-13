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

export async function register(username, password) {
  const res = await fetch('/api/golf/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Registration failed')
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

export async function getMyScores() {
  const res = await fetch('/api/golf/scores/me', {
    headers: authHeaders(),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to fetch scores')
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
