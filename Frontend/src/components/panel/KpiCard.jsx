export default function KpiCard({ label, value, icon, hint, highlight = false }) {
  return (
    <div className={highlight ? 'kpi-card kpi-card--highlight' : 'kpi-card'}>
      {icon && <span className="kpi-icon">{icon}</span>}
      <span className="kpi-card-body">
        <span className="kpi-label">{label}</span>
        <span className="kpi-value">{value}</span>
        {hint && <span className="kpi-hint">{hint}</span>}
      </span>
    </div>
  )
}
