import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

const formatMillones = (v) => `$${(v / 1_000_000).toFixed(1)}M`

export default function LineChartFilled({ data, xKey, yKey, height = 220, color = '#1F4E79' }) {
  return (
    <div className="chart-box" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ left: 12, right: 12 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey={xKey} tick={{ fontSize: 11 }} />
          <YAxis tickFormatter={formatMillones} width={70} />
          <Tooltip formatter={(value) => value.toLocaleString('es-CL')} />
          <Area type="monotone" dataKey={yKey} stroke={color} fill={color} fillOpacity={0.2} strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
