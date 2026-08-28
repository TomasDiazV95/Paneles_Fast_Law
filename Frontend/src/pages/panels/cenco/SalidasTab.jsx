import { useEffect, useMemo, useRef, useState } from 'react'
import { apiFetch } from '../../../api/client'
import { downloadFile } from '../../../api/download'
import FolderIcon from '@mui/icons-material/Folder'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import FileDownloadIcon from '@mui/icons-material/FileDownload'
import FilterListIcon from '@mui/icons-material/FilterList'

const FILAS_POR_PAGINA = 10

function diasHabilesDesde(fechaSalida) {
  if (!fechaSalida) return null
  const inicio = new Date(`${fechaSalida}T00:00:00`)
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  let dias = 0
  const cursor = new Date(inicio)
  while (cursor < hoy) {
    cursor.setDate(cursor.getDate() + 1)
    const diaSemana = cursor.getDay()
    if (diaSemana !== 0 && diaSemana !== 6) dias++
  }
  return dias
}

function categoriaSemaforo(dias) {
  if (dias === null) return null
  if (dias <= 2) return 'verde'
  if (dias <= 4) return 'amarillo'
  return 'rojo'
}

const COLOR_POR_CATEGORIA = { verde: 'var(--success)', amarillo: 'var(--warning)', rojo: 'var(--danger)' }

function colorSemaforo(dias) {
  const categoria = categoriaSemaforo(dias)
  return categoria ? COLOR_POR_CATEGORIA[categoria] : null
}

