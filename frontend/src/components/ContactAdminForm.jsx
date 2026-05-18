import { useState } from 'react'
import { sendMessageToAdmin } from '../api/golfApi'

export default function ContactAdminForm() {
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [formMsg, setFormMsg] = useState('')
  const [showForm, setShowForm] = useState(false)

  async function handleSend(e) {
    e.preventDefault()
    setSending(true)
    setFormMsg('')
    try {
      await sendMessageToAdmin(subject, body)
      setFormMsg('Message sent to admin!')
      setSubject('')
      setBody('')
      setShowForm(false)
    } catch (err) { setFormMsg(err.message) }
    finally { setSending(false) }
  }

  return (
    <div className="contact-admin-section">
      <h3>✉️ Contact Admin</h3>
      {!showForm ? (
        <button className="btn btn-secondary" onClick={() => setShowForm(true)}>
          Send a Message to Admin
        </button>
      ) : (
        <form onSubmit={handleSend} className="golf-form contact-form">
          <label htmlFor="msg-subject">Subject</label>
          <input
            id="msg-subject"
            type="text"
            value={subject}
            onChange={ev => setSubject(ev.target.value)}
            placeholder="What's this about?"
            required
          />
          <label htmlFor="msg-body">Message</label>
          <textarea
            id="msg-body"
            value={body}
            onChange={ev => setBody(ev.target.value)}
            placeholder="Type your message here…"
            required
            rows={4}
          />
          <div className="profile-form-actions">
            <button type="submit" className="btn btn-primary" disabled={sending}>
              {sending ? 'Sending…' : 'Send Message'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}
      {formMsg && <p className={formMsg.includes('sent') ? 'golf-success' : 'golf-error'}>{formMsg}</p>}
    </div>
  )
}
