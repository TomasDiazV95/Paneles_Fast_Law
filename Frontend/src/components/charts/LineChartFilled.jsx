import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

const formatMillones = (v) => `$${(v / 1_000_000).toFixed(1)}M`

export default function LineChartFilled({ data, xKey, yKey, height = 220, color = '#1F4E79', title }) {
  return (
    <div className="chart-box">
      {title && <p className="chart-title">{title}</p>}
      <div className="chart-box-canvas" style={{ minHeight: height }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, left: 4, right: 12, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey={xKey} tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={formatMillones} width={64} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(value) => value.toLocaleString('es-CL')} labelStyle={{ fontWeight: 600 }} />
            <Area type="monotone" dataKey={yKey} stroke={color} fill={color} fillOpacity={0.18} strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
