import { navigate } from '../App'

export default function Navbar({ cartCount }) {
  const hash = window.location.hash || '#/'

  return (
    <header className="navbar">
      <div className="nav-container">
        <a href="#/" className="logo">🛍️ ShopMart</a>
        <nav className="nav-links">
          <a href="#/" className={hash === '#/' ? 'active' : ''}>Home</a>
          <a href="#/cart" className={`cart-link ${hash === '#/cart' ? 'active' : ''}`}>
            🛒 Cart
            {cartCount > 0 && (
              <span className="cart-badge">{cartCount}</span>
            )}
          </a>
        </nav>
      </div>
    </header>
  )
}
