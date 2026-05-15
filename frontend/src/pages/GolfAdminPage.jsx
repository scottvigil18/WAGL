import { useState, useEffect, useRef } from 'react'
import {
  adminGetPlayers, adminUpdatePlayer, adminDeletePlayer,
  adminArchivePlayer, adminUnarchivePlayer,
  adminGetScores, adminAddScore, adminUpdateScore, adminDeleteScore,
  adminImportCsv, adminGetRsvps, getCourses,
} from '../api/golfApi'
import { formatPhoneInput, formatPhoneDisplay } from '../utils/formatPhone'
import { WAGL_SCHEDULE, formatEventDate } from '../utils/waglSchedule'

const TABS = ['Players', 'Scores', 'RSVPs', 'CSV Import']

export default function GolfAdminPage() {
  const [activeTab, setActiveTab] = useState('Scores')

  return (
    <div className="golf-page admin-page">
      <h2>⚙️ Admin Panel</h2>
      <div className="admin-tabs">
        {TABS.map(tab => (
          <button
            key={tab}
            className={`admin-tab-btn${activeTab === tab ? ' active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>
      <div className="admin-tab-content">
        {activeTab === 'Players'    && <PlayersTab />}
        {activeTab === 'Scores'     && <ScoresTab />}
        {activeTab === 'RSVPs'      && <RsvpsTab />}
        {activeTab === 'CSV Import' && <CsvImportTab />}
      </div>
    </div>
  )
}

// ─── Scores Tab ───────────────────────────────────────────────────────────────

function ScoresTab() {
  const [scores, setScores] = useState([])
  const [players, setPlayers] = useState([])
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editId, setEditId] = useState(null)
  const [editFields, setEditFields] = useState({})
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)

  // Add score form state
  const [addFields, setAddFields] = useState({ player_id: '', score: '', holes: '18', date_played: '', course_id: '' })
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    Promise.all([adminGetScores(), adminGetPlayers(), getCourses()])
      .then(([s, p, c]) => { setScores(s); setPlayers(p.filter(pl => pl.role === 'player')); setCourses(c) })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  // Group courses by county for the select
  const groupedCourses = courses.reduce((acc, c) => {
    if (!acc[c.county]) acc[c.county] = []
    acc[c.county].push(c)
    return acc
  }, {})

  async function handleAddScore(e) {
    e.preventDefault()
    setAdding(true)
    setMsg('')
    try {
      const created = await adminAddScore({
        player_id: parseInt(addFields.player_id, 10),
        score: parseInt(addFields.score, 10),
        holes: parseInt(addFields.holes, 10),
        date_played: addFields.date_played,
        course_id: addFields.course_id ? parseInt(addFields.course_id, 10) : null,
      })
      setScores(prev => [created, ...prev])
      setAddFields({ player_id: '', score: '', holes: '18', date_played: '', course_id: '' })
      setShowAddForm(false)
      setMsg('Score added.')
    } catch (e) { setMsg(e.message) }
    finally { setAdding(false) }
  }

  function startEdit(s) {
    setEditId(s.id)
    setEditFields({ score: s.score, holes: s.holes, date_played: s.date_played, course_id: s.course_id ?? '' })
    setMsg('')
  }

  async function saveEdit(id) {
    setSaving(true)
    setMsg('')
    try {
      const updated = await adminUpdateScore(id, {
        score: parseInt(editFields.score, 10),
        holes: parseInt(editFields.holes, 10),
        date_played: editFields.date_played,
        course_id: editFields.course_id !== '' ? parseInt(editFields.course_id, 10) : null,
      })
      setScores(prev => prev.map(s => s.id === id ? { ...s, ...updated } : s))
      setEditId(null)
      setMsg('Score updated.')
    } catch (e) { setMsg(e.message) }
    finally { setSaving(false) }
  }

  async function deleteScore(id) {
    if (!confirm('Delete this score? This will recalculate the player\'s handicap.')) return
    try {
      await adminDeleteScore(id)
      setScores(prev => prev.filter(s => s.id !== id))
      setMsg('Score deleted.')
    } catch (e) { setMsg(e.message) }
  }

  if (loading) return <p className="golf-loading">Loading scores…</p>
  if (error) return <p className="golf-error">{error}</p>

  return (
    <div>
      <div className="admin-section-header">
        <h3>All Scores</h3>
        <span className="admin-count">{scores.length} records</span>
        <button
          className="btn btn-small btn-primary"
          style={{ marginLeft: 'auto' }}
          onClick={() => { setShowAddForm(v => !v); setMsg('') }}
        >
          {showAddForm ? 'Cancel' : '+ Add Score'}
        </button>
      </div>

      {showAddForm && (
        <form onSubmit={handleAddScore} className="admin-add-score-form">
          <h4>Add Score for Player</h4>
          <div className="admin-add-score-grid">
            <div className="admin-field">
              <label>Player</label>
              <select
                required
                value={addFields.player_id}
                onChange={e => setAddFields(f => ({ ...f, player_id: e.target.value }))}
                className="admin-inline-input"
              >
                <option value="">Select player…</option>
                {players.map(p => <option key={p.id} value={p.id}>{p.username}</option>)}
              </select>
            </div>
            <div className="admin-field">
              <label>Course</label>
              <select
                required
                value={addFields.course_id}
                onChange={e => setAddFields(f => ({ ...f, course_id: e.target.value }))}
                className="admin-inline-input"
              >
                <option value="">Select course…</option>
                {Object.entries(groupedCourses).map(([county, list]) => (
                  <optgroup key={county} label={`${county} County`}>
                    {list.map(c => <option key={c.id} value={c.id}>{c.name} ({c.holes}h)</option>)}
                  </optgroup>
                ))}
              </select>
            </div>
            <div className="admin-field">
              <label>Score</label>
              <input
                type="number" min="1" required
                className="admin-inline-input"
                value={addFields.score}
                onChange={e => setAddFields(f => ({ ...f, score: e.target.value }))}
                placeholder="e.g. 82"
              />
            </div>
            <div className="admin-field">
              <label>Holes</label>
              <select
                className="admin-inline-input"
                value={addFields.holes}
                onChange={e => setAddFields(f => ({ ...f, holes: e.target.value }))}
              >
                <option value="9">9</option>
                <option value="18">18</option>
              </select>
            </div>
            <div className="admin-field">
              <label>Date Played</label>
              <input
                type="date" required
                className="admin-inline-input"
                value={addFields.date_played}
                onChange={e => setAddFields(f => ({ ...f, date_played: e.target.value }))}
              />
            </div>
          </div>
          <div className="admin-add-score-actions">
            <button type="submit" className="btn btn-primary" disabled={adding}>
              {adding ? 'Adding…' : 'Add Score'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setShowAddForm(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {msg && <p className={msg.includes('dded') || msg.includes('pdat') || msg.includes('elet') ? 'golf-success' : 'golf-error'}>{msg}</p>}

      <div className="golf-table-wrap">
        <table className="golf-table">
          <thead>
            <tr>
              <th>Player</th>
              <th>Score</th>
              <th>Holes</th>
              <th>Date</th>
              <th>Course</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {scores.length === 0 && (
              <tr><td colSpan={6} className="golf-empty">No scores found.</td></tr>
            )}
            {scores.map(s => (
              <tr key={s.id}>
                <td>{s.username}</td>
                {editId === s.id ? (
                  <>
                    <td>
                      <input
                        type="number" min="1" className="admin-inline-input"
                        value={editFields.score}
                        onChange={e => setEditFields(f => ({ ...f, score: e.target.value }))}
                      />
                    </td>
                    <td>
                      <select
                        className="admin-inline-input"
                        value={editFields.holes}
                        onChange={e => setEditFields(f => ({ ...f, holes: e.target.value }))}
                      >
                        <option value={9}>9</option>
                        <option value={18}>18</option>
                      </select>
                    </td>
                    <td>
                      <input
                        type="date" className="admin-inline-input"
                        value={editFields.date_played}
                        onChange={e => setEditFields(f => ({ ...f, date_played: e.target.value }))}
                      />
                    </td>
                    <td>
                      <select
                        className="admin-inline-input"
                        value={editFields.course_id}
                        onChange={e => setEditFields(f => ({ ...f, course_id: e.target.value }))}
                      >
                        <option value="">— No course —</option>
                        {Object.entries(groupedCourses).map(([county, list]) => (
                          <optgroup key={county} label={`${county} County`}>
                            {list.map(c => (
                              <option key={c.id} value={c.id}>{c.name} ({c.holes}h)</option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </td>
                    <td className="admin-actions">
                      <button className="btn btn-small btn-primary" onClick={() => saveEdit(s.id)} disabled={saving}>Save</button>
                      <button className="btn btn-small btn-secondary" onClick={() => setEditId(null)}>Cancel</button>
                    </td>
                  </>
                ) : (
                  <>
                    <td>{s.score}</td>
                    <td>{s.holes}</td>
                    <td>{s.date_played}</td>
                    <td>{s.course_name || '—'}</td>
                    <td className="admin-actions">
                      <button className="btn btn-small btn-secondary" onClick={() => startEdit(s)}>Edit</button>
                      <button className="btn btn-small btn-danger" onClick={() => deleteScore(s.id)}>Delete</button>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Players Tab (combined Accounts + Profiles) ──────────────────────────────

function PlayersTab() {
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editId, setEditId] = useState(null)
  const [editFields, setEditFields] = useState({})
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [showArchived, setShowArchived] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try { setPlayers(await adminGetPlayers()) }
    catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  function startEdit(p) {
    setEditId(p.id)
    setEditFields({
      first_name: p.first_name || '',
      last_name: p.last_name || '',
      username: p.username,
      email: p.email || '',
      phone: formatPhoneInput(p.phone || ''),
      role: p.role,
      password: '',
    })
    setMsg('')
  }

  async function saveEdit(id) {
    setSaving(true)
    setMsg('')
    try {
      const fields = { ...editFields }
      if (!fields.password) delete fields.password
      const updated = await adminUpdatePlayer(id, fields)
      setPlayers(prev => prev.map(p => p.id === id ? { ...p, ...updated } : p))
      setEditId(null)
      setMsg('Player updated.')
    } catch (e) { setMsg(e.message) }
    finally { setSaving(false) }
  }

  async function archivePlayer(id, username) {
    if (!confirm(`Archive "${username}"? They will be hidden from the leaderboard but their data is preserved.`)) return
    try {
      await adminArchivePlayer(id)
      setPlayers(prev => prev.map(p => p.id === id ? { ...p, archived: 1 } : p))
      setMsg(`"${username}" archived.`)
    } catch (e) { setMsg(e.message) }
  }

  async function unarchivePlayer(id, username) {
    if (!confirm(`Restore "${username}" to active status?`)) return
    try {
      await adminUnarchivePlayer(id)
      setPlayers(prev => prev.map(p => p.id === id ? { ...p, archived: 0 } : p))
      setMsg(`"${username}" restored.`)
    } catch (e) { setMsg(e.message) }
  }

  async function deletePlayer(id, username) {
    if (!confirm(`PERMANENTLY delete "${username}"? This cannot be undone and will delete all their scores.`)) return
    try {
      await adminDeletePlayer(id)
      setPlayers(prev => prev.filter(p => p.id !== id))
      setMsg(`"${username}" permanently deleted.`)
    } catch (e) { setMsg(e.message) }
  }

  if (loading) return <p className="golf-loading">Loading players…</p>
  if (error) return <p className="golf-error">{error}</p>

  const activePlayers = players.filter(p => !p.archived)
  const archivedPlayers = players.filter(p => p.archived)

  return (
    <div>
      <div className="admin-section-header">
        <h3>Player Management</h3>
        <span className="admin-count">{activePlayers.length} active, {archivedPlayers.length} archived</span>
      </div>
      {msg && <p className="golf-success">{msg}</p>}

      <div className="golf-table-wrap">
        <table className="golf-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Username</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Role</th>
              <th>Handicap</th>
              <th>Scores</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {activePlayers.length === 0 && (
              <tr><td colSpan={8} className="golf-empty">No active players.</td></tr>
            )}
            {activePlayers.map(p => (
              <tr key={p.id}>
                {editId === p.id ? (
                  <>
                    <td>
                      <input className="admin-inline-input" placeholder="First" value={editFields.first_name}
                        onChange={e => setEditFields(f => ({ ...f, first_name: e.target.value }))} />
                      <input className="admin-inline-input" placeholder="Last" value={editFields.last_name}
                        onChange={e => setEditFields(f => ({ ...f, last_name: e.target.value }))} style={{marginTop: 4}} />
                    </td>
                    <td>
                      <input className="admin-inline-input" value={editFields.username}
                        onChange={e => setEditFields(f => ({ ...f, username: e.target.value }))} />
                    </td>
                    <td>
                      <input type="email" className="admin-inline-input" value={editFields.email}
                        onChange={e => setEditFields(f => ({ ...f, email: e.target.value }))} />
                    </td>
                    <td>
                      <input type="tel" className="admin-inline-input" value={editFields.phone}
                        onChange={e => setEditFields(f => ({ ...f, phone: formatPhoneInput(e.target.value) }))} maxLength={12} />
                    </td>
                    <td>
                      <select className="admin-inline-input" value={editFields.role}
                        onChange={e => setEditFields(f => ({ ...f, role: e.target.value }))}>
                        <option value="player">player</option>
                        <option value="admin">admin</option>
                      </select>
                    </td>
                    <td>{p.handicap_index != null ? p.handicap_index.toFixed(1) : '—'}</td>
                    <td>{p.score_count}</td>
                    <td className="admin-actions">
                      <button className="btn btn-small btn-primary" onClick={() => saveEdit(p.id)} disabled={saving}>Save</button>
                      <button className="btn btn-small btn-secondary" onClick={() => setEditId(null)}>Cancel</button>
                    </td>
                  </>
                ) : (
                  <>
                    <td><strong>{p.first_name || ''} {p.last_name || ''}</strong></td>
                    <td>{p.username}</td>
                    <td>{p.email || '—'}</td>
                    <td>{formatPhoneDisplay(p.phone)}</td>
                    <td><span className={`admin-role-badge ${p.role}`}>{p.role}</span></td>
                    <td>{p.handicap_index != null ? p.handicap_index.toFixed(1) : '—'}</td>
                    <td>{p.score_count}</td>
                    <td className="admin-actions">
                      <button className="btn btn-small btn-secondary" onClick={() => startEdit(p)}>Edit</button>
                      <button className="btn btn-small btn-danger" onClick={() => archivePlayer(p.id, p.username)}>Archive</button>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {archivedPlayers.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <button
            className="btn btn-secondary btn-small"
            onClick={() => setShowArchived(v => !v)}
          >
            {showArchived ? 'Hide' : 'Show'} Archived Players ({archivedPlayers.length})
          </button>
          {showArchived && (
            <div className="golf-table-wrap" style={{ marginTop: 12 }}>
              <table className="golf-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Username</th>
                    <th>Email</th>
                    <th>Scores</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {archivedPlayers.map(p => (
                    <tr key={p.id} className="schedule-row-upcoming">
                      <td>{p.first_name || ''} {p.last_name || ''}</td>
                      <td>{p.username}</td>
                      <td>{p.email || '—'}</td>
                      <td>{p.score_count}</td>
                      <td className="admin-actions">
                        <button className="btn btn-small btn-primary" onClick={() => unarchivePlayer(p.id, p.username)}>Restore</button>
                        <button className="btn btn-small btn-danger" onClick={() => deletePlayer(p.id, p.username)}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── RSVPs Tab ────────────────────────────────────────────────────────────────

function RsvpsTab() {
  const [selectedDate, setSelectedDate] = useState('')
  const [rsvps, setRsvps] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Get upcoming events for the dropdown
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
    async function load() {
      setLoading(true)
      setError('')
      try {
        setRsvps(await adminGetRsvps(selectedDate))
      } catch (e) { setError(e.message) }
      finally { setLoading(false) }
    }
    load()
  }, [selectedDate])

  const selectedEvent = WAGL_SCHEDULE.find(e => e.date === selectedDate)
  const yesRsvps = rsvps.filter(r => r.response === 'yes')
  const noRsvps = rsvps.filter(r => r.response === 'no')

  return (
    <div>
      <div className="admin-section-header">
        <h3>Player RSVPs</h3>
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
          📅 <strong>{selectedEvent.course}</strong> — {formatEventDate(selectedEvent.date)} at {selectedEvent.time}
        </div>
      )}

      {loading ? (
        <p className="golf-loading">Loading RSVPs…</p>
      ) : rsvps.length === 0 ? (
        <p className="golf-empty">No RSVPs received for this event yet.</p>
      ) : (
        <div className="rsvp-columns">
          <div className="rsvp-column rsvp-yes">
            <h4>✅ Playing ({yesRsvps.length})</h4>
            {yesRsvps.length === 0 ? (
              <p className="golf-empty">None yet</p>
            ) : (
              <ul className="rsvp-list">
                {yesRsvps.map(r => (
                  <li key={r.id}>{r.first_name || r.username} {r.last_name || ''}</li>
                ))}
              </ul>
            )}
          </div>
          <div className="rsvp-column rsvp-no">
            <h4>❌ Sitting Out ({noRsvps.length})</h4>
            {noRsvps.length === 0 ? (
              <p className="golf-empty">None</p>
            ) : (
              <ul className="rsvp-list">
                {noRsvps.map(r => (
                  <li key={r.id}>{r.first_name || r.username} {r.last_name || ''}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── CSV Import Tab ───────────────────────────────────────────────────────────

function CsvImportTab() {
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const fileRef = useRef()

  async function handleImport(e) {
    e.preventDefault()
    if (!file) { setError('Please select a CSV file.'); return }
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const res = await adminImportCsv(file)
      setResult(res)
      setFile(null)
      if (fileRef.current) fileRef.current.value = ''
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  return (
    <div className="csv-import-section">
      <div className="admin-section-header">
        <h3>Import Historical Scores via CSV</h3>
      </div>
      <div className="csv-format-info">
        <p><strong>Required CSV columns:</strong> <code>username</code>, <code>score</code>, <code>date_played</code></p>
        <p><strong>Optional columns:</strong> <code>holes</code> (9 or 18, defaults to 18), <code>course_id</code></p>
        <p><strong>Date format:</strong> YYYY-MM-DD &nbsp;|&nbsp; <strong>Max file size:</strong> 5 MB</p>
        <details className="csv-example">
          <summary>View example CSV</summary>
          <pre>{`username,score,date_played,holes,course_id\nScottV,82,2024-06-15,18,1\nScottV,79,2024-07-01,18,2\nJohnDoe,88,2024-06-20,18`}</pre>
        </details>
      </div>
      <form onSubmit={handleImport} className="csv-upload-form">
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          onChange={e => setFile(e.target.files[0] || null)}
          className="csv-file-input"
        />
        {error && <p className="golf-error">{error}</p>}
        <button type="submit" className="btn btn-primary" disabled={loading || !file}>
          {loading ? 'Importing…' : 'Import CSV'}
        </button>
      </form>
      {result && (
        <div className="csv-result">
          <p className="golf-success">
            ✅ Import complete — <strong>{result.imported}</strong> rows imported, <strong>{result.skipped}</strong> skipped.
          </p>
          {result.errors.length > 0 && (
            <details className="csv-errors">
              <summary>{result.errors.length} row error{result.errors.length !== 1 ? 's' : ''}</summary>
              <ul>
                {result.errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  )
}
