import { useEffect, useState } from 'react'
import { apiFetch } from '../../api/client'
import { downloadFile } from '../../api/download'
import BusinessIcon from '@mui/icons-material/Business'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import FileDownloadIcon from '@mui/icons-material/FileDownload'
import PanelTabs from '../../components/panel/PanelTabs'
import CuadroResumenBloque from './crci/CuadroResumenBloque'
import MovimientoDiarioBloque from './crci/MovimientoDiarioBloque'

const MESES = [
  { value: 1, label: 'Enero' },
  { value: 2, label: 'Febrero' },
  { value: 3, label: 'Marzo' },
  { value: 4, label: 'Abril' },
  { value: 5, label: 'Mayo' },
  { value: 6, label: 'Junio' },
  { value: 7, label: 'Julio' },
  { value: 8, label: 'Agosto' },
  { value: 9, label: 'Septiembre' },
  { value: 10, label: 'Octubre' },
  { value: 11, label: 'Noviembre' },
  { value: 12, label: 'Diciembre' },
]

const ANIO_ACTUAL = new Date().getFullYear()
const ANIOS = Array.from({ length: 6 }, (_, i) => 2024 + i).filter((a) => a <= ANIO_ACTUAL + 1)

const TABS = [
  { key: 'resumen', label: 'Cuadro Resumen' },
  { key: 'movimiento', label: 'Movimiento Diario' },
]

export default function PanelCrci() {
  const [productos, setProductos] = useState(null)
  const [productosError, setProductosError] = useState('')
  const [idProducto, setIdProducto] = useState(null)
  const [mes, setMes] = useState(new Date().getMonth() + 1)
  const [anio, setAnio] = useState(ANIO_ACTUAL)
  const [iteraciones, setIteraciones] = useState(null)
  const [iteracionesError, setIteracionesError] = useState('')
  const [fechaProceso, setFechaProceso] = useState('')
  const [tab, setTab] = useState('resumen')
  const [descargaError, setDescargaError] = useState('')

  useEffect(() => {
    apiFetch('/panel/crci/productos')
      .then((rows) => {
        setProductos(rows)
        if (rows.length) setIdProducto(rows[0].id_producto)
      })
      .catch((err) => setProductosError(err.message))
  }, [])

  useEffect(() => {
    if (!idProducto) return
    setIteraciones(null)
    setIteracionesError('')
    setFechaProceso('')
    apiFetch(`/panel/crci/iteraciones?id_producto=${idProducto}&mes=${mes}&anio=${anio}`)
      .then((data) => {
        setIteraciones(data.iteraciones)
        if (data.iteraciones.length) setFechaProceso(data.iteraciones[data.iteraciones.length - 1])
      })
      .catch((err) => setIteracionesError(err.message))
  }, [idProducto, mes, anio])

  const tabLabel = TABS.find((t) => t.key === tab)?.label ?? ''

  async function descargarSabana() {
    setDescargaError('')
    try {
      const query = `id_producto=${idProducto}&mes=${mes}&anio=${anio}&fecha_proceso=${encodeURIComponent(fechaProceso)}`
      await downloadFile(`/panel/crci/descarga?${query}`, `Sabana_CRCI_${fechaProceso}.xlsx`)
    } catch (err) {
      setDescargaError(err.message)
    }
  }

  return (
    <div className="panel-page">
      <div className="panel-heading">
        <div className="panel-heading-title">
          <h1>CRCI</h1>
          <span className="panel-heading-context">{tabLabel}</span>
        </div>
        <div className="panel-heading-meta">
          <span className="panel-heading-badge">
            <BusinessIcon /> Mandante: CRCI
          </span>
          <span className="panel-heading-badge">
            <CalendarMonthIcon /> Período: {String(mes).padStart(2, '0')}/{anio}
          </span>
        </div>
      </div>

      {productosError && <p className="login-error">{productosError}</p>}
      {!productosError && !productos && <p>Cargando productos...</p>}

      {productos && productos.length > 0 && (
        <>
          <div className="panel-toolbar">
            <div className="panel-toolbar-filters">
              <label className="panel-selector">
                Producto
                <select value={idProducto ?? ''} onChange={(e) => setIdProducto(Number(e.target.value))}>
                  {productos.map((p) => (
                    <option key={p.id_producto} value={p.id_producto}>
                      {p.id_producto} — {p.nombre}
                    </option>
                  ))}
                </select>
              </label>
              <label className="panel-selector">
                Mes
                <select value={mes} onChange={(e) => setMes(Number(e.target.value))}>
                  {MESES.map((m) => (
                    <option key={m.value} value={m.value}>
                      {String(m.value).padStart(2, '0')} — {m.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="panel-selector">
                Año
                <select value={anio} onChange={(e) => setAnio(Number(e.target.value))}>
                  {ANIOS.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </label>
              <label className="panel-selector">
                Iteración
                <select value={fechaProceso} onChange={(e) => setFechaProceso(e.target.value)} disabled={!iteraciones?.length}>
                  {!iteraciones?.length && <option value="">-- Sin iteraciones --</option>}
                  {iteraciones?.map((it) => (
                    <option key={it} value={it}>
                      {it}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="panel-toolbar-actions">
              <button type="button" className="panel-download-btn" onClick={descargarSabana} disabled={!fechaProceso}>
                <FileDownloadIcon /> Descargar Sábana
              </button>
            </div>
          </div>

          {iteracionesError && <p className="login-error">{iteracionesError}</p>}
          {iteraciones && iteraciones.length === 0 && (
            <p>No hay iteraciones cargadas para este producto y período todavía.</p>
          )}
          {descargaError && <p className="login-error">{descargaError}</p>}

          <PanelTabs tabs={TABS} active={tab} onChange={setTab} />

          <div className="panel-tab-content">
            {tab === 'resumen' && (
              <CuadroResumenBloque idProducto={idProducto} mes={mes} anio={anio} fechaProceso={fechaProceso} />
            )}
            {tab === 'movimiento' && <MovimientoDiarioBloque idProducto={idProducto} mes={mes} anio={anio} />}
          </div>
        </>
      )}
    </div>
  )
}
