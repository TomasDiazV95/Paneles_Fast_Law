import { Navigate, Route, BrowserRouter as Router, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import ThemeToggle from './components/ThemeToggle'
import Login from './pages/Login'
import MandanteSelector from './pages/MandanteSelector'
import PanelCLA from './pages/panels/PanelCLA'
import PanelCenco from './pages/panels/PanelCenco'
import PanelAraucana from './pages/panels/PanelAraucana'

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
    </Routes>
  )
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <div className="theme-toggle-fixed">
            <ThemeToggle />
          </div>
          <AppRoutes />
        </Router>
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App
