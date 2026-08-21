import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { CHART_COLORS } from './colors'

export default function DonutChart({ data, height = 280, title }) {
  const total = data.reduce((sum, d) => sum + d.value, 0)

  return (
    <div className="chart-box">
      {title && <p className="chart-title">{title}</p>}
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
            <Pie data={data} dataKey="value" nameKey="label" innerRadius="55%" outerRadius="80%" paddingAngle={2}>
              {data.map((entry, index) => (
                <Cell key={entry.label} fill={entry.color ?? CHART_COLORS[index % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value, name) => [`${value.toLocaleString('es-CL')} (${((value / total) * 100).toFixed(1)}%)`, name]}
            />
            <Legend
              layout="vertical"
              align="right"
              verticalAlign="middle"
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: 12, lineHeight: '18px' }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
