import KpiCard from '../../../components/panel/KpiCard'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import TrackChangesIcon from '@mui/icons-material/TrackChanges'

function pctVariacion(actual, anterior) {
  if (actual == null || anterior == null || anterior === 0) return null
  return (((actual - anterior) / anterior) * 100).toFixed(1)
}

export default function ComparativoBloque({ titulo, filas }) {
  const dias = filas.filter((f) => f.tipo_fila === 'DIA')
  const total = filas.find((f) => f.tipo_fila === 'TOTAL')
  const proyeccion = filas.find((f) => f.tipo_fila === 'PROYECCION')

  return (
    <>
      <p className="panel-section-title">{titulo}</p>
      <div className="kpi-row">
        <KpiCard
          label="Acumulado Mes Actual"
          value={total?.acum_actual?.toLocaleString('es-CL') ?? '—'}
          icon={<CalendarMonthIcon />}
          highlight
        />
        <KpiCard
          label="Acumulado Mes Anterior"
          value={total?.acum_anterior?.toLocaleString('es-CL') ?? '—'}
          icon={<TrendingUpIcon />}
        />
        <KpiCard
          label="Proyección de Cierre"
          value={proyeccion?.acum_actual?.toLocaleString('es-CL') ?? '—'}
          icon={<TrackChangesIcon />}
        />
      </div>

      <div className="panel-table-wrapper">
        <table className="panel-table">
          <thead>
            <tr>
              <th>Día</th>
              <th>Fecha actual</th>
              <th className="num">Monto actual</th>
              <th className="num">Acum. actual</th>
              <th>Fecha anterior</th>
              <th className="num">Monto anterior</th>
              <th className="num">Acum. anterior</th>
              <th className="num">% Variación</th>
            </tr>
          </thead>
          <tbody>
            {dias.map((f) => {
              const pct = pctVariacion(f.monto_actual, f.monto_anterior)
              return (
                <tr key={f.nro_dia}>
                  <td>{f.nro_dia}</td>
                  <td>{f.fecha_actual}</td>
                  <td className="num">{f.monto_actual?.toLocaleString('es-CL')}</td>
                  <td className="num">{f.acum_actual?.toLocaleString('es-CL')}</td>
                  <td>{f.fecha_anterior}</td>
                  <td className="num">{f.monto_anterior?.toLocaleString('es-CL')}</td>
                  <td className="num">{f.acum_anterior?.toLocaleString('es-CL')}</td>
                  <td className={`num ${pct == null ? '' : pct >= 0 ? 'pct-positive' : 'pct-negative'}`}>
                    {pct == null ? '—' : `${pct}%`}
                  </td>
                </tr>
              )
            })}
            {total && (
              <tr className="fila-total">
                <td colSpan={3}>Total</td>
                <td className="num">{total.acum_actual?.toLocaleString('es-CL')}</td>
                <td></td>
                <td></td>
                <td className="num">{total.acum_anterior?.toLocaleString('es-CL')}</td>
                <td className="num">
                  {(() => {
                    const pct = pctVariacion(total.acum_actual, total.acum_anterior)
                    return pct == null ? '—' : `${pct}%`
                  })()}
                </td>
              </tr>
            )}
            {proyeccion && (
              <tr className="fila-total">
                <td colSpan={7}>Proyección al cierre</td>
                <td className="num">{proyeccion.acum_actual?.toLocaleString('es-CL')}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}
