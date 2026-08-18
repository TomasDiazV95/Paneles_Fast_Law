import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { MANDANTES } from '../config/mandantes'

export default function MandanteSelector() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="mandante-page">
      <h2>Hola, {user.full_name}</h2>
      <p>Elige el mandante cuyo panel quieres ver</p>

      <div className="mandante-grid">
        {MANDANTES.map((mandante) => (
          <button
            key={mandante.code}
            type="button"
            className="mandante-card"
            onClick={() => navigate(`/panel/${mandante.code}`)}
          >
            {mandante.label}
          </button>
        ))}
      </div>

      <button type="button" className="theme-toggle" onClick={logout}>
        Cerrar sesión
      </button>
    </div>
  )
}
