import { useEffect, useState } from 'react'
import { apiFetch } from '../../../api/client'
import { downloadFile } from '../../../api/download'
import FileDownloadIcon from '@mui/icons-material/FileDownload'
import { BUCKET_META, formatEjecutivo } from './bucketMeta'

const FILTRO_LABELS = {
  bucket: 'Estado',
  ejecutivo: 'Ejecutivo',
  tipificacion: 'Tipificación',
  estado_convenio: 'Convenio',
}

const COLUMNAS = [
  { key: 'rut_deudor', label: 'RUT', orden: 'rut_deudor' },
  { key: 'nombre_deudor', label: 'Titular', orden: 'nombre_deudor' },
  { key: 'monto_asignado', label: 'Deuda $', num: true, orden: 'monto_asignado' },
  { key: 'saldo_insoluto', label: 'Saldo insoluto $ (sin homologar)', num: true, orden: 'saldo_insoluto' },
  { key: 'estado_convenio', label: 'Convenio' },
  { key: 'plazo', label: 'Plazo', num: true },
  { key: 'cantidad_gestiones', label: 'Gestiones', num: true, orden: 'cantidad_gestiones' },
  { key: 'ejecutivo', label: 'Ejecutivo', orden: 'ejecutivo' },
  { key: 'tipificacion', label: 'Tipificación' },
  { key: 'fecha_ultima_gestion', label: 'Últ. gestión', orden: 'fecha_ultima_gestion' },
  { key: 'bucket', label: 'Estado gestión', orden: 'bucket' },
]

function buildQuery(params) {
  return Object.entries(params)
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&')
}

export default function DetalleTabla({ periodo, cartera, filtros, onLimpiarFiltros }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [pagina, setPagina] = useState(1)
  const [orden, setOrden] = useState('monto_asignado')
  const [direccion, setDireccion] = useState('desc')
  const [descargaError, setDescargaError] = useState('')

  useEffect(() => {
    setPagina(1)
  }, [periodo, cartera, filtros])

  useEffect(() => {
    setData(null)
    setError('')
    const query = buildQuery({ periodo, cartera, ...filtros, orden, direccion, pagina, tamano_pagina: 100 })
    apiFetch(`/panel/uc/detalle?${query}`)
      .then(setData)
      .catch((err) => setError(err.message))
  }, [periodo, cartera, filtros, orden, direccion, pagina])

  async function descargar() {
    setDescargaError('')
    try {
      const query = buildQuery({ periodo, cartera, ...filtros })
      await downloadFile(`/panel/uc/descarga?${query}`, `detalle_uc_${periodo}.xlsx`)
    } catch (err) {
      setDescargaError(err.message)
    }
  }

  function cambiarOrden(columna) {
    if (!columna.orden) return
    if (orden === columna.orden) {
      setDireccion(direccion === 'asc' ? 'desc' : 'asc')
    } else {
      setOrden(columna.orden)
      setDireccion('desc')
    }
  }

  const filtrosActivos = Object.entries(filtros).filter(([, v]) => v)

  return (
    <div id="detalle-uc">
      <div className="panel-toolbar">
        <div className="panel-toolbar-filters">
          <p className="panel-section-title" style={{ margin: 0 }}>
            Detalle de cuentas {data ? `— ${data.total.toLocaleString('es-CL')} cuentas` : ''}
          </p>
          {filtrosActivos.length > 0 && (
            <>
              {filtrosActivos.map(([clave, valor]) => (
                <span key={clave} className="panel-heading-badge">
                  {FILTRO_LABELS[clave] ?? clave}:{' '}
                  {clave === 'bucket'
                    ? BUCKET_META[valor]?.label ?? valor
                    : clave === 'ejecutivo'
                      ? formatEjecutivo(valor)
                      : valor}
                </span>
              ))}
              <button type="button" className="panel-download-btn" onClick={onLimpiarFiltros}>
                Limpiar filtros
              </button>
            </>
          )}
        </div>
        <div className="panel-toolbar-actions">
          <button type="button" className="panel-download-btn" onClick={descargar}>
            <FileDownloadIcon /> Exportar Excel
          </button>
        </div>
      </div>

      {descargaError && <p className="login-error">{descargaError}</p>}
      {error && <p className="login-error">{error}</p>}
      {!data && !error && <p>Cargando detalle...</p>}

      {data && (
        <>
          {data.filas.length === 0 ? (
            <p>No hay cuentas para esta combinación de filtros.</p>
          ) : (
            <div className="panel-table-wrapper">
              <table className="panel-table">
                <thead>
                  <tr>
                    {COLUMNAS.map((col) => (
                      <th
                        key={col.key}
                        className={col.num ? 'num' : ''}
                        style={col.orden ? { cursor: 'pointer' } : undefined}
                        onClick={() => cambiarOrden(col)}
                      >
                        {col.label}
                        {orden === col.orden ? (direccion === 'asc' ? ' ▲' : ' ▼') : ''}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.filas.map((fila) => (
                    <tr key={`${fila.rut_deudor}-${fila.numero_documento}`}>
                      <td>
                        {fila.rut_deudor}-{fila.dv_deudor}
                      </td>
                      <td>{fila.nombre_deudor}</td>
                      <td className="num">{fila.monto_asignado?.toLocaleString('es-CL') ?? '—'}</td>
                      <td className="num">{fila.saldo_insoluto?.toLocaleString('es-CL') ?? '—'}</td>
                      <td>{fila.estado_convenio ?? '—'}</td>
                      <td className="num">{fila.plazo ?? '—'}</td>
                      <td className="num">{fila.cantidad_gestiones.toLocaleString('es-CL')}</td>
                      <td>{formatEjecutivo(fila.ejecutivo) ?? '—'}</td>
                      <td>{fila.tipificacion ?? '—'}</td>
                      <td>{fila.fecha_ultima_gestion ?? '—'}</td>
                      <td>
                        <span className="panel-heading-badge" style={{ background: BUCKET_META[fila.bucket]?.color, color: '#fff', borderColor: 'transparent' }}>
                          {BUCKET_META[fila.bucket]?.label ?? fila.bucket}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {data.total > data.tamano_pagina && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 10 }}>
              <button
                type="button"
                className="panel-download-btn"
                disabled={pagina <= 1}
                onClick={() => setPagina((p) => Math.max(1, p - 1))}
              >
                ‹ Anterior
              </button>
              <span style={{ fontSize: 13 }}>
                Página {pagina} de {Math.ceil(data.total / data.tamano_pagina)}
              </span>
              <button
                type="button"
                className="panel-download-btn"
                disabled={pagina >= Math.ceil(data.total / data.tamano_pagina)}
                onClick={() => setPagina((p) => p + 1)}
              >
                Siguiente ›
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
