import { useState, useEffect, useRef } from 'react'
import {
  adminGetPlayers, adminUpdatePlayer, adminDeletePlayer,
  adminArchivePlayer, adminUnarchivePlayer, adminForcePasswordReset,
  adminApproveRegistration, adminDenyRegistration, adminGetMaxPlayers, adminSetMaxPlayers,
  adminGetScores, adminAddScore, adminUpdateScore, adminDeleteScore,
  adminGetMessages, adminMarkMessageRead, adminDeleteMessage,
  adminBroadcast, adminGetUnreadCount, getContestWinners, adminSaveContestWinner, getCourses,
} from '../api/golfApi'
import { formatPhoneInput, formatPhoneDisplay } from '../utils/formatPhone'
import { WAGL_SCHEDULE, formatEventDate } from '../utils/waglSchedule'

const TABS = ['Players', 'Scores', 'Contest Winners', 'Messages', 'Handicap']

export default function GolfAdminPage() {
  const [activeTab, setActiveTab] = useState('Players')

  useEffect(() => {
    adminGetUnreadCount().then(d => {
      if (d.count > 0) setActiveTab('Messages')
    }).catch(() => {})
  }, [])

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
        {activeTab === 'Players'         && <PlayersTab />}
        {activeTab === 'Scores'          && <ScoresTab />}
        {activeTab === 'Contest Winners' && <ContestWinnersTab />}
        {activeTab === 'Messages'        && <MessagesTab />}
        {activeTab === 'Handicap'        && <HandicapTab />}
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

  // Filters
  const [filterPlayer, setFilterPlayer] = useState('')
  const [filterCourse, setFilterCourse] = useState('')
  const [filterDate, setFilterDate] = useState('')

  // Add score form state
  const [addFields, setAddFields] = useState({ player_id: '', score: '', holes: '9', date_played: '', course_id: '' })
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

  // Apply filters
  const filteredScores = scores.filter(s => {
    if (filterPlayer && s.username !== filterPlayer) return false
    if (filterCourse && (s.course_name || '') !== filterCourse) return false
    if (filterDate && s.date_played !== filterDate) return false
    return true
  })

  // Unique values for filter dropdowns
  const uniquePlayers = [...new Set(scores.map(s => s.username))].sort()
  const uniqueCourses = [...new Set(scores.map(s => s.course_name).filter(Boolean))].sort()

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
      setAddFields({ player_id: '', score: '', holes: '9', date_played: '', course_id: '' })
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
                    {list.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
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

      <div className="admin-section-header">
        <h3>All Scores</h3>
        <span className="admin-count">{filteredScores.length} of {scores.length} records</span>
        <button
          className="btn btn-small btn-primary"
          style={{ marginLeft: 'auto' }}
          onClick={() => { setShowAddForm(v => !v); setMsg('') }}
        >
          {showAddForm ? 'Cancel' : '+ Add Score'}
        </button>
      </div>

      <div className="admin-filters">
        <select value={filterPlayer} onChange={e => setFilterPlayer(e.target.value)} className="admin-inline-input">
          <option value="">All Players</option>
          {uniquePlayers.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={filterCourse} onChange={e => setFilterCourse(e.target.value)} className="admin-inline-input">
          <option value="">All Courses</option>
          {uniqueCourses.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <input
          type="date"
          value={filterDate}
          onChange={e => setFilterDate(e.target.value)}
          className="admin-inline-input"
          title="Filter by date"
        />
        {(filterPlayer || filterCourse || filterDate) && (
          <button className="btn btn-small btn-secondary" onClick={() => { setFilterPlayer(''); setFilterCourse(''); setFilterDate('') }}>
            Clear Filters
          </button>
        )}
      </div>

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
            {filteredScores.length === 0 && (
              <tr><td colSpan={6} className="golf-empty">No scores found.</td></tr>
            )}
            {filteredScores.map(s => (
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
                              <option key={c.id} value={c.id}>{c.name}</option>
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
  const [maxPlayers, setMaxPlayers] = useState(50)
  const [currentCount, setCurrentCount] = useState(0)
  const [selectedActive, setSelectedActive] = useState(new Set())
  const [selectedArchived, setSelectedArchived] = useState(new Set())

  useEffect(() => { load() }, [])
  useEffect(() => {
    adminGetMaxPlayers().then(d => { setMaxPlayers(d.max_players); setCurrentCount(d.current_count) }).catch(() => {})
  }, [])

  async function load() {
    setLoading(true)
    try { setPlayers(await adminGetPlayers()) }
    catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  async function adjustMaxPlayers(delta) {
    const newVal = Math.max(0, Math.min(100, maxPlayers + delta))
    setMaxPlayers(newVal)
    try { await adminSetMaxPlayers(newVal) } catch (e) { setMsg(e.message) }
  }

  async function bulkArchive() {
    if (selectedActive.size === 0) return
    if (!confirm(`Archive ${selectedActive.size} selected player(s)?`)) return
    for (const id of selectedActive) {
      try { await adminArchivePlayer(id) } catch (e) { /* continue */ }
    }
    setPlayers(prev => prev.map(p => selectedActive.has(p.id) ? { ...p, archived: 1 } : p))
    setSelectedActive(new Set())
    setMsg(`${selectedActive.size} player(s) archived.`)
  }

  async function bulkActivate() {
    if (selectedArchived.size === 0) return
    if (!confirm(`Restore ${selectedArchived.size} selected player(s)?`)) return
    for (const id of selectedArchived) {
      try { await adminUnarchivePlayer(id) } catch (e) { /* continue */ }
    }
    setPlayers(prev => prev.map(p => selectedArchived.has(p.id) ? { ...p, archived: 0 } : p))
    setSelectedArchived(new Set())
    setMsg(`${selectedArchived.size} player(s) restored.`)
  }

  function toggleActiveSelect(id) {
    setSelectedActive(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function toggleArchivedSelect(id) {
    setSelectedArchived(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function selectAllActive() {
    if (selectedActive.size === activePlayers.length) setSelectedActive(new Set())
    else setSelectedActive(new Set(activePlayers.map(p => p.id)))
  }

  function selectAllArchived() {
    if (selectedArchived.size === archivedPlayers.length) setSelectedArchived(new Set())
    else setSelectedArchived(new Set(archivedPlayers.map(p => p.id)))
  }

  function exportPlayersCsv() {
    const rows = [['First Name', 'Last Name', 'Username', 'Email', 'Phone', 'Handicap', 'Scores', 'Role', 'Joined']]
    for (const p of activePlayers) {
      rows.push([
        p.first_name || '', p.last_name || '', p.username,
        p.email || '', p.phone || '',
        p.handicap_index != null ? p.handicap_index : '',
        p.score_count || 0, p.role,
        p.created_at ? p.created_at.slice(0, 10) : ''
      ])
    }
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `wagl-players-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
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

  async function forceReset(id, username) {
    if (!confirm(`Force "${username}" to reset their password on next login?`)) return
    try {
      await adminForcePasswordReset(id)
      setMsg(`Password reset forced for "${username}".`)
    } catch (e) { setMsg(e.message) }
  }

  async function approveReg(id, username) {
    try {
      await adminApproveRegistration(id)
      setPlayers(prev => prev.map(p => p.id === id ? { ...p, pending_approval: 0 } : p))
      setMsg(`"${username}" approved!`)
    } catch (e) { setMsg(e.message) }
  }

  async function denyReg(id, username) {
    if (!confirm(`Deny and delete "${username}"'s registration?`)) return
    try {
      await adminDenyRegistration(id)
      setPlayers(prev => prev.filter(p => p.id !== id))
      setMsg(`"${username}" denied.`)
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

  const pendingPlayers = players.filter(p => p.pending_approval === 1)
  const activePlayers = players.filter(p => !p.archived && !p.pending_approval && p.role !== 'admin')
  const archivedPlayers = players.filter(p => p.archived && p.role !== 'admin')

  return (
    <div>
      <div className="admin-section-header">
        <h3>Player Management</h3>
        <span className="admin-count">{activePlayers.length} active, {archivedPlayers.length} archived{pendingPlayers.length > 0 ? `, ${pendingPlayers.length} pending` : ''}</span>
        <div className="tee-actions">
          <button className="btn btn-small btn-secondary" onClick={exportPlayersCsv}>📥 Export CSV</button>
        </div>
        <div className="start-time-adjuster" style={{ marginLeft: 'auto' }}>
          <span className="weekly-label">Max Players:</span>
          <button className="btn btn-small btn-secondary" onClick={() => adjustMaxPlayers(-1)}>▼</button>
          <span className="start-time-display">{maxPlayers}</span>
          <button className="btn btn-small btn-secondary" onClick={() => adjustMaxPlayers(1)}>▲</button>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>({currentCount} active)</span>
        </div>
      </div>
      {msg && <p className="golf-success">{msg}</p>}

      {pendingPlayers.length > 0 && (
        <div className="pending-photos-section" style={{ marginBottom: 20 }}>
          <h3>⏳ Pending Registrations ({pendingPlayers.length})</h3>
          <div className="golf-table-wrap">
            <table className="golf-table" style={{ tableLayout: 'auto' }}>
              <thead>
                <tr><th>Name</th><th>Username</th><th>Email</th><th>Phone</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {pendingPlayers.map(p => (
                  <tr key={p.id}>
                    <td><strong>{p.first_name} {p.last_name}</strong></td>
                    <td>{p.username}</td>
                    <td>{p.email || '—'}</td>
                    <td>{p.phone || '—'}</td>
                    <td className="admin-actions">
                      <button className="btn btn-small btn-primary" onClick={() => approveReg(p.id, p.username)}>✓ Approve</button>
                      <button className="btn btn-small btn-danger" onClick={() => denyReg(p.id, p.username)}>✕ Deny</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selectedActive.size > 0 && (
        <div style={{ marginBottom: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: '0.85rem' }}>{selectedActive.size} selected</span>
          <button className="btn btn-small btn-danger" onClick={bulkArchive}>Archive Selected</button>
        </div>
      )}

      <div className="golf-table-wrap">
        <table className="golf-table">
          <thead>
            <tr>
              <th style={{width: 30}}><input type="checkbox" checked={selectedActive.size === activePlayers.length && activePlayers.length > 0} onChange={selectAllActive} /></th>
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
              <tr><td colSpan={9} className="golf-empty">No active players.</td></tr>
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
                    <td><input type="checkbox" checked={selectedActive.has(p.id)} onChange={() => toggleActiveSelect(p.id)} /></td>
                    <td><strong>{p.first_name || ''} {p.last_name || ''}</strong></td>
                    <td>{p.username}</td>
                    <td>{p.email || '—'}</td>
                    <td>{formatPhoneDisplay(p.phone)}</td>
                    <td><span className={`admin-role-badge ${p.role}`}>{p.role}</span></td>
                    <td>{p.handicap_index != null ? p.handicap_index.toFixed(1) : '—'}</td>
                    <td>{p.score_count}</td>
                    <td className="admin-actions">
                      <button className="btn btn-small btn-secondary" onClick={() => startEdit(p)}>Edit</button>
                      <button className="btn btn-small btn-secondary" onClick={() => forceReset(p.id, p.username)} title="Force password reset">🔒</button>
                      <button className="btn btn-small btn-danger" onClick={() => archivePlayer(p.id, p.username)}>Archive</button>
                      <button className="btn btn-small btn-danger" onClick={() => deletePlayer(p.id, p.username)} title="Permanently delete">🗑️</button>
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
            <>
            {selectedArchived.size > 0 && (
              <div style={{ marginTop: 10, marginBottom: 6, display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem' }}>{selectedArchived.size} selected</span>
                <button className="btn btn-small btn-primary" onClick={bulkActivate}>Restore Selected</button>
              </div>
            )}
            <div className="golf-table-wrap" style={{ marginTop: 12 }}>
              <table className="golf-table">
                <thead>
                  <tr>
                    <th style={{width: 30}}><input type="checkbox" checked={selectedArchived.size === archivedPlayers.length && archivedPlayers.length > 0} onChange={selectAllArchived} /></th>
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
                      <td><input type="checkbox" checked={selectedArchived.has(p.id)} onChange={() => toggleArchivedSelect(p.id)} /></td>
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
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Contest Winners Tab ──────────────────────────────────────────────────────

function ContestWinnersTab() {
  const [players, setPlayers] = useState([])
  const [selectedDate, setSelectedDate] = useState('')
  const [mensClosest, setMensClosest] = useState('')
  const [womensClosest, setWomensClosest] = useState('')
  const [longestPutt, setLongestPutt] = useState('')
  const [mensDistance, setMensDistance] = useState('')
  const [womensDistance, setWomensDistance] = useState('')
  const [puttDistance, setPuttDistance] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [existingWinners, setExistingWinners] = useState([])

  const today = new Date()
  today.setHours(23, 59, 59, 999)
  const playedEvents = WAGL_SCHEDULE.filter(evt => new Date(evt.date + 'T00:00:00') <= today)

  useEffect(() => {
    adminGetPlayers().then(p => setPlayers(p.filter(pl => pl.role === 'player' && !pl.archived))).catch(() => {})
    if (playedEvents.length > 0) {
      setSelectedDate(playedEvents[playedEvents.length - 1].date)
    }
  }, [])

  useEffect(() => {
    if (!selectedDate) return
    getContestWinners(selectedDate).then(winners => {
      setExistingWinners(winners)
      const mc = winners.find(w => w.category === 'mens_closest')
      const wc = winners.find(w => w.category === 'womens_closest')
      const lp = winners.find(w => w.category === 'longest_putt')
      setMensClosest(mc?.player_id ? String(mc.player_id) : '')
      setWomensClosest(wc?.player_id ? String(wc.player_id) : '')
      setLongestPutt(lp?.player_id ? String(lp.player_id) : '')
      setMensDistance(mc?.distance || '')
      setWomensDistance(wc?.distance || '')
      setPuttDistance(lp?.distance || '')
    }).catch(() => {})
  }, [selectedDate])

  function getPlayerName(id) {
    const p = players.find(pl => String(pl.id) === String(id))
    return p ? `${p.first_name || p.username} ${p.last_name || ''}`.trim() : ''
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setMsg('')
    try {
      if (mensClosest) {
        await adminSaveContestWinner(selectedDate, 'mens_closest', getPlayerName(mensClosest), parseInt(mensClosest, 10), mensDistance)
      }
      if (womensClosest) {
        await adminSaveContestWinner(selectedDate, 'womens_closest', getPlayerName(womensClosest), parseInt(womensClosest, 10), womensDistance)
      }
      if (longestPutt) {
        await adminSaveContestWinner(selectedDate, 'longest_putt', getPlayerName(longestPutt), parseInt(longestPutt, 10), puttDistance)
      }
      setMsg('Contest winners saved!')
    } catch (e) { setMsg(e.message) }
    finally { setSaving(false) }
  }

  const selectedEvent = WAGL_SCHEDULE.find(e => e.date === selectedDate)

  return (
    <div>
      <div className="admin-section-header">
        <h3>Set Contest Winners</h3>
      </div>

      <div className="weekly-controls" style={{ marginBottom: 16 }}>
        <label className="weekly-label">Event:</label>
        <select
          className="weekly-select"
          value={selectedDate}
          onChange={e => setSelectedDate(e.target.value)}
        >
          {[...playedEvents].reverse().map(evt => (
            <option key={evt.date} value={evt.date}>
              Event {evt.event} — {formatEventDate(evt.date)} — {evt.course}
            </option>
          ))}
        </select>
      </div>

      {selectedEvent && (
        <div className="par-info-banner" style={{ marginBottom: 16 }}>
          📅 <strong>{selectedEvent.course}</strong> — {formatEventDate(selectedEvent.date)}
        </div>
      )}

      <form onSubmit={handleSave} className="contest-form">
        <div className="contest-form-row">
          <label>🎯 Men's Closest to the Hole</label>
          <select value={mensClosest} onChange={e => setMensClosest(e.target.value)} className="admin-inline-input">
            <option value="">— Select player —</option>
            {players.map(p => <option key={p.id} value={p.id}>{p.first_name || p.username} {p.last_name || ''}</option>)}
          </select>
          <input type="text" value={mensDistance} onChange={e => setMensDistance(e.target.value)} placeholder="Distance (e.g. 4'2&quot;)" className="admin-inline-input" style={{ maxWidth: 120 }} />
        </div>

        <div className="contest-form-row">
          <label>🎯 Women's Closest to the Hole</label>
          <select value={womensClosest} onChange={e => setWomensClosest(e.target.value)} className="admin-inline-input">
            <option value="">— Select player —</option>
            {players.map(p => <option key={p.id} value={p.id}>{p.first_name || p.username} {p.last_name || ''}</option>)}
          </select>
          <input type="text" value={womensDistance} onChange={e => setWomensDistance(e.target.value)} placeholder="Distance (e.g. 6'8&quot;)" className="admin-inline-input" style={{ maxWidth: 120 }} />
        </div>

        <div className="contest-form-row">
          <label>🏌️ Longest Putt</label>
          <select value={longestPutt} onChange={e => setLongestPutt(e.target.value)} className="admin-inline-input">
            <option value="">— Select player —</option>
            {players.map(p => <option key={p.id} value={p.id}>{p.first_name || p.username} {p.last_name || ''}</option>)}
          </select>
          <input type="text" value={puttDistance} onChange={e => setPuttDistance(e.target.value)} placeholder="Distance (e.g. 22')" className="admin-inline-input" style={{ maxWidth: 120 }} />
        </div>

        {msg && <p className={msg.includes('saved') ? 'golf-success' : 'golf-error'}>{msg}</p>}
        <button type="submit" className="btn btn-primary" disabled={saving} style={{ marginTop: 12 }}>
          {saving ? 'Saving…' : 'Save Winners'}
        </button>
      </form>
    </div>
  )
}

// ─── Handicap Tab ─────────────────────────────────────────────────────────────

function HandicapTab() {
  return (
    <div>
      <div className="admin-section-header">
        <h3>Handicap Calculation Method</h3>
      </div>
      <div className="handicap-explanation">
        <h4>WAGL Handicap Formula</h4>
        <p>The WAGL handicap represents a player's average strokes <strong>over par</strong> for 9 holes, rounded to the nearest whole number.</p>

        <div className="handicap-steps">
          <div className="handicap-step">
            <span className="handicap-step-num">1</span>
            <div>
              <strong>Collect Recent Scores</strong>
              <p>Take the player's last 20 scores (or all scores if fewer than 20).</p>
            </div>
          </div>
          <div className="handicap-step">
            <span className="handicap-step-num">2</span>
            <div>
              <strong>Calculate Over Par</strong>
              <p>For each score, subtract par (36 for 9 holes).</p>
              <p className="handicap-example">Example: Score of 42 → 42 - 36 = <strong>6 over par</strong></p>
            </div>
          </div>
          <div className="handicap-step">
            <span className="handicap-step-num">3</span>
            <div>
              <strong>Use Best 75%</strong>
              <p>Sort the over-par values from lowest to highest. Use only the best 75% (drop the worst 25%).</p>
              <p className="handicap-example">Example: 20 scores → use the best 15</p>
            </div>
          </div>
          <div className="handicap-step">
            <span className="handicap-step-num">4</span>
            <div>
              <strong>Average & Round</strong>
              <p>Average the remaining over-par values and round to the nearest whole number.</p>
              <p className="handicap-example">Example: Average of best 15 = 8.3 → Handicap = <strong>8</strong></p>
            </div>
          </div>
        </div>

        <h4 style={{marginTop: 24}}>Weekly Points System</h4>
        <table className="golf-table" style={{maxWidth: 500, tableLayout: 'auto'}}>
          <thead>
            <tr><th>Component</th><th>Points</th><th>Description</th></tr>
          </thead>
          <tbody>
            <tr><td>Base</td><td><strong>3</strong></td><td>Awarded for playing (everyone who submits a score)</td></tr>
            <tr><td>Bonus</td><td><strong>0–4</strong></td><td>Based on performance within flight (best = 4, worst = 0)</td></tr>
            <tr><td>Total</td><td><strong>3–7</strong></td><td>Maximum possible per week</td></tr>
          </tbody>
        </table>

        <h4 style={{marginTop: 24}}>Flight Assignments</h4>
        <p>Players are divided into 3 flights based on handicap:</p>
        <ul>
          <li><strong>Low Flight</strong> — Top third (lowest handicaps)</li>
          <li><strong>Mid Flight</strong> — Middle third</li>
          <li><strong>High Flight</strong> — Bottom third (highest handicaps)</li>
        </ul>
        <p>Bonus points are calculated <em>within</em> each flight, so players compete against others of similar skill level.</p>

        <h4 style={{marginTop: 24}}>Key Rules</h4>
        <ul>
          <li>Par for 9 holes = 36</li>
          <li>Handicaps persist across seasons (not deleted when scores are archived)</li>
          <li>Handicaps update automatically when new scores are submitted</li>
          <li>Season total points accumulate across all weeks in the selected year</li>
        </ul>
      </div>
    </div>
  )
}

// ─── Messages Tab ─────────────────────────────────────────────────────────────

function MessagesTab() {
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expandedId, setExpandedId] = useState(null)
  // Broadcast state
  const [showBroadcast, setShowBroadcast] = useState(false)
  const [bcSubject, setBcSubject] = useState('')
  const [bcBody, setBcBody] = useState('')
  const [bcRecipient, setBcRecipient] = useState('all') // 'all' or player id
  const [bcSending, setBcSending] = useState(false)
  const [bcResult, setBcResult] = useState(null)
  const [bcPlayers, setBcPlayers] = useState([])
  const [bcMode, setBcMode] = useState('') // '' | 'group' | 'individual' | 'reply'

  useEffect(() => { load() }, [])
  useEffect(() => {
    adminGetPlayers().then(p => setBcPlayers(p.filter(pl => pl.role === 'player' && !pl.archived))).catch(() => {})
  }, [])

  async function load() {
    setLoading(true)
    try { setMessages(await adminGetMessages()) }
    catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  async function markRead(id) {
    try {
      await adminMarkMessageRead(id)
      setMessages(prev => prev.map(m => m.id === id ? { ...m, read: 1 } : m))
      window.dispatchEvent(new Event('messages-updated'))
    } catch (e) { /* ignore */ }
  }

  async function deleteMsg(id) {
    if (!confirm('Delete this message?')) return
    try {
      await adminDeleteMessage(id)
      setMessages(prev => prev.filter(m => m.id !== id))
      window.dispatchEvent(new Event('messages-updated'))
    } catch (e) { /* ignore */ }
  }

  function toggleExpand(msg) {
    if (expandedId === msg.id) {
      setExpandedId(null)
    } else {
      setExpandedId(msg.id)
      if (!msg.read) markRead(msg.id)
    }
  }

  async function handleBroadcast(e) {
    e.preventDefault()
    setBcSending(true)
    setBcResult(null)
    try {
      const playerId = bcRecipient === 'all' ? undefined : parseInt(bcRecipient, 10)
      const result = await adminBroadcast(bcSubject, bcBody, playerId)
      setBcResult(result)
      setBcSubject('')
      setBcBody('')
      setBcRecipient('all')
    } catch (e) { setBcResult({ error: e.message }) }
    finally { setBcSending(false) }
  }

  function openGroupCompose() {
    setBcMode('group')
    setBcRecipient('all')
    setBcSubject('')
    setBcBody('')
    setBcResult(null)
    setShowBroadcast(true)
  }

  function openIndividualCompose() {
    setBcMode('individual')
    setBcRecipient('')
    setBcSubject('')
    setBcBody('')
    setBcResult(null)
    setShowBroadcast(true)
  }

  function openReply(msg) {
    setBcMode('reply')
    setBcRecipient(String(msg.player_id))
    setBcSubject(`Re: ${msg.subject}`)
    setBcBody('')
    setBcResult(null)
    setShowBroadcast(true)
    setExpandedId(null)
  }

  function closeCompose() {
    setShowBroadcast(false)
    setBcMode('')
  }

  if (loading) return <p className="golf-loading">Loading messages…</p>
  if (error) return <p className="golf-error">{error}</p>

  const unread = messages.filter(m => !m.read).length

  return (
    <div>
      {/* Compose buttons */}
      <div className="admin-section-header">
        <h3>Send Message</h3>
        <div className="tee-actions">
          <button className="btn btn-small btn-primary" onClick={openGroupCompose}>
            📢 Group Announcement
          </button>
          <button className="btn btn-small btn-secondary" onClick={openIndividualCompose}>
            📨 Individual Message
          </button>
          {showBroadcast && (
            <button className="btn btn-small btn-secondary" onClick={closeCompose}>Cancel</button>
          )}
        </div>
      </div>

      {showBroadcast && (
        <form onSubmit={handleBroadcast} className="admin-add-score-form" style={{ marginBottom: 24 }}>
          <h4>{bcMode === 'group' ? '📢 Send to All Members' : bcMode === 'reply' ? '↩️ Reply to Member' : '📨 Send to Individual'}</h4>
          <div className="golf-form">
            {bcMode !== 'group' && (
              <>
                <label>To</label>
                <select value={bcRecipient} onChange={e => setBcRecipient(e.target.value)} required style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: '0.95rem' }}>
                  <option value="">— Select player —</option>
                  {bcPlayers.map(p => (
                    <option key={p.id} value={p.id}>👤 {p.first_name || p.username} {p.last_name || ''}</option>
                  ))}
                </select>
              </>
            )}
            <label>Subject</label>
            <input type="text" value={bcSubject} onChange={e => setBcSubject(e.target.value)} required placeholder="Message subject" />
            <label>Message</label>
            <textarea value={bcBody} onChange={e => setBcBody(e.target.value)} required rows={4} placeholder="Type your message…" style={{ padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 8, fontSize: '0.95rem', fontFamily: 'inherit', resize: 'vertical' }} />
          </div>
          <div className="admin-add-score-actions" style={{ marginTop: 12 }}>
            <button type="submit" className="btn btn-primary" disabled={bcSending || (bcMode !== 'group' && !bcRecipient)}>
              {bcSending ? 'Sending…' : bcMode === 'group' ? '📢 Send to All' : '📨 Send'}
            </button>
          </div>
          {bcResult && !bcResult.error && (
            <div style={{ marginTop: 12 }}>
              <p className="golf-success">✅ {bcResult.message}</p>
              {bcResult.phones && bcResult.phones.length > 0 && (
                <details style={{ marginTop: 8 }}>
                  <summary style={{ cursor: 'pointer', fontSize: '0.85rem', color: '#166534', fontWeight: 600 }}>
                    📱 Copy phone numbers for text ({bcResult.phones.length})
                  </summary>
                  <pre style={{ background: '#f1f5f9', padding: 10, borderRadius: 6, fontSize: '0.8rem', marginTop: 6, whiteSpace: 'pre-wrap' }}>
                    {bcResult.phones.map(p => `${p.name}: ${p.phone}`).join('\n')}
                  </pre>
                </details>
              )}
            </div>
          )}
          {bcResult && bcResult.error && <p className="golf-error">{bcResult.error}</p>}
        </form>
      )}

      {/* Inbox */}
      <div className="admin-section-header">
        <h3>Member Messages</h3>
        {unread > 0 && <span className="nav-badge">{unread}</span>}
        <span className="admin-count">{messages.length} total</span>
      </div>

      {messages.length === 0 ? (
        <p className="golf-empty">No messages.</p>
      ) : (
        <div className="messages-list">
          {messages.map(msg => (
            <div key={msg.id} className={`message-item${!msg.read ? ' unread' : ''}`}>
              <div className="message-header" onClick={() => toggleExpand(msg)}>
                <span className="message-from">{msg.first_name || msg.username} {msg.last_name || ''}</span>
                <span className="message-subject">{msg.subject}</span>
                <span className="message-date">{msg.created_at ? msg.created_at.slice(0, 16).replace('T', ' ') : ''}</span>
                {!msg.read && <span className="message-unread-dot" />}
              </div>
              {expandedId === msg.id && (
                <div className="message-body-section">
                  <p className="message-body-text">{msg.body}</p>
                  <div className="message-actions">
                    <button className="btn btn-small btn-primary" onClick={() => openReply(msg)}>↩️ Reply</button>
                    <button className="btn btn-small btn-danger" onClick={() => deleteMsg(msg.id)}>Delete</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}


