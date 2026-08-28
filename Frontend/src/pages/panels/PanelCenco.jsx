import { useEffect, useState } from 'react'
import PanelTabs from '../../components/panel/PanelTabs'
import { apiFetch } from '../../api/client'
import { CENCO_CARTERAS } from '../../config/cencoCarteras'
import BusinessIcon from '@mui/icons-material/Business'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import EstadoCarteraTab from './cenco/EstadoCarteraTab'
import ContactabilidadTab from './cenco/ContactabilidadTab'
import PagosTab from './cenco/PagosTab'
import ReprosTab from './cenco/ReprosTab'
import EjecutivosTab from './cenco/EjecutivosTab'
import ComparativoTab from './cenco/ComparativoTab'
import SalidasTab from './cenco/SalidasTab'

const TABS = [
  { key: 'estado-cartera', label: 'Estado Cartera' },
  { key: 'contactabilidad', label: 'Contactabilidad' },
  { key: 'pagos', label: 'Pagos' },
  { key: 'repros', label: 'Reprogramaciones' },
  { key: 'comparativo', label: 'Comparativo' },
  { key: 'ejecutivos', label: 'Ejecutivos' },
  { key: 'salidas', label: 'Salidas' },
]

export default function PanelCenco() {
  const [periodos, setPeriodos] = useState(null)
  const [periodoError, setPeriodoError] = useState('')
  const [periodo, setPeriodo] = useState(null)
  const [cartera, setCartera] = useState(CENCO_CARTERAS[0].value)
  const [tab, setTab] = useState('estado-cartera')

  useEffect(() => {
    setPeriodoError('')
    apiFetch(`/panel/cenco/periodos?cartera=${cartera}`)
      .then((rows) => {
        setPeriodos(rows)
        setPeriodo((prev) => {
          if (prev && rows.some((r) => r.periodo === prev)) return prev
          return rows.length ? rows[0].periodo : null
        })
      })
      .catch((err) => setPeriodoError(err.message))
  }, [cartera])

  const periodoLabel = periodo ? `${periodo.slice(4)}/${periodo.slice(0, 4)}` : '—'
  const tabLabel = TABS.find((t) => t.key === tab)?.label ?? ''

  return (
    <div className="panel-page">
      <div className="panel-heading panel-heading--cencosud">
        <div className="panel-heading-title">
          <h1>Cencosud</h1>
          <span className="panel-heading-context">{tabLabel}</span>
        </div>
        <div className="panel-heading-meta">
          <span className="panel-heading-badge">
            <BusinessIcon /> Mandante: CENCO
          </span>
          <span className="panel-heading-badge">
            <CalendarMonthIcon /> Período: {periodoLabel}
          </span>
        </div>
      </div>

      <div className="panel-toolbar">
        <div className="panel-toolbar-filters">
          <div className="panel-cartera-toggle">
            {CENCO_CARTERAS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={opt.value === cartera ? 'activo' : ''}
                onClick={() => setCartera(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {periodos && periodos.length > 0 && periodo && (
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
          )}
        </div>
      </div>

      {periodoError && <p className="login-error">{periodoError}</p>}

      {!periodoError && !periodos && <p>Cargando períodos disponibles...</p>}

      {periodos && periodos.length === 0 && (
        <p>Todavía no hay períodos procesados para esta cartera.</p>
      )}

      {periodos && periodos.length > 0 && periodo && (
        <>
          <PanelTabs tabs={TABS} active={tab} onChange={setTab} />

          <div className="panel-tab-content">
            {tab === 'estado-cartera' && <EstadoCarteraTab periodo={periodo} cartera={cartera} />}
            {tab === 'contactabilidad' && <ContactabilidadTab periodo={periodo} cartera={cartera} />}
            {tab === 'pagos' && <PagosTab periodo={periodo} cartera={cartera} />}
            {tab === 'repros' && <ReprosTab periodo={periodo} cartera={cartera} />}
            {tab === 'comparativo' && <ComparativoTab periodo={periodo} cartera={cartera} />}
            {tab === 'ejecutivos' && <EjecutivosTab periodo={periodo} cartera={cartera} />}
            {tab === 'salidas' && <SalidasTab periodo={periodo} />}
          </div>
        </>
      )}
    </div>
  )
}
