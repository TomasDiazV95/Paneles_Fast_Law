import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

const formatMillones = (v) => `$${(v / 1_000_000).toFixed(1)}M`

export default function BarChartVertical({ data, xKey, yKey, height = 220, color = '#4A9EE8' }) {
  return (
    <div className="chart-box" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ left: 12, right: 12 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey={xKey} tick={{ fontSize: 11 }} />
          <YAxis tickFormatter={formatMillones} width={70} />
          <Tooltip formatter={(value) => value.toLocaleString('es-CL')} />
          <Bar dataKey={yKey} fill={color} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
