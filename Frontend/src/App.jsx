import { Navigate, Route, BrowserRouter as Router, Routes, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import ThemeToggle from './components/ThemeToggle'
import BackButton from './components/BackButton'
import Login from './pages/Login'
import MandanteSelector from './pages/MandanteSelector'
import PanelCLA from './pages/panels/PanelCLA'
import PanelCenco from './pages/panels/PanelCenco'
import PanelAraucana from './pages/panels/PanelAraucana'
import PanelUC from './pages/panels/PanelUC'

function ProtectedRoute({ children }) {
  const { user, isLoading } = useAuth()

  if (isLoading) return null
  if (!user) return <Navigate to="/login" replace />
  return children
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <MandanteSelector />
          </ProtectedRoute>
        }
      />
      <Route
        path="/panel/cla"
        element={
          <ProtectedRoute>
            <PanelCLA />
          </ProtectedRoute>
        }
      />
      <Route
        path="/panel/cenco"
        element={
          <ProtectedRoute>
            <PanelCenco />
          </ProtectedRoute>
        }
      />
      <Route
        path="/panel/araucana"
        element={
          <ProtectedRoute>
            <PanelAraucana />
          </ProtectedRoute>
        }
      />
      <Route
        path="/panel/uc"
        element={
          <ProtectedRoute>
            <PanelUC />
          </ProtectedRoute>
        }
      />
    </Routes>
  )
}

function AppTopBar() {
  const location = useLocation()
  const showBack = location.pathname.startsWith('/panel/')

  return (
    <>
      {showBack && (
        <div className="app-topbar app-topbar-left">
          <BackButton to="/" />
        </div>
      )}
      <div className="app-topbar app-topbar-right">
        <ThemeToggle />
      </div>
    </>
  )
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <AppTopBar />
          <AppRoutes />
        </Router>
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App
