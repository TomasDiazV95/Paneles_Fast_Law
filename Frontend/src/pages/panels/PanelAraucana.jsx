import { useState } from 'react'
import PanelTabs from '../../components/panel/PanelTabs'
import { ARAUCANA_CARTERAS } from '../../config/araucanaCarteras'
import { downloadFile } from '../../api/download'
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

  return (
    <div className="panel-page">
      <h1>La Araucana</h1>

      <div className="panel-header">
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
        <button type="button" className="theme-toggle" onClick={() => descargar('/panel/araucana/descarga', 'sabana.csv')}>
          Descargar CSV
        </button>
        {tab === 'embargo' && (
          <button
            type="button"
            className="theme-toggle"
            onClick={() => descargar('/panel/araucana/descarga-embargo', 'embargo.csv')}
          >
            Descargar Embargo
          </button>
        )}
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
