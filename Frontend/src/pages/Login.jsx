import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)
    try {
      await login(username, password)
      navigate('/', { replace: true })
    } catch (err) {
      setError(
        err.message === 'NETWORK_ERROR'
          ? 'No fue posible conectarse al servidor'
          : 'Usuario o contraseña incorrectos'
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <h1>Iniciar sesión</h1>

        {error && <p className="login-error">{error}</p>}

        <div className="login-field">
          <label htmlFor="username">Usuario</label>
          <input
            id="username"
            type="text"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>

        <div className="login-field">
          <label htmlFor="password">Contraseña</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        <button type="submit" className="login-submit" disabled={isSubmitting}>
          {isSubmitting ? 'Ingresando...' : 'Ingresar'}
        </button>
      </form>
    </div>
  )
}
