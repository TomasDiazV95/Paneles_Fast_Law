import { useEffect, useState } from 'react'
import PanelTabs from '../../components/panel/PanelTabs'
import { apiFetch } from '../../api/client'
import { downloadFile } from '../../api/download'
import BusinessIcon from '@mui/icons-material/Business'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import FileDownloadIcon from '@mui/icons-material/FileDownload'
import EstadoCarteraTab from './cla/EstadoCarteraTab'
import ContactabilidadTab from './cla/ContactabilidadTab'
import PagosTab from './cla/PagosTab'
import ReprosTab from './cla/ReprosTab'
import EjecutivosTab from './cla/EjecutivosTab'
import ComparativoTab from './cla/ComparativoTab'
import ProductividadTab from './cla/ProductividadTab'

const TABS = [
  { key: 'estado-cartera', label: 'Estado Cartera' },
  { key: 'contactabilidad', label: 'Contactabilidad' },
  { key: 'pagos', label: 'Pagos' },
  { key: 'repros', label: 'Reprogramaciones' },
  { key: 'comparativo', label: 'Comparativo' },
  { key: 'ejecutivos', label: 'Ejecutivos' },
  { key: 'productividad', label: 'Productividad' },
]

export default function PanelCLA() {
  const [periodos, setPeriodos] = useState(null)
  const [periodoError, setPeriodoError] = useState('')
  const [periodo, setPeriodo] = useState(null)
  const [tab, setTab] = useState('estado-cartera')
  const [descargaError, setDescargaError] = useState('')

  useEffect(() => {
    apiFetch('/panel/cla/periodos')
      .then((rows) => {
        setPeriodos(rows)
        if (rows.length) setPeriodo(rows[0].periodo)
      })
      .catch((err) => setPeriodoError(err.message))
  }, [])

  async function descargar(path, fallback) {
    setDescargaError('')
    try {
      await downloadFile(`${path}?periodo=${periodo}`, fallback)
    } catch (err) {
      setDescargaError(err.message)
    }
  }

  const periodoLabel = periodo ? `${periodo.slice(4)}/${periodo.slice(0, 4)}` : '—'
  const tabLabel = TABS.find((t) => t.key === tab)?.label ?? ''

  return (
    <div className="panel-page">
      <div className="panel-heading">
        <div className="panel-heading-title">
          <h1>Caja Los Andes</h1>
          <span className="panel-heading-context">{tabLabel}</span>
        </div>
        <div className="panel-heading-meta">
          <span className="panel-heading-badge">
            <BusinessIcon /> Mandante: CLA
          </span>
          <span className="panel-heading-badge">
            <CalendarMonthIcon /> Período: {periodoLabel}
          </span>
        </div>
      </div>

      {periodoError && <p className="login-error">{periodoError}</p>}

      {!periodoError && !periodos && <p>Cargando períodos disponibles...</p>}

      {periodos && periodos.length === 0 && (
        <p>Todavía no hay períodos procesados para esta cartera.</p>
      )}

      {periodos && periodos.length > 0 && periodo && (
        <>
          <div className="panel-toolbar">
            <div className="panel-toolbar-filters">
              <label className="panel-selector">
                Período
                <select value={periodo} onChange={(e) => setPeriodo(e.target.value)}>
                  {periodos.map((p) => (
                    <option key={p.periodo} value={p.periodo}>
                      {p.periodo} ({p.causas.toLocaleString('es-CL')} causas)
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="panel-toolbar-actions">
              <button
                type="button"
                className="panel-download-btn"
                onClick={() => descargar('/panel/cla/descargar-pagos', 'sabana_pagos.xlsx')}
              >
                <FileDownloadIcon /> Sábana Pagos
              </button>
              <button
                type="button"
                className="panel-download-btn"
                onClick={() => descargar('/panel/cla/descargar-repros', 'sabana_repros.xlsx')}
              >
                <FileDownloadIcon /> Sábana Repros
              </button>
            </div>
          </div>

          {descargaError && <p className="login-error">{descargaError}</p>}

          <PanelTabs tabs={TABS} active={tab} onChange={setTab} />

          <div className="panel-tab-content">
            {tab === 'estado-cartera' && <EstadoCarteraTab periodo={periodo} />}
            {tab === 'contactabilidad' && <ContactabilidadTab periodo={periodo} />}
            {tab === 'pagos' && <PagosTab periodo={periodo} />}
            {tab === 'repros' && <ReprosTab periodo={periodo} />}
            {tab === 'comparativo' && <ComparativoTab periodo={periodo} />}
            {tab === 'ejecutivos' && <EjecutivosTab periodo={periodo} />}
            {tab === 'productividad' && <ProductividadTab periodo={periodo} />}
          </div>
        </>
      )}
    </div>
  )
}
