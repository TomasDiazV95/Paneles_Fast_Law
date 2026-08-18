import { useState } from 'react'
import PanelTabs from '../../components/panel/PanelTabs'
import { getPeriodoOptions } from '../../utils/periodos'
import { CENCO_CARTERAS } from '../../config/cencoCarteras'
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

  return (
    <div className="panel-page">
      <h1>Cencosud</h1>

      <div className="panel-header">
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
