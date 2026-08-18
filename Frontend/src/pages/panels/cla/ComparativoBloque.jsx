import KpiCard from '../../../components/panel/KpiCard'

export default function ComparativoBloque({ titulo, filas }) {
  const dias = filas.filter((f) => f.es_proyeccion === 0)
  const total = filas.find((f) => f.es_proyeccion === 2)
  const proyeccion = filas.find((f) => f.es_proyeccion === 1)

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
          {dias.map((f) => (
            <tr key={f.nro_dia}>
              <td>{f.nro_dia}</td>
              <td>{f.fecha_actual}</td>
              <td>{f.monto_actual?.toLocaleString('es-CL')}</td>
              <td>{f.acum_actual?.toLocaleString('es-CL')}</td>
              <td>{f.fecha_anterior}</td>
              <td>{f.monto_anterior?.toLocaleString('es-CL')}</td>
              <td>{f.acum_anterior?.toLocaleString('es-CL')}</td>
              <td style={{ color: f.pct_variacion == null ? undefined : f.pct_variacion >= 0 ? '#2f9e44' : '#e5484d' }}>
                {f.pct_variacion == null ? '—' : `${f.pct_variacion}%`}
              </td>
            </tr>
          ))}
          {total && (
            <tr className="fila-total">
              <td colSpan={3}>Total</td>
              <td>{total.acum_actual?.toLocaleString('es-CL')}</td>
              <td></td>
              <td></td>
              <td>{total.acum_anterior?.toLocaleString('es-CL')}</td>
              <td>{total.pct_variacion == null ? '—' : `${total.pct_variacion}%`}</td>
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
