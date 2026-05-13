/**
 * Generate or retrieve a persistent browser session ID.
 * Used as the cart identifier on the backend.
 */
export function getOrCreateSessionId() {
  const KEY = 'shopmart_session_id'
  let id = localStorage.getItem(KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(KEY, id)
  }
  return id
}
