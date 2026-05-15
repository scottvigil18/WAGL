/**
 * Formats a phone input value to xxx-xxx-xxxx as the user types.
 * Strips non-digits, then inserts dashes after positions 3 and 6.
 */
export function formatPhoneInput(value) {
  const digits = value.replace(/\D/g, '').slice(0, 10)
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
}

/**
 * Formats a stored phone number for display as xxx-xxx-xxxx.
 * If already formatted or not 10 digits, returns as-is.
 */
export function formatPhoneDisplay(phone) {
  if (!phone) return '—'
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  return phone
}
