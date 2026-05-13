import { useState, useEffect } from 'react'
import { fetchProduct } from '../api/productsApi'
import { addToCart } from '../api/cartApi'
import Stars from '../components/Stars'
import Toast, { showToast } from '../components/Toast'

export default function ProductPage({ productId, sessionId, onCartChange }) {
  const [product, setProduct] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const [qty, setQty]         = useState(1)
  const [adding, setAdding]   = useState(false)
  const [feedback, setFeedback] = useState('')

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetchProduct(productId)
      .then(data => { setProduct(data); setQty(1) })
      .catch(() => setError('Product not found.'))
      .finally(() => setLoading(false))
  }, [productId])

  function changeQty(delta) {
    setQty(q => Math.max(1, Math.min(product.stock, q + delta)))
  }

  async function handleAddToCart() {
    setAdding(true)
    try {
      await addToCart(sessionId, product.id, qty)
      await onCartChange()
      setFeedback(`✅ ${qty} × "${product.name}" added to cart!`)
      showToast(`✅ Added to cart!`)
      setTimeout(() => setFeedback(''), 3000)
    } catch {
      setFeedback('❌ Failed to add item. Please try again.')
    } finally {
      setAdding(false)
    }
  }

  if (loading) return (
    <div className="container">
      <div className="loading-detail">
        <div className="skeleton-detail-img" />
        <div className="skeleton-detail-info">
          <div className="skeleton-line" />
          <div className="skeleton-line short" />
          <div className="skeleton-line" />
        </div>
      </div>
    </div>
  )

  if (error) return (
    <div className="container">
      <p className="error-msg">{error} <a href="#/">Go back</a></p>
    </div>
  )

  const discount = product.original_price
    ? Math.round((1 - product.price / product.original_price) * 100)
    : null

  return (
    <>
      <Toast />
      <div className="container product-detail-page">
        {/* Breadcrumb */}
        <nav className="breadcrumb" aria-label="Breadcrumb">
          <a href="#/">Home</a>
          <span aria-hidden="true"> › </span>
          <span>{product.category}</span>
          <span aria-hidden="true"> › </span>
          <span>{product.name}</span>
        </nav>

        {/* Main grid */}
        <div className="product-detail-grid">
          {/* Image panel */}
          <div className="product-detail-image">
            {product.image_url
              ? <img
                  src={product.image_url}
                  alt={product.name}
                  className="product-detail-photo"
                  onError={e => { e.currentTarget.style.display = 'none'; e.currentTarget.nextSibling.style.display = 'flex'; }}
                />
              : null}
            <div
              className="product-emoji-large"
              role="img"
              aria-label={product.name}
              style={{ display: product.image_url ? 'none' : 'flex' }}
            >
              {product.emoji}
            </div>
            {product.badge && (
              <div className="product-badges">
                <span className={`badge badge-${product.badge.toLowerCase().replace(' ', '-')}`}>
                  {product.badge}
                </span>
              </div>
            )}
          </div>

          {/* Info panel */}
          <div className="product-detail-info">
            <span className="product-category">{product.category}</span>
            <h1 className="product-detail-name">{product.name}</h1>

            <div className="product-rating large">
              <Stars rating={product.rating} size="lg" />
              <span className="rating-value">{product.rating}</span>
              <span className="review-count">({product.reviews?.length ?? 0} reviews)</span>
            </div>

            <p className="product-detail-price">${product.price.toFixed(2)}</p>
            {product.original_price && (
              <p className="original-price">
                Was: <s>${product.original_price.toFixed(2)}</s>{' '}
                <span className="discount">{discount}% off</span>
              </p>
            )}

            <p className="product-detail-desc">{product.description}</p>

            <ul className="product-features">
              {product.features.map((f, i) => (
                <li key={i}>✅ {f}</li>
              ))}
            </ul>

            <div className={`stock-status ${product.stock > 0 ? 'in-stock' : 'out-of-stock'}`}>
              {product.stock > 0
                ? `✅ In Stock (${product.stock} available)`
                : '❌ Out of Stock'}
            </div>

            {/* Qty + Add to Cart */}
            <div className="add-to-cart-row">
              <div className="qty-control" role="group" aria-label="Quantity">
                <button
                  className="qty-btn"
                  onClick={() => changeQty(-1)}
                  aria-label="Decrease quantity"
                  disabled={qty <= 1}
                >−</button>
                <input
                  type="number"
                  className="qty-input"
                  value={qty}
                  min={1}
                  max={product.stock}
                  onChange={e => setQty(Math.max(1, Math.min(product.stock, parseInt(e.target.value) || 1)))}
                  aria-label="Quantity"
                />
                <button
                  className="qty-btn"
                  onClick={() => changeQty(1)}
                  aria-label="Increase quantity"
                  disabled={qty >= product.stock}
                >+</button>
              </div>
              <button
                className="btn btn-primary btn-large"
                onClick={handleAddToCart}
                disabled={adding || product.stock === 0}
              >
                {adding ? 'Adding…' : '🛒 Add to Cart'}
              </button>
            </div>

            {feedback && (
              <div className={`cart-feedback ${feedback.startsWith('❌') ? 'error' : ''}`} role="status">
                {feedback}
              </div>
            )}

            <a href="#/cart" className="btn btn-secondary btn-large view-cart-btn">
              View Cart
            </a>
          </div>
        </div>

        {/* Reviews */}
        <section className="reviews-section" aria-label="Customer reviews">
          <h2>Customer Reviews</h2>
          {product.reviews && product.reviews.length > 0 ? (
            <div className="reviews-summary">
              <div className="reviews-avg">
                <span className="avg-score">{product.rating}</span>
                <div className="avg-stars">
                  <Stars rating={product.rating} size="lg" />
                </div>
                <span>out of 5</span>
              </div>
              <div className="reviews-list">
                {product.reviews.map(r => (
                  <div key={r.id} className="review-card">
                    <div className="review-header">
                      <span className="reviewer-name">{r.name}</span>
                      <span className="review-stars">
                        {'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}
                      </span>
                      <span className="review-date">{r.date}</span>
                    </div>
                    <p className="review-text">{r.comment}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="no-reviews">No reviews yet.</p>
          )}
        </section>
      </div>
    </>
  )
}
