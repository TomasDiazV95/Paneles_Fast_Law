import { createContext, useContext, useEffect, useState } from 'react'
import { apiFetch, getToken, setToken } from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const token = getToken()
    if (!token) {
      setIsLoading(false)
      return
    }

    apiFetch('/auth/me')
      .then(setUser)
      .catch(() => setToken(null))
      .finally(() => setIsLoading(false))
  }, [])

  async function login(username, password) {
    const data = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ user: username, password }),
    })
    setToken(data.access_token)
    setUser({ user: data.user, full_name: data.full_name, role: data.role })
  }

  function logout() {
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
