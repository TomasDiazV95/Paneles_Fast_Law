import { Link } from 'react-router-dom'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'

export default function BackButton({ to = '/' }) {
  return (
    <Link to={to} className="app-topbar-btn app-back-btn">
      <ArrowBackIcon /> Volver
    </Link>
  )
}
