import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CHART_COLORS } from './colors'

export default function BarChartHorizontal({ data, height = 280, valueFormatter, title }) {
  const format = valueFormatter ?? ((v) => v.toLocaleString('es-CL'))

  return (
    <div className="chart-box">
      {title && <p className="chart-title">{title}</p>}
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 4, left: 8, right: 28, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" tickFormatter={format} tick={{ fontSize: 12 }} />
            <YAxis type="category" dataKey="label" width={170} tick={{ fontSize: 12 }} />
            <Tooltip formatter={(value) => format(value)} labelStyle={{ fontWeight: 600 }} />
            <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={28}>
              {data.map((entry, index) => (
                <Cell key={entry.label} fill={CHART_COLORS[index % CHART_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
