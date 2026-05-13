import { useState, useEffect, useCallback } from 'react'
import { fetchProducts, fetchCategories } from '../api/productsApi'
import { addToCart } from '../api/cartApi'
import Stars from '../components/Stars'
import Toast, { showToast } from '../components/Toast'

export default function HomePage({ sessionId, onCartChange }) {
  const [products, setProducts]     = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState(null)
  const [search, setSearch]         = useState('')
  const [sort, setSort]             = useState('')
  const [category, setCategory]     = useState('')
  const [addingId, setAddingId]     = useState(null)

  // Debounced search
  const [debouncedSearch, setDebouncedSearch] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  const loadProducts = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchProducts({ search: debouncedSearch, sort, category })
      setProducts(data)
    } catch (e) {
      setError('Failed to load products. Is the backend running?')
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, sort, category])

  useEffect(() => { loadProducts() }, [loadProducts])

  useEffect(() => {
    fetchCategories().then(setCategories).catch(() => {})
  }, [])

  async function handleAddToCart(product) {
    setAddingId(product.id)
    try {
      await addToCart(sessionId, product.id, 1)
      await onCartChange()
      showToast(`✅ "${product.name}" added to cart!`)
    } catch {
      showToast('❌ Failed to add item')
    } finally {
      setAddingId(null)
    }
  }

  return (
    <>
      <Toast />
      {/* Hero */}
      <section className="hero">
        <div className="hero-content">
          <h1>Welcome to ShopMart</h1>
          <p>Discover amazing products at unbeatable prices</p>
          <a href="#products" className="btn btn-primary">Shop Now</a>
        </div>
      </section>

      <div className="container" id="products">
        <h2 className="section-title">Featured Products</h2>

        {/* Toolbar */}
        <div className="toolbar">
          <input
            type="text"
            placeholder="🔍 Search products..."
            className="search-box"
            value={search}
            onChange={e => setSearch(e.target.value)}
            aria-label="Search products"
          />
          <select
            className="sort-select"
            value={category}
            onChange={e => setCategory(e.target.value)}
            aria-label="Filter by category"
          >
            <option value="">All Categories</option>
            {categories.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select
            className="sort-select"
            value={sort}
            onChange={e => setSort(e.target.value)}
            aria-label="Sort products"
          >
            <option value="">Sort: Default</option>
            <option value="price-asc">Price: Low → High</option>
            <option value="price-desc">Price: High → Low</option>
            <option value="name-asc">Name: A → Z</option>
          </select>
        </div>

        {/* States */}
        {error && (
          <div className="error-banner" role="alert">
            ⚠️ {error}
          </div>
        )}

        {loading ? (
          <div className="loading-grid">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="product-card skeleton" aria-hidden="true">
                <div className="skeleton-emoji" />
                <div className="skeleton-line" />
                <div className="skeleton-line short" />
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="empty-state">
            <p>😕 No products found. Try a different search.</p>
          </div>
        ) : (
          <div className="product-grid">
            {products.map(product => (
              <div key={product.id} className="product-card">
                <a href={`#/product/${product.id}`} className="product-link">
                  <div className="product-image-wrap">
                    {product.image_url
                      ? <img
                          src={product.image_url}
                          alt={product.name}
                          className="product-photo"
                          loading="lazy"
                          onError={e => { e.currentTarget.style.display = 'none'; e.currentTarget.nextSibling.style.display = 'flex'; }}
                        />
                      : null}
                    <div className="product-emoji-fallback" style={{ display: product.image_url ? 'none' : 'flex' }}>
                      {product.emoji}
                    </div>
                    {product.badge && (
                      <span className={`badge badge-${product.badge.toLowerCase().replace(' ', '-')} badge-overlay`}>
                        {product.badge}
                      </span>
                    )}
                  </div>
                  <div className="product-info">
                    <span className="product-category">{product.category}</span>
                    <h3 className="product-name">{product.name}</h3>
                    <div className="product-rating">
                      <Stars rating={product.rating} />
                      <span>({product.rating})</span>
                    </div>
                    <p className="product-price">${product.price.toFixed(2)}</p>
                  </div>
                </a>
                <button
                  className="btn btn-primary btn-add"
                  onClick={() => handleAddToCart(product)}
                  disabled={addingId === product.id || product.stock === 0}
                  aria-label={`Add ${product.name} to cart`}
                >
                  {addingId === product.id ? 'Adding…' : product.stock === 0 ? 'Out of Stock' : 'Add to Cart'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
