import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import RefreshIcon from '@mui/icons-material/Refresh'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import { useAuth } from '../context/AuthContext'
import { MANDANTES } from '../config/mandantes'
import { useAdminPanelRefresh } from '../hooks/useAdminPanelRefresh'
import PanelRefreshModal from '../components/admin/PanelRefreshModal'

export default function MandanteSelector() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [modalOpen, setModalOpen] = useState(false)
  const refresh = useAdminPanelRefresh()

  const isAdmin = user.role === 'ADMIN'
  const canUpload = user.role === 'ADMIN' || user.role === 'MANTENEDOR'

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

      {(isAdmin || canUpload) && (
        <div className="mandante-actions">
          {isAdmin && (
            <button
              type="button"
              className="admin-refresh-trigger"
              onClick={() => setModalOpen(true)}
              disabled={refresh.isRunning}
            >
              <RefreshIcon className={refresh.isRunning ? 'spin' : undefined} />
              {refresh.isRunning ? 'Actualización en curso…' : 'Actualizar paneles'}
            </button>
          )}

          {canUpload && (
            <button type="button" className="admin-refresh-trigger" onClick={() => navigate('/carga')}>
              <UploadFileIcon />
              Carga de archivos
            </button>
          )}
        </div>
      )}

      <button type="button" className="theme-toggle" onClick={logout}>
        Cerrar sesión
      </button>

      {modalOpen && (
        <PanelRefreshModal onClose={() => setModalOpen(false)} refresh={refresh} />
      )}
    </div>
  )
}
