import { useState } from 'react'
import PanelTabs from '../../components/panel/PanelTabs'
import { ARAUCANA_CARTERAS } from '../../config/araucanaCarteras'
import { downloadFile } from '../../api/download'
import BusinessIcon from '@mui/icons-material/Business'
import CategoryIcon from '@mui/icons-material/Category'
import FileDownloadIcon from '@mui/icons-material/FileDownload'
import EstadoCarteraTab from './araucana/EstadoCarteraTab'
import EmbargoTab from './araucana/EmbargoTab'
import NotificacionTab from './araucana/NotificacionTab'
import BusquedasNegativasTab from './araucana/BusquedasNegativasTab'

const TABS = [
  { key: 'estado-cartera', label: 'Estado Cartera' },
  { key: 'notificacion', label: 'Notificación' },
  { key: 'busquedas-negativas', label: 'Búsquedas Negativas' },
  { key: 'embargo', label: 'Embargo' },
]

export default function PanelAraucana() {
  const [cartera, setCartera] = useState(ARAUCANA_CARTERAS[0].value)
  const [tab, setTab] = useState('estado-cartera')
  const [descargaError, setDescargaError] = useState('')

  async function descargar(path, fallback) {
    setDescargaError('')
    try {
      await downloadFile(`${path}?cartera=${cartera}`, fallback)
    } catch (err) {
      setDescargaError(err.message)
    }
  }

  const carteraLabel = ARAUCANA_CARTERAS.find((opt) => opt.value === cartera)?.label ?? cartera
  const tabLabel = TABS.find((t) => t.key === tab)?.label ?? ''

  return (
    <div className="panel-page">
      <div className="panel-heading">
        <div className="panel-heading-title">
          <h1>Judicial</h1>
          <span className="panel-heading-context">{tabLabel}</span>
        </div>
        <div className="panel-heading-meta">
          <span className="panel-heading-badge">
            <BusinessIcon /> Mandante: ARAUCANA
          </span>
          <span className="panel-heading-badge">
            <CategoryIcon /> Cartera: {carteraLabel}
          </span>
        </div>
      </div>

      <div className="panel-toolbar">
        <div className="panel-toolbar-filters">
          <label className="panel-selector">
            Cartera
            <select value={cartera} onChange={(e) => setCartera(e.target.value)}>
              {ARAUCANA_CARTERAS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="panel-toolbar-actions">
          <button
            type="button"
            className="panel-download-btn"
            onClick={() => descargar('/panel/araucana/descarga', 'sabana.csv')}
          >
            <FileDownloadIcon /> Descargar CSV
          </button>
          {tab === 'embargo' && (
            <button
              type="button"
              className="panel-download-btn"
              onClick={() => descargar('/panel/araucana/descarga-embargo', 'embargo.csv')}
            >
              <FileDownloadIcon /> Descargar Embargo
            </button>
          )}
        </div>
      </div>

      {descargaError && <p className="login-error">{descargaError}</p>}

      <PanelTabs tabs={TABS} active={tab} onChange={setTab} />

      <div className="panel-tab-content">
        {tab === 'estado-cartera' && <EstadoCarteraTab cartera={cartera} />}
        {tab === 'notificacion' && <NotificacionTab cartera={cartera} />}
        {tab === 'busquedas-negativas' && <BusquedasNegativasTab cartera={cartera} />}
        {tab === 'embargo' && <EmbargoTab cartera={cartera} />}
      </div>
    </div>
  )
}
