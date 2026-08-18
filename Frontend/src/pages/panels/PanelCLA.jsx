import { useState } from 'react'
import PanelTabs from '../../components/panel/PanelTabs'
import { getPeriodoOptions } from '../../utils/periodos'
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

const PERIODO_OPTIONS = getPeriodoOptions()

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
  const [periodo, setPeriodo] = useState(PERIODO_OPTIONS[0].value)
  const [tab, setTab] = useState('estado-cartera')
  const [descargaError, setDescargaError] = useState('')

  async function descargar(path, fallback) {
    setDescargaError('')
    try {
      await downloadFile(`${path}?periodo=${periodo}`, fallback)
    } catch (err) {
      setDescargaError(err.message)
    }
  }

  const periodoLabel = PERIODO_OPTIONS.find((opt) => opt.value === periodo)?.label ?? periodo
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

      <div className="panel-toolbar">
        <div className="panel-toolbar-filters">
          <label className="panel-selector">
            Período
            <select value={periodo} onChange={(e) => setPeriodo(e.target.value)}>
              {PERIODO_OPTIONS.map((opt) => (
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
    </div>
  )
}
