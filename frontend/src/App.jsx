import { useState, useEffect, useCallback } from 'react'
import Navbar from './components/Navbar'
import HomePage from './pages/HomePage'
import ProductPage from './pages/ProductPage'
import CartPage from './pages/CartPage'
import { getOrCreateSessionId } from './utils/session'
import { fetchCart } from './api/cartApi'

// Golf imports
import GolfLoginPage from './pages/GolfLoginPage'
import GolfRegisterPage from './pages/GolfRegisterPage'
import GolfLeaderboardPage from './pages/GolfLeaderboardPage'
import GolfScoreHistoryPage from './pages/GolfScoreHistoryPage'
import GolfScoreForm from './components/GolfScoreForm'
import GolfNav from './components/GolfNav'
import { getUser, clearToken } from './api/golfApi'

// Simple client-side router using hash-based navigation
function useRouter() {
  const [path, setPath] = useState(window.location.hash || '#/')

  useEffect(() => {
    const handler = () => setPath(window.location.hash || '#/')
    window.addEventListener('hashchange', handler)
    return () => window.removeEventListener('hashchange', handler)
  }, [])

  return path
}

export function navigate(to) {
  window.location.hash = to
}

function GolfRedirect() {
  useEffect(() => {
    window.location.hash = '#/golf/login'
  }, [])
  return null
}

export default function App() {
  const path = useRouter()
  const [cart, setCart] = useState([])
  const [cartLoading, setCartLoading] = useState(false)
  const sessionId = getOrCreateSessionId()

  // Golf user state
  const [golfUser, setGolfUser] = useState(() => getUser())

  const refreshCart = useCallback(async () => {
    setCartLoading(true)
    try {
      const data = await fetchCart(sessionId)
      setCart(data)
    } catch (e) {
      console.error('Failed to load cart', e)
    } finally {
      setCartLoading(false)
    }
  }, [sessionId])

  useEffect(() => {
    refreshCart()
  }, [refreshCart])

  const cartCount = cart.reduce((sum, item) => sum + item.qty, 0)

  function handleGolfLogin(user) {
    setGolfUser(user)
    window.location.hash = '#/golf/leaderboard'
  }

  function handleGolfLogout() {
    clearToken()
    setGolfUser(null)
  }

  // Golf route matching
  if (path.startsWith('#/golf')) {
    // Public golf routes
    if (path === '#/golf/login') {
      return (
        <div className="app golf-app">
          <main><GolfLoginPage onLogin={handleGolfLogin} /></main>
        </div>
      )
    }
    if (path === '#/golf/register') {
      return (
        <div className="app golf-app">
          <main><GolfRegisterPage onLogin={handleGolfLogin} /></main>
        </div>
      )
    }

    // Protected golf routes — redirect to login if no valid token
    if (!golfUser) {
      return <GolfRedirect />
    }

    let golfPage
    if (path === '#/golf/leaderboard') {
      golfPage = <GolfLeaderboardPage />
    } else if (path === '#/golf/scores') {
      golfPage = <GolfScoreForm />
    } else if (path === '#/golf/history') {
      golfPage = <GolfScoreHistoryPage user={golfUser} />
    } else {
      golfPage = <GolfLeaderboardPage />
    }

    return (
      <div className="app golf-app">
        <GolfNav user={golfUser} onLogout={handleGolfLogout} />
        <main>{golfPage}</main>
      </div>
    )
  }

  // ShopMart route matching
  let page
  if (path.startsWith('#/product/')) {
    const id = parseInt(path.replace('#/product/', ''))
    page = <ProductPage productId={id} sessionId={sessionId} onCartChange={refreshCart} />
  } else if (path === '#/cart') {
    page = <CartPage cart={cart} sessionId={sessionId} onCartChange={refreshCart} cartLoading={cartLoading} />
  } else {
    page = <HomePage sessionId={sessionId} onCartChange={refreshCart} />
  }

  return (
    <div className="app">
      <Navbar cartCount={cartCount} />
      <main>{page}</main>
      <footer className="footer">
        <p>© 2026 ShopMart. All rights reserved.</p>
      </footer>
    </div>
  )
}
