import { useEffect, useState } from 'react'

let _setToast = null

export function showToast(message) {
  if (_setToast) _setToast(message)
}

export default function Toast() {
  const [message, setMessage] = useState('')
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    _setToast = (msg) => {
      setMessage(msg)
      setVisible(true)
      setTimeout(() => setVisible(false), 2500)
    }
    return () => { _setToast = null }
  }, [])

  return (
    <div className={`cart-toast ${visible ? 'show' : ''}`} role="status" aria-live="polite">
      {message}
    </div>
  )
}
