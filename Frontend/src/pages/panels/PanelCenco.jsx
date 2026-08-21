import { useState } from 'react'
import PanelTabs from '../../components/panel/PanelTabs'
import { getPeriodoOptions } from '../../utils/periodos'
import { CENCO_CARTERAS } from '../../config/cencoCarteras'
import BusinessIcon from '@mui/icons-material/Business'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import EstadoCarteraTab from './cenco/EstadoCarteraTab'
import ContactabilidadTab from './cenco/ContactabilidadTab'
import PagosTab from './cenco/PagosTab'
import ReprosTab from './cenco/ReprosTab'
import EjecutivosTab from './cenco/EjecutivosTab'
import ComparativoTab from './cenco/ComparativoTab'

const PERIODO_OPTIONS = getPeriodoOptions()

const TABS = [
  { key: 'estado-cartera', label: 'Estado Cartera' },
  { key: 'contactabilidad', label: 'Contactabilidad' },
  { key: 'pagos', label: 'Pagos' },
  { key: 'repros', label: 'Reprogramaciones' },
  { key: 'comparativo', label: 'Comparativo' },
  { key: 'ejecutivos', label: 'Ejecutivos' },
]

export default function PanelCenco() {
  const [periodo, setPeriodo] = useState(PERIODO_OPTIONS[0].value)
  const [cartera, setCartera] = useState(CENCO_CARTERAS[0].value)
  const [tab, setTab] = useState('estado-cartera')

  const periodoLabel = PERIODO_OPTIONS.find((opt) => opt.value === periodo)?.label ?? periodo
  const tabLabel = TABS.find((t) => t.key === tab)?.label ?? ''

  return (
    <div className="panel-page">
      <div className="panel-heading">
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
      </div>

      <PanelTabs tabs={TABS} active={tab} onChange={setTab} />

      <div className="panel-tab-content">
        {tab === 'estado-cartera' && <EstadoCarteraTab periodo={periodo} cartera={cartera} />}
        {tab === 'contactabilidad' && <ContactabilidadTab periodo={periodo} cartera={cartera} />}
        {tab === 'pagos' && <PagosTab periodo={periodo} cartera={cartera} />}
        {tab === 'repros' && <ReprosTab periodo={periodo} cartera={cartera} />}
        {tab === 'comparativo' && <ComparativoTab periodo={periodo} cartera={cartera} />}
        {tab === 'ejecutivos' && <EjecutivosTab periodo={periodo} cartera={cartera} />}
      </div>
    </div>
  )
}
