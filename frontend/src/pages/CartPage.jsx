import { useState } from 'react'
import { updateCartItem, removeCartItem, clearCart } from '../api/cartApi'
import Toast, { showToast } from '../components/Toast'

export default function CartPage({ cart, sessionId, onCartChange, cartLoading }) {
  const [updatingId, setUpdatingId] = useState(null)
  const [checkoutDone, setCheckoutDone] = useState(false)

  async function handleQtyChange(productId, newQty) {
    setUpdatingId(productId)
    try {
      if (newQty <= 0) {
        await removeCartItem(sessionId, productId)
      } else {
        await updateCartItem(sessionId, productId, newQty)
      }
      await onCartChange()
    } catch {
      showToast('❌ Failed to update item')
    } finally {
      setUpdatingId(null)
    }
  }

  async function handleRemove(productId, name) {
    setUpdatingId(productId)
    try {
      await removeCartItem(sessionId, productId)
      await onCartChange()
      showToast(`🗑️ "${name}" removed`)
    } catch {
      showToast('❌ Failed to remove item')
    } finally {
      setUpdatingId(null)
    }
  }

  async function handleClear() {
    if (!window.confirm('Remove all items from your cart?')) return
    try {
      await clearCart(sessionId)
      await onCartChange()
      showToast('🗑️ Cart cleared')
    } catch {
      showToast('❌ Failed to clear cart')
    }
  }

  async function handleCheckout() {
    try {
      await clearCart(sessionId)
      await onCartChange()
      setCheckoutDone(true)
    } catch {
      showToast('❌ Checkout failed')
    }
  }

  function closeModal() {
    setCheckoutDone(false)
    window.location.hash = '#/'
  }

  // Totals
  const TAX_RATE  = 0.065
  const subtotal  = cart.reduce((sum, item) => sum + item.price * item.qty, 0)
  const shipping  = subtotal >= 50 ? 0 : 5.99
  const tax       = subtotal * TAX_RATE
  const total     = subtotal + shipping + tax
  const itemCount = cart.reduce((sum, item) => sum + item.qty, 0)

  if (cartLoading) {
    return (
      <div className="container cart-page">
        <h1 className="section-title">🛒 Your Shopping Cart</h1>
        <div className="loading-text">Loading cart…</div>
      </div>
    )
  }

  return (
    <>
      <Toast />
      <div className="container cart-page">
        <h1 className="section-title">🛒 Your Shopping Cart</h1>

        {cart.length === 0 ? (
          <div className="cart-empty">
            <div className="empty-icon">🛒</div>
            <h2>Your cart is empty</h2>
            <p>Looks like you haven't added anything yet.</p>
            <a href="#/" className="btn btn-primary">Start Shopping</a>
          </div>
        ) : (
          <div className="cart-layout">
            {/* Items */}
            <div className="cart-items">
              <div className="cart-header-row" aria-hidden="true">
                <span>Product</span>
                <span>Price</span>
                <span>Quantity</span>
                <span>Subtotal</span>
                <span></span>
              </div>

              {cart.map(item => (
                <div
                  key={item.product_id}
                  className={`cart-item ${updatingId === item.product_id ? 'updating' : ''}`}
                >
                  <div className="cart-item-product">
                    <a
                      href={`#/product/${item.product_id}`}
                      className="cart-item-thumb"
                      aria-label={item.name}
                    >
                      {item.image_url
                        ? <img
                            src={item.image_url}
                            alt={item.name}
                            className="cart-item-photo"
                            onError={e => { e.currentTarget.style.display = 'none'; e.currentTarget.nextSibling.style.display = 'flex'; }}
                          />
                        : null}
                      <span
                        className="cart-item-emoji"
                        style={{ display: item.image_url ? 'none' : 'flex' }}
                      >
                        {item.emoji}
                      </span>
                    </a>
                    <div className="cart-item-meta">
                      <a href={`#/product/${item.product_id}`} className="cart-item-name">
                        {item.name}
                      </a>
                      <span className="cart-item-category">{item.category}</span>
                    </div>
                  </div>

                  <span className="cart-item-price">${item.price.toFixed(2)}</span>

                  <div className="qty-control" role="group" aria-label={`Quantity for ${item.name}`}>
                    <button
                      className="qty-btn"
                      onClick={() => handleQtyChange(item.product_id, item.qty - 1)}
                      disabled={updatingId === item.product_id}
                      aria-label="Decrease quantity"
                    >−</button>
                    <input
                      type="number"
                      className="qty-input"
                      value={item.qty}
                      min={1}
                      max={item.stock}
                      onChange={e => handleQtyChange(item.product_id, parseInt(e.target.value) || 1)}
                      disabled={updatingId === item.product_id}
                      aria-label="Quantity"
                    />
                    <button
                      className="qty-btn"
                      onClick={() => handleQtyChange(item.product_id, item.qty + 1)}
                      disabled={updatingId === item.product_id || item.qty >= item.stock}
                      aria-label="Increase quantity"
                    >+</button>
                  </div>

                  <span className="cart-item-subtotal">
                    ${(item.price * item.qty).toFixed(2)}
                  </span>

                  <button
                    className="btn-delete"
                    onClick={() => handleRemove(item.product_id, item.name)}
                    disabled={updatingId === item.product_id}
                    aria-label={`Remove ${item.name}`}
                    title="Remove item"
                  >🗑️</button>
                </div>
              ))}

              <div className="cart-actions-row">
                <a href="#/" className="btn btn-secondary">← Continue Shopping</a>
                <button className="btn btn-danger" onClick={handleClear}>
                  🗑️ Clear Cart
                </button>
              </div>
            </div>

            {/* Order Summary */}
            <aside className="order-summary" aria-label="Order summary">
              <h2>Order Summary</h2>

              <div className="summary-line">
                <span>Subtotal ({itemCount} item{itemCount !== 1 ? 's' : ''})</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              <div className="summary-line">
                <span>Shipping</span>
                <span>
                  {shipping === 0
                    ? <span className="free-shipping">FREE</span>
                    : `$${shipping.toFixed(2)}`}
                </span>
              </div>
              {shipping > 0 && (
                <p className="shipping-note">
                  Add ${(50 - subtotal).toFixed(2)} more for free shipping!
                </p>
              )}
              <div className="summary-line">
                <span>Tax (6.5%)</span>
                <span>${tax.toFixed(2)}</span>
              </div>
              <div className="summary-line total-line">
                <span>Total</span>
                <span>${total.toFixed(2)}</span>
              </div>

              <button
                className="btn btn-primary btn-large btn-checkout"
                onClick={handleCheckout}
              >
                Proceed to Checkout →
              </button>

              <div className="secure-badge">🔒 Secure Checkout</div>
              <div className="accepted-payments" aria-label="Accepted payment methods">
                <span title="Credit card">💳</span>
                <span title="Bank transfer">🏦</span>
                <span title="Mobile pay">📱</span>
              </div>
            </aside>
          </div>
        )}
      </div>

      {/* Checkout success modal */}
      {checkoutDone && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
          onClick={e => e.target === e.currentTarget && closeModal()}
        >
          <div className="modal">
            <div className="modal-icon">🎉</div>
            <h2 id="modal-title">Order Placed!</h2>
            <p>Thank you for your purchase. Your order is being processed.</p>
            <button className="btn btn-primary" onClick={closeModal}>
              Continue Shopping
            </button>
          </div>
        </div>
      )}
    </>
  )
}
