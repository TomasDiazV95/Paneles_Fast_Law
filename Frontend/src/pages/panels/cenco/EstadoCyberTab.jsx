import { useEffect, useState } from 'react'
import { apiFetch } from '../../../api/client'
import { downloadFile } from '../../../api/download'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import CancelIcon from '@mui/icons-material/Cancel'
import FolderIcon from '@mui/icons-material/Folder'
import FileDownloadIcon from '@mui/icons-material/FileDownload'

const TAMANO_PAGINA = 15

export default function EstadoCyberTab({ periodo }) {
  const [resumen, setResumen] = useState(null)
  const [filas, setFilas] = useState(null)
  const [pagina, setPagina] = useState(1)
  const [estadoFiltro, setEstadoFiltro] = useState(null) // null = todos, 'ACTUALIZADO' | 'NO ACTUALIZADO'
  const [error, setError] = useState('')
  const [descargaError, setDescargaError] = useState('')

  useEffect(() => {
    setPagina(1)
  }, [periodo, estadoFiltro])

  useEffect(() => {
    setFilas(null)
    setError('')
    const params = new URLSearchParams({ periodo })
    if (estadoFiltro) params.set('estado', estadoFiltro)

    apiFetch(`/panel/cenco/estado-cyber?${params.toString()}`)
      .then((data) => {
        setResumen(data.resumen)
        setFilas(data.filas)
      })
      .catch((err) => setError(err.message))
  }, [periodo, estadoFiltro])

  function toggleFiltro(valor) {
    setEstadoFiltro((prev) => (prev === valor ? null : valor))
  }

  async function descargar() {
    setDescargaError('')
    try {
      const params = new URLSearchParams({ periodo })
      if (estadoFiltro) params.set('estado', estadoFiltro)
      await downloadFile(
        `/panel/cenco/estado-cyber/descarga?${params.toString()}`,
        `EstadoCyber_CENCO_${periodo}.xlsx`,
      )
    } catch (err) {
      setDescargaError(err.message)
    }
  }

  if (error) return <p className="login-error">{error}</p>
  if (!resumen) return <p>Cargando...</p>

  const totalPaginas = filas ? Math.ceil(filas.length / TAMANO_PAGINA) || 1 : 1
  const filasPagina = filas ? filas.slice((pagina - 1) * TAMANO_PAGINA, pagina * TAMANO_PAGINA) : []

  return (
    <>
      <div className="kpi-row">
        <button
          type="button"
          className={`kpi-card kpi-card--clickable${estadoFiltro === 'ACTUALIZADO' ? ' kpi-card--highlight' : ''}`}
          onClick={() => toggleFiltro('ACTUALIZADO')}
          aria-pressed={estadoFiltro === 'ACTUALIZADO'}
        >
          <span className="kpi-icon">
            <CheckCircleIcon />
          </span>
          <span className="kpi-card-body">
            <span className="kpi-label">Actualizado</span>
            <span className="kpi-value">{resumen.q_actualizado.toLocaleString('es-CL')}</span>
          </span>
        </button>
        <button
          type="button"
          className={`kpi-card kpi-card--clickable${estadoFiltro === 'NO ACTUALIZADO' ? ' kpi-card--highlight' : ''}`}
          onClick={() => toggleFiltro('NO ACTUALIZADO')}
          aria-pressed={estadoFiltro === 'NO ACTUALIZADO'}
        >
          <span className="kpi-icon">
            <CancelIcon />
          </span>
          <span className="kpi-card-body">
            <span className="kpi-label">No Actualizado</span>
            <span className="kpi-value">{resumen.q_no_actualizado.toLocaleString('es-CL')}</span>
          </span>
        </button>
        <button
          type="button"
          className={`kpi-card kpi-card--clickable${estadoFiltro === null ? ' kpi-card--highlight' : ''}`}
          onClick={() => setEstadoFiltro(null)}
          aria-pressed={estadoFiltro === null}
        >
          <span className="kpi-icon">
            <FolderIcon />
          </span>
          <span className="kpi-card-body">
            <span className="kpi-label">Total</span>
            <span className="kpi-value">{resumen.q_total.toLocaleString('es-CL')}</span>
          </span>
        </button>
      </div>

      <div className="panel-toolbar-actions">
        <button
          type="button"
          className="panel-download-btn"
          onClick={descargar}
          aria-label="Descargar Estado Cyber en Excel"
        >
          <FileDownloadIcon /> Descargar Estado Cyber
        </button>
      </div>

      {descargaError && <p className="login-error">{descargaError}</p>}

      {!filas ? (
        <p>Cargando...</p>
      ) : filas.length === 0 ? (
        <p>No hay registros para los filtros seleccionados.</p>
      ) : (
        <>
          <div className="panel-table-wrapper">
            <table className="panel-table">
              <thead>
                <tr>
                  <th>RUT</th>
                  <th>DV</th>
                  <th>U6ID</th>
                  <th>Operación</th>
                  <th>Tipo de Cuenta</th>
                  <th>Resp. Autogestión</th>
                  <th>Resp. JFastco</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {filasPagina.map((row) => (
                  <tr key={`${row.rut}-${row.dv}-${row.u6id}-${row.operacion}`}>
                    <td>{row.rut}</td>
                    <td>{row.dv}</td>
                    <td>{row.u6id}</td>
                    <td>{row.operacion}</td>
                    <td>{row.tipo_de_cuenta}</td>
                    <td>{row.rsp_auto_ges}</td>
                    <td>{row.resp_jfastco}</td>
                    <td>{row.estado}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPaginas > 1 && (
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
                onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
              >
                Siguiente ›
              </button>
            </div>
          )}
        </>
      )}
    </>
  )
}
