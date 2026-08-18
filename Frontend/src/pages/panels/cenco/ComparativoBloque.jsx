import KpiCard from '../../../components/panel/KpiCard'

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
        <KpiCard label="Acumulado Mes Actual" value={total?.acum_actual?.toLocaleString('es-CL') ?? '—'} />
        <KpiCard label="Acumulado Mes Anterior" value={total?.acum_anterior?.toLocaleString('es-CL') ?? '—'} />
        <KpiCard label="Proyección de Cierre" value={proyeccion?.acum_actual?.toLocaleString('es-CL') ?? '—'} />
      </div>

      <table className="panel-table">
        <thead>
          <tr>
            <th>Día</th>
            <th>Fecha actual</th>
            <th>Monto actual</th>
            <th>Acum. actual</th>
            <th>Fecha anterior</th>
            <th>Monto anterior</th>
            <th>Acum. anterior</th>
            <th>% Variación</th>
          </tr>
        </thead>
        <tbody>
          {dias.map((f) => {
            const pct = pctVariacion(f.monto_actual, f.monto_anterior)
            return (
              <tr key={f.nro_dia}>
                <td>{f.nro_dia}</td>
                <td>{f.fecha_actual}</td>
                <td>{f.monto_actual?.toLocaleString('es-CL')}</td>
                <td>{f.acum_actual?.toLocaleString('es-CL')}</td>
                <td>{f.fecha_anterior}</td>
                <td>{f.monto_anterior?.toLocaleString('es-CL')}</td>
                <td>{f.acum_anterior?.toLocaleString('es-CL')}</td>
                <td style={{ color: pct == null ? undefined : pct >= 0 ? '#2f9e44' : '#e5484d' }}>
                  {pct == null ? '—' : `${pct}%`}
                </td>
              </tr>
            )
          })}
          {total && (
            <tr className="fila-total">
              <td colSpan={3}>Total</td>
              <td>{total.acum_actual?.toLocaleString('es-CL')}</td>
              <td></td>
              <td></td>
              <td>{total.acum_anterior?.toLocaleString('es-CL')}</td>
              <td>
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
              <td>{proyeccion.acum_actual?.toLocaleString('es-CL')}</td>
            </tr>
          )}
        </tbody>
      </table>
    </>
  )
}
