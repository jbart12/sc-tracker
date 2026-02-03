import { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

interface RTPGaugeProps {
  rtp: number | null;
}

// RTP color thresholds
const RTP_COLORS = {
  good: '#22c55e',    // >= 100%
  warning: '#f59e0b', // >= 80%
  danger: '#ef4444',  // < 80%
} as const;

function getRTPColor(rtp: number): string {
  if (rtp >= 100) return RTP_COLORS.good;
  if (rtp >= 80) return RTP_COLORS.warning;
  return RTP_COLORS.danger;
}

// Static background data - defined outside component to prevent recreation
const BACKGROUND_DATA = [{ value: 100, fill: 'var(--bg-tertiary)' }];

export function RTPGauge({ rtp }: RTPGaugeProps) {
  // Memoize gauge data to prevent unnecessary re-renders
  const { gaugeData, color } = useMemo(() => {
    if (rtp === null) return { gaugeData: [], color: RTP_COLORS.danger };

    const displayRTP = Math.min(rtp, 200);
    const percentage = displayRTP / 200; // 0-200% scale
    const rtpColor = getRTPColor(rtp);

    return {
      gaugeData: [
        { value: percentage * 100, fill: rtpColor },
        { value: (1 - percentage) * 100, fill: 'transparent' },
      ],
      color: rtpColor,
    };
  }, [rtp]);

  if (rtp === null) {
    return <p className="no-data">No RTP data available</p>;
  }

  return (
    <div className="rtp-gauge">
      <ResponsiveContainer width="100%" height={160}>
        <PieChart>
          {/* Background arc */}
          <Pie
            data={BACKGROUND_DATA}
            cx="50%"
            cy="85%"
            startAngle={180}
            endAngle={0}
            innerRadius={60}
            outerRadius={80}
            dataKey="value"
            stroke="none"
          >
            <Cell fill="var(--bg-tertiary)" />
          </Pie>
          {/* Value arc */}
          <Pie
            data={gaugeData}
            cx="50%"
            cy="85%"
            startAngle={180}
            endAngle={0}
            innerRadius={60}
            outerRadius={80}
            dataKey="value"
            stroke="none"
          >
            <Cell fill={color} />
            <Cell fill="transparent" />
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="rtp-value" style={{ color }}>
        {rtp.toFixed(1)}%
      </div>
      <div className="rtp-labels">
        <span>0%</span>
        <span>100%</span>
        <span>200%</span>
      </div>
    </div>
  );
}
