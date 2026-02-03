import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from 'recharts';
import type { CumulativeProfitDataPoint } from '../../../utils/chartDataUtils';
import { formatCurrencyCompact } from '../../../utils/formatters';

interface CumulativeProfitChartProps {
  data: CumulativeProfitDataPoint[];
}

function formatChartDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function CumulativeProfitChart({ data }: CumulativeProfitChartProps) {
  if (data.length === 0) {
    return <p className="no-data">No session data available</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
        <XAxis
          dataKey="date"
          tickFormatter={formatChartDate}
          stroke="var(--text-secondary)"
          tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
        />
        <YAxis
          tickFormatter={(v) => formatCurrencyCompact(v)}
          stroke="var(--text-secondary)"
          tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
        />
        <Tooltip
          formatter={(value, name) => [
            formatCurrencyCompact(Number(value)),
            name === 'profit' ? 'Net P/L' : 'With Cashback',
          ]}
          labelFormatter={(label) => formatChartDate(String(label))}
          contentStyle={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
          }}
        />
        <Legend />
        <ReferenceLine y={0} stroke="var(--text-secondary)" strokeDasharray="3 3" />
        <Line
          type="monotone"
          dataKey="profit"
          name="Net P/L"
          stroke="#ef4444"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
        <Line
          type="monotone"
          dataKey="profitWithCashback"
          name="With Cashback"
          stroke="#22c55e"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
