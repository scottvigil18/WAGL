const BASE = '/api/cart'

function headers(sessionId) {
  return {
    'Content-Type': 'application/json',
    'x-session-id': sessionId,
  }
}

export async function fetchCart(sessionId) {
  const res = await fetch(BASE, { headers: headers(sessionId) })
  if (!res.ok) throw new Error('Failed to fetch cart')
  return res.json()
}

export async function addToCart(sessionId, productId, qty = 1) {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: headers(sessionId),
    body: JSON.stringify({ product_id: productId, qty }),
  })
  if (!res.ok) throw new Error('Failed to add to cart')
  return res.json()
}

export async function updateCartItem(sessionId, productId, qty) {
  const res = await fetch(`${BASE}/${productId}`, {
    method: 'PATCH',
    headers: headers(sessionId),
    body: JSON.stringify({ qty }),
  })
  if (!res.ok) throw new Error('Failed to update cart item')
  return res.json()
}

export async function removeCartItem(sessionId, productId) {
  const res = await fetch(`${BASE}/${productId}`, {
    method: 'DELETE',
    headers: headers(sessionId),
  })
  if (!res.ok) throw new Error('Failed to remove cart item')
  return res.json()
}

export async function clearCart(sessionId) {
  const res = await fetch(BASE, {
    method: 'DELETE',
    headers: headers(sessionId),
  })
  if (!res.ok) throw new Error('Failed to clear cart')
  return res.json()
}
