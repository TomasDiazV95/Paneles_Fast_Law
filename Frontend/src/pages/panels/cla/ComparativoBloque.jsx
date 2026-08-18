import KpiCard from '../../../components/panel/KpiCard'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import TrackChangesIcon from '@mui/icons-material/TrackChanges'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'

export default function ComparativoBloque({ titulo, filas }) {
  const dias = filas.filter((f) => f.es_proyeccion === 0)
  const total = filas.find((f) => f.es_proyeccion === 2)
  const proyeccion = filas.find((f) => f.es_proyeccion === 1)

  function pctClass(pct) {
    if (pct == null) return undefined
    return pct >= 0 ? 'num pct-positive' : 'num pct-negative'
  }

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
            {dias.map((f) => (
              <tr key={f.nro_dia}>
                <td>{f.nro_dia}</td>
                <td>{f.fecha_actual}</td>
                <td className="num">{f.monto_actual?.toLocaleString('es-CL')}</td>
                <td className="num">{f.acum_actual?.toLocaleString('es-CL')}</td>
                <td>{f.fecha_anterior}</td>
                <td className="num">{f.monto_anterior?.toLocaleString('es-CL')}</td>
                <td className="num">{f.acum_anterior?.toLocaleString('es-CL')}</td>
                <td className={pctClass(f.pct_variacion)}>
                  {f.pct_variacion == null ? '—' : `${f.pct_variacion}%`}
                </td>
              </tr>
            ))}
            {total && (
              <tr className="fila-total">
                <td colSpan={3}>Total</td>
                <td className="num">{total.acum_actual?.toLocaleString('es-CL')}</td>
                <td></td>
                <td></td>
                <td className="num">{total.acum_anterior?.toLocaleString('es-CL')}</td>
                <td className={pctClass(total.pct_variacion)}>
                  {total.pct_variacion == null ? '—' : `${total.pct_variacion}%`}
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
