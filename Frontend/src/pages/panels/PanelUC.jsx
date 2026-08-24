import { useEffect, useState } from 'react'
import { apiFetch } from '../../api/client'
import BusinessIcon from '@mui/icons-material/Business'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import KpiGridUC from './uc/KpiGridUC'
import PagosCard from './uc/PagosCard'
import EmbudoBloque from './uc/EmbudoBloque'
import EstadoCarteraDonut from './uc/EstadoCarteraDonut'
import EvolucionBloque from './uc/EvolucionBloque'
import ActividadDiariaBloque from './uc/ActividadDiariaBloque'
import FranjaHorariaBloque from './uc/FranjaHorariaBloque'
import DimensionesBloque from './uc/DimensionesBloque'
import DetalleTabla from './uc/DetalleTabla'

const CARTERA_UC = 890

export default function PanelUC() {
  const [periodos, setPeriodos] = useState(null)
  const [periodoError, setPeriodoError] = useState('')
  const [periodo, setPeriodo] = useState(null)
  const [filtros, setFiltros] = useState({})

  useEffect(() => {
    apiFetch(`/panel/uc/periodos?cartera=${CARTERA_UC}`)
      .then((rows) => {
        setPeriodos(rows)
        if (rows.length) setPeriodo(rows[0].periodo)
      })
      .catch((err) => setPeriodoError(err.message))
  }, [])

  function aplicarFiltro(campo, valor) {
    setFiltros((prev) => {
      if (prev[campo] === valor) {
        const { [campo]: _omitido, ...resto } = prev
        return resto
      }
      return { ...prev, [campo]: valor }
    })
    document.getElementById('detalle-uc')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const periodoLabel = periodo ? `${periodo.slice(4)}/${periodo.slice(0, 4)}` : '—'

  return (
    <div className="panel-page">
      <div className="panel-heading">
        <div className="panel-heading-title">
          <h1>Unidad de Crédito</h1>
          <span className="panel-heading-context">Gestión extrajudicial</span>
        </div>
        <div className="panel-heading-meta">
          <span className="panel-heading-badge">
            <BusinessIcon /> Mandante: UC
          </span>
          <span className="panel-heading-badge">
            <CalendarMonthIcon /> Período: {periodoLabel}
          </span>
        </div>
      </div>

      {periodoError && <p className="login-error">{periodoError}</p>}

      {!periodoError && !periodos && <p>Cargando períodos disponibles...</p>}

      {periodos && periodos.length === 0 && (
        <p>
          Todavía no hay períodos procesados para esta cartera. Ejecuta{' '}
          <code>EXEC dbo.SP_Panel_UC_Proceso @CARTERA=890, @Periodo='YYYYMM'</code> en SQL Server para generar datos.
        </p>
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
                      {p.periodo} ({p.cuentas.toLocaleString('es-CL')} cuentas)
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <KpiGridUC periodo={periodo} cartera={CARTERA_UC}>
            <PagosCard periodo={periodo} cartera={CARTERA_UC} />
          </KpiGridUC>

          <div className="chart-row">
            <EmbudoBloque periodo={periodo} cartera={CARTERA_UC} />
            <EstadoCarteraDonut periodo={periodo} cartera={CARTERA_UC} onFiltro={aplicarFiltro} />
            <EvolucionBloque cartera={CARTERA_UC} />
          </div>

          <div className="chart-row" style={{ marginTop: 4 }}>
            <div style={{ flex: 2, minWidth: 420 }}>
              <ActividadDiariaBloque periodo={periodo} cartera={CARTERA_UC} />
            </div>
            <div style={{ flex: 1, minWidth: 300 }}>
              <FranjaHorariaBloque periodo={periodo} cartera={CARTERA_UC} />
            </div>
          </div>

          <p className="panel-section-title">Análisis por dimensión</p>
          <DimensionesBloque periodo={periodo} cartera={CARTERA_UC} onFiltro={aplicarFiltro} />

          <DetalleTabla
            periodo={periodo}
            cartera={CARTERA_UC}
            filtros={filtros}
            onLimpiarFiltros={() => setFiltros({})}
          />
        </>
      )}
    </div>
  )
}
