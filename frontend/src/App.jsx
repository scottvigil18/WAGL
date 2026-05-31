import { useState, useEffect, useRef } from 'react'
import { getUser, clearToken } from './api/golfApi'

// Golf imports
import GolfLoginPage from './pages/GolfLoginPage'
import GolfRegisterPage from './pages/GolfRegisterPage'
import GolfLeaderboardPage from './pages/GolfLeaderboardPage'
import GolfScoreHistoryPage from './pages/GolfScoreHistoryPage'
import GolfScoreForm from './components/GolfScoreForm'
import GolfNav from './components/GolfNav'
import GolfAdminPage from './pages/GolfAdminPage'
import GolfSchedulePage from './pages/GolfSchedulePage'
import GolfProfilePage from './pages/GolfProfilePage'
import GolfPlayerProfilePage from './pages/GolfPlayerProfilePage'
import GolfPhotosPage from './pages/GolfPhotosPage'
import GolfSplashPage from './pages/GolfSplashPage'
import GolfAboutPage from './pages/GolfAboutPage'
import GolfContactPage from './pages/GolfContactPage'
import GolfJoinPage from './pages/GolfJoinPage'
import GolfNotificationsPage from './pages/GolfNotificationsPage'
import GolfForceResetPage from './pages/GolfForceResetPage'

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
    window.location.hash = '#/golf/splash'
  }, [])
  return null
}

export default function App() {
  const path = useRouter()

  // Golf user state
  const [golfUser, setGolfUser] = useState(() => getUser())

  // Idle timeout — logout after 15 minutes of inactivity
  const idleTimer = useRef(null)
  const IDLE_TIMEOUT = 15 * 60 * 1000 // 15 minutes

  useEffect(() => {
    if (!golfUser) return

    function resetTimer() {
      if (idleTimer.current) clearTimeout(idleTimer.current)
      idleTimer.current = setTimeout(() => {
        clearToken()
        setGolfUser(null)
        window.location.hash = '#/golf/splash'
      }, IDLE_TIMEOUT)
    }

    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click']
    events.forEach(e => window.addEventListener(e, resetTimer))
    resetTimer()

    return () => {
      events.forEach(e => window.removeEventListener(e, resetTimer))
      if (idleTimer.current) clearTimeout(idleTimer.current)
    }
  }, [golfUser])

  function handleGolfLogin(user) {
    setGolfUser(user)
    if (user.force_password_reset) {
      window.location.hash = '#/golf/force-reset'
    } else {
      window.location.hash = user.role === 'admin' ? '#/golf/admin' : '#/golf/leaderboard'
    }
  }

  function handleGolfLogout() {
    clearToken()
    setGolfUser(null)
    window.location.hash = '#/golf/splash'
  }

  // Golf route matching
  if (path.startsWith('#/golf')) {
    // Public splash pages (no auth required)
    if (path === '#/golf/splash') {
      return <GolfSplashPage />
    }
    if (path === '#/golf/about') {
      return <GolfAboutPage />
    }
    if (path === '#/golf/contact') {
      return <GolfContactPage />
    }
    if (path === '#/golf/join') {
      return <GolfJoinPage />
    }

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
    if (path === '#/golf/force-reset') {
      return (
        <div className="app golf-app">
          <main>
            <GolfForceResetPage onComplete={() => {
              window.location.hash = '#/golf/leaderboard'
            }} />
          </main>
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
    } else if (path === '#/golf/schedule') {
      golfPage = <GolfSchedulePage />
    } else if (path === '#/golf/photos') {
      golfPage = <GolfPhotosPage />
    } else if (path === '#/golf/notifications') {
      golfPage = <GolfNotificationsPage />
    } else if (path === '#/golf/profile') {
      golfPage = <GolfProfilePage />
    } else if (path.startsWith('#/golf/player/')) {
      const id = parseInt(path.replace('#/golf/player/', ''), 10)
      golfPage = <GolfPlayerProfilePage playerId={id} />
    } else if (path === '#/golf/admin') {
      if (golfUser.role !== 'admin') return <GolfRedirect />
      golfPage = <GolfAdminPage />
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

  // Redirect root to golf splash
  useEffect(() => {
    const hash = window.location.hash
    if (!hash || hash === '#' || hash === '#/') {
      window.location.hash = '#/golf/splash'
    }
  }, [])

  // If path is root, show the splash directly instead of returning null
  if (path === '#/' || path === '#' || path === '' || !path) {
    return <GolfSplashPage />
  }

  // No ShopMart routes — redirect everything else to splash
  return <GolfSplashPage />
}