export default function SalidasTab({ periodo }) {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')
  const [descargaError, setDescargaError] = useState('')

  const [fechasSeleccionadas, setFechasSeleccionadas] = useState(new Set())
  const [busquedaFecha, setBusquedaFecha] = useState('')
  const [filtroAbierto, setFiltroAbierto] = useState(false)
  const [filtroPos, setFiltroPos] = useState({ top: 0, left: 0 })
  const [filtroCategoria, setFiltroCategoria] = useState('todos')
  const [pagina, setPagina] = useState(1)

  const filtroRef = useRef(null)
  const filtroBtnRef = useRef(null)

  useEffect(() => {
    setRows(null)
    apiFetch(`/panel/cenco/salidas?periodo=${periodo}`)
      .then(setRows)
      .catch((err) => setError(err.message))
  }, [periodo])

  const fechasUnicas = useMemo(() => {
    if (!rows) return []
    const set = new Set(rows.map((r) => r.fecha_salida).filter(Boolean))
    return Array.from(set).sort()
  }, [rows])

  const filasConCategoria = useMemo(() => {
    if (!rows) return []
    return rows.map((r) => {
      const dias = diasHabilesDesde(r.fecha_salida)
      return { ...r, _dias: dias, _categoria: categoriaSemaforo(dias) }
    })
  }, [rows])

  useEffect(() => {
    if (rows) setFechasSeleccionadas(new Set(fechasUnicas))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows])

  useEffect(() => {
    setPagina(1)
  }, [fechasSeleccionadas, filtroCategoria])

  useEffect(() => {
    function onClickFuera(e) {
      if (filtroRef.current && !filtroRef.current.contains(e.target)) {
        setFiltroAbierto(false)
      }
    }
    document.addEventListener('mousedown', onClickFuera)
    return () => document.removeEventListener('mousedown', onClickFuera)
  }, [])

  async function descargar() {
    setDescargaError('')
    try {
      await downloadFile(`/panel/cenco/salidas/descarga?periodo=${periodo}`, `Salidas_CENCO_${periodo}.xlsx`)
    } catch (err) {
      setDescargaError(err.message)
    }
  }

  if (error) return <p className="login-error">{error}</p>
  if (!rows) return <p>Cargando...</p>

  const totalDuplicados = rows.filter((r) => r.es_duplicado).length
  const totalVerde = filasConCategoria.filter((r) => r._categoria === 'verde').length
  const totalAmarillo = filasConCategoria.filter((r) => r._categoria === 'amarillo').length
  const totalRojo = filasConCategoria.filter((r) => r._categoria === 'rojo').length

  const fechasFiltro = fechasUnicas.filter((f) => f.includes(busquedaFecha))
  const todasVisiblesTildadas = fechasFiltro.length > 0 && fechasFiltro.every((f) => fechasSeleccionadas.has(f))

  function toggleFecha(fecha) {
    setFechasSeleccionadas((prev) => {
      const next = new Set(prev)
      if (next.has(fecha)) next.delete(fecha)
      else next.add(fecha)
      return next
    })
  }

  function toggleTodas() {
    setFechasSeleccionadas((prev) => {
      const next = new Set(prev)
      if (todasVisiblesTildadas) {
        fechasFiltro.forEach((f) => next.delete(f))
      } else {
        fechasFiltro.forEach((f) => next.add(f))
      }
      return next
    })
  }

  const filasFiltradas = filasConCategoria.filter((r) => {
    if (!fechasSeleccionadas.has(r.fecha_salida)) return false
    if (filtroCategoria === 'todos') return true
    if (filtroCategoria === 'duplicados') return r.es_duplicado
    return r._categoria === filtroCategoria
  })
  const totalPaginas = Math.ceil(filasFiltradas.length / FILAS_POR_PAGINA) || 1
  const filasPagina = filasFiltradas.slice((pagina - 1) * FILAS_POR_PAGINA, pagina * FILAS_POR_PAGINA)

  return (
    <>
      <div className="kpi-row">
        <button
          type="button"
          className={`kpi-card kpi-card--clickable${filtroCategoria === 'todos' ? ' kpi-card--highlight' : ''}`}
          onClick={() => setFiltroCategoria('todos')}
        >
          <span className="kpi-icon">
            <FolderIcon />
          </span>
          <span className="kpi-card-body">
            <span className="kpi-label">Total Casos</span>
            <span className="kpi-value">{rows.length.toLocaleString('es-CL')}</span>
          </span>
        </button>
        <button
          type="button"
          className={`kpi-card kpi-card--clickable${filtroCategoria === 'duplicados' ? ' kpi-card--highlight' : ''}`}
          onClick={() => setFiltroCategoria('duplicados')}
        >
          <span className="kpi-icon">
            <WarningAmberIcon />
          </span>
          <span className="kpi-card-body">
            <span className="kpi-label">Casos Duplicados</span>
            <span className="kpi-value">{totalDuplicados.toLocaleString('es-CL')}</span>
          </span>
        </button>
      </div>

      <p className="panel-section-title">Semáforo</p>
      <div className="kpi-row">
        {[
          { categoria: 'verde', label: 'Verde', total: totalVerde },
          { categoria: 'amarillo', label: 'Amarillo', total: totalAmarillo },
          { categoria: 'rojo', label: 'Rojo', total: totalRojo },
        ].map(({ categoria, label, total }) => (
          <button
            key={categoria}
            type="button"
            className={`kpi-card kpi-card--clickable${filtroCategoria === categoria ? ' kpi-card--highlight' : ''}`}
            onClick={() => setFiltroCategoria(categoria)}
          >
            <span className="kpi-icon">
              <span
                style={{
                  display: 'inline-block',
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  background: COLOR_POR_CATEGORIA[categoria],
                }}
              />
            </span>
            <span className="kpi-card-body">
              <span className="kpi-label">{label}</span>
              <span className="kpi-value">{total.toLocaleString('es-CL')}</span>
            </span>
          </button>
        ))}
      </div>

      <div className="panel-toolbar-actions">
        <button type="button" className="panel-download-btn" onClick={descargar}>
          <FileDownloadIcon /> Descargar Salidas
        </button>
        {filtroCategoria !== 'todos' && (
          <button type="button" className="panel-download-btn" onClick={() => setFiltroCategoria('todos')}>
            Borrar filtro
          </button>
        )}
      </div>

      {descargaError && <p className="login-error">{descargaError}</p>}

      <div className="panel-table-wrapper">
        <table className="panel-table">
          <thead>
            <tr>
              <th>Cuenta</th>
              <th>RUT</th>
              <th>Operación</th>
              <th>N° Juicio</th>
              <th>Marca</th>
              <th>
                <div ref={filtroRef} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <span>Fecha Salida</span>
                  <button
                    type="button"
                    ref={filtroBtnRef}
                    onClick={() => {
                      if (!filtroAbierto && filtroBtnRef.current) {
                        const rect = filtroBtnRef.current.getBoundingClientRect()
                        setFiltroPos({ top: rect.bottom, left: rect.left })
                      }
                      setFiltroAbierto((v) => !v)
                    }}
                    aria-label="Filtrar por fecha de salida"
                    title="Filtrar por fecha de salida"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 2,
                      color: fechasSeleccionadas.size < fechasUnicas.length ? 'var(--warning)' : 'inherit',
                    }}
                  >
                    <FilterListIcon fontSize="small" />
                  </button>

                  {filtroAbierto && (
                    <div
                      style={{
                        position: 'fixed',
                        top: filtroPos.top,
                        left: filtroPos.left,
                        zIndex: 20,
                        background: 'var(--card-bg, #fff)',
                        border: '1px solid var(--border)',
                        borderRadius: 6,
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                        padding: 8,
                        width: 200,
                        maxHeight: 260,
                        overflowY: 'auto',
                        fontWeight: 'normal',
                        textTransform: 'none',
                        color: 'var(--text)',
                      }}
                    >
                      <input
                        type="text"
                        value={busquedaFecha}
                        onChange={(e) => setBusquedaFecha(e.target.value)}
                        placeholder="Buscar fecha..."
                        style={{ width: '100%', marginBottom: 6, padding: '4px 6px', boxSizing: 'border-box' }}
                      />
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, cursor: 'pointer' }}>
                        <input type="checkbox" checked={todasVisiblesTildadas} onChange={toggleTodas} />
                        Seleccionar todo
                      </label>
                      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 4 }}>
                        {fechasFiltro.length === 0 && <p style={{ margin: 0, fontSize: 12 }}>Sin resultados</p>}
                        {fechasFiltro.map((fecha) => (
                          <label key={fecha} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', padding: '2px 0' }}>
                            <input
                              type="checkbox"
                              checked={fechasSeleccionadas.has(fecha)}
                              onChange={() => toggleFecha(fecha)}
                            />
                            {fecha}
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </th>
              <th>Semáforo</th>
            </tr>
          </thead>
          <tbody>
            {filasPagina.map((row, idx) => {
              const dias = row._dias
              return (
                <tr key={`${row.numero_juicio}-${idx}`} className={row.es_duplicado ? 'fila-duplicado' : ''}>
                  <td>{row.cuenta}</td>
                  <td>{row.rut}</td>
                  <td>{row.operacion}</td>
                  <td>{row.numero_juicio}</td>
                  <td>{row.marca}</td>
                  <td>{row.fecha_salida}</td>
                  <td>
                    {row.fecha_salida ? (
                      <span
                        title={`${dias} día(s) hábil(es)`}
                        style={{
                          display: 'inline-block',
                          width: 12,
                          height: 12,
                          borderRadius: '50%',
                          background: colorSemaforo(dias),
                        }}
                      />
                    ) : (
                      '-'
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {filasFiltradas.length > FILAS_POR_PAGINA && (
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
            Página {pagina} de {totalPaginas}
          </span>
          <button
            type="button"
            className="panel-download-btn"
            disabled={pagina >= totalPaginas}
            onClick={() => setPagina((p) => p + 1)}
          >
            Siguiente ›
          </button>
        </div>
      )}
    </>
  )
}
