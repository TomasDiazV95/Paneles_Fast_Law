import { useState } from 'react'
import { Link } from 'react-router-dom'
import PanelTabs from '../../components/panel/PanelTabs'
import { getPeriodoOptions } from '../../utils/periodos'
import { downloadFile } from '../../api/download'
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

  return (
    <div className="panel-page">
      <Link to="/" className="theme-toggle">
        ← Volver
      </Link>
      <h1>Caja los Andes</h1>

      <div className="panel-header">
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
        <button
          type="button"
          className="theme-toggle"
          onClick={() => descargar('/panel/cla/descargar-pagos', 'sabana_pagos.xlsx')}
        >
          Sábana Pagos
        </button>
        <button
          type="button"
          className="theme-toggle"
          onClick={() => descargar('/panel/cla/descargar-repros', 'sabana_repros.xlsx')}
        >
          Sábana Repros
        </button>
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
