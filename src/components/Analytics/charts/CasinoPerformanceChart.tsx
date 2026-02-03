import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from 'recharts';
import type { CasinoPerformanceData } from '../../../utils/chartDataUtils';
import { formatCurrencyCompact } from '../../../utils/formatters';

interface CasinoPerformanceChartProps {
  data: CasinoPerformanceData[];
}

export function CasinoPerformanceChart({ data }: CasinoPerformanceChartProps) {
  if (data.length === 0) {
    return <p className="no-data">No casino data available</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={Math.max(200, data.length * 40 + 50)}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
        <XAxis
          type="number"
          tickFormatter={(v) => formatCurrencyCompact(v)}
          stroke="var(--text-secondary)"
          tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
        />
        <YAxis
          type="category"
          dataKey="name"
          stroke="var(--text-secondary)"
          tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
          width={75}
        />
        <Tooltip
          formatter={(value, name) => [
            formatCurrencyCompact(Number(value)),
            name === 'totalProfit' ? 'Total (w/ Cashback)' : 'Net P/L',
          ]}
          contentStyle={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
          }}
        />
        <ReferenceLine x={0} stroke="var(--text-secondary)" />
        <Bar dataKey="totalProfit" name="Total (w/ Cashback)" radius={[0, 4, 4, 0]}>
          {data.map((entry) => (
            <Cell
              key={entry.name}
              fill={entry.totalProfit >= 0 ? '#22c55e' : '#ef4444'}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
