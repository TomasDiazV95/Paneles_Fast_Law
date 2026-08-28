import { useEffect, useState } from 'react'
import { apiFetch } from '../../../api/client'
import { downloadFile } from '../../../api/download'
import KpiCard from '../../../components/panel/KpiCard'
import FolderIcon from '@mui/icons-material/Folder'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import FileDownloadIcon from '@mui/icons-material/FileDownload'

export default function SalidasTab({ periodo }) {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')
  const [descargaError, setDescargaError] = useState('')

  useEffect(() => {
    setRows(null)
    apiFetch(`/panel/cenco/salidas?periodo=${periodo}`)
      .then(setRows)
      .catch((err) => setError(err.message))
  }, [periodo])

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

  return (
    <>
      <div className="kpi-row">
        <KpiCard label="Total Casos" value={rows.length.toLocaleString('es-CL')} icon={<FolderIcon />} highlight />
        <KpiCard label="Casos Duplicados" value={totalDuplicados.toLocaleString('es-CL')} icon={<WarningAmberIcon />} />
      </div>

      <div className="panel-toolbar-actions">
        <button type="button" className="panel-download-btn" onClick={descargar}>
          <FileDownloadIcon /> Descargar Salidas
        </button>
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
              <th>Marca Glosa Abogados</th>
              <th>Marca</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={`${row.numero_juicio}-${idx}`} className={row.es_duplicado ? 'fila-duplicado' : ''}>
                <td>{row.cuenta}</td>
                <td>{row.rut}</td>
                <td>{row.operacion}</td>
                <td>{row.numero_juicio}</td>
                <td>{row.marca_glosa_abogados}</td>
                <td>{row.marca}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
