import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

export default function StackedBarChartVertical({ data, xKey, series, height = 240, title, xFormatter }) {
  return (
    <div className="chart-box">
      {title && <p className="chart-title">{title}</p>}
      <div className="chart-box-canvas" style={{ minHeight: height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, left: 4, right: 12, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey={xKey}
              tick={{ fontSize: 11 }}
              tickFormatter={xFormatter}
            />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip formatter={(value) => value.toLocaleString('es-CL')} labelStyle={{ fontWeight: 600 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {series.map((s) => (
              <Bar key={s.key} dataKey={s.key} name={s.label} stackId="stack" fill={s.color} maxBarSize={36} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
