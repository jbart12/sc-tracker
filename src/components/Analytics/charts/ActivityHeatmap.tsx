import type { ActivityHeatmapData } from '../../../utils/chartDataUtils';
import { formatCurrencyCompact } from '../../../utils/formatters';
import './ActivityHeatmap.css';

interface ActivityHeatmapProps {
  data: ActivityHeatmapData[];
  year: number;
}

// Profit thresholds for heatmap color intensity
const PROFIT_THRESHOLDS = {
  HIGH_WIN: 500,
  MEDIUM_WIN: 100,
  MEDIUM_LOSS: -100,
  HIGH_LOSS: -500,
} as const;

function getIntensityClass(count: number, profit: number): string {
  if (count === 0) return 'level-0';

  // Use profit to determine color intensity
  if (profit > 0) {
    if (profit >= PROFIT_THRESHOLDS.HIGH_WIN) return 'level-win-3';
    if (profit >= PROFIT_THRESHOLDS.MEDIUM_WIN) return 'level-win-2';
    return 'level-win-1';
  } else if (profit < 0) {
    if (profit <= PROFIT_THRESHOLDS.HIGH_LOSS) return 'level-loss-3';
    if (profit <= PROFIT_THRESHOLDS.MEDIUM_LOSS) return 'level-loss-2';
    return 'level-loss-1';
  }
  return 'level-even';
}

export function ActivityHeatmap({ data, year }: ActivityHeatmapProps) {
  const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Group data by week for display
  const weeks: ActivityHeatmapData[][] = [];
  let currentWeek: ActivityHeatmapData[] = [];

  // Pad the first week with empty days
  if (data.length > 0) {
    const firstDayOfWeek = new Date(data[0].date).getDay();
    for (let i = 0; i < firstDayOfWeek; i++) {
      currentWeek.push({ date: '', count: 0, profit: 0 });
    }
  }

  for (const day of data) {
    currentWeek.push(day);
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }

  // Pad the last week
  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) {
      currentWeek.push({ date: '', count: 0, profit: 0 });
    }
    weeks.push(currentWeek);
  }

  // Calculate month positions for labels
  const monthPositions: { month: string; weekIndex: number }[] = [];
  let lastMonth = -1;
  weeks.forEach((week, weekIndex) => {
    for (const day of week) {
      if (day.date) {
        const month = new Date(day.date).getMonth();
        if (month !== lastMonth) {
          monthPositions.push({ month: monthLabels[month], weekIndex });
          lastMonth = month;
        }
        break;
      }
    }
  });

  const totalSessions = data.reduce((sum, d) => sum + d.count, 0);

  if (totalSessions === 0) {
    return <p className="no-data">No activity data for {year}</p>;
  }

  return (
    <div className="activity-heatmap">
      <div className="heatmap-container">
        <div className="day-labels">
          {dayLabels.map((day, i) => (
            <span key={day} className={i % 2 === 1 ? 'show' : ''}>
              {i % 2 === 1 ? day : ''}
            </span>
          ))}
        </div>
        <div className="heatmap-grid-wrapper">
          <div className="month-labels">
            {monthPositions.map(({ month, weekIndex }) => (
              <span
                key={`${month}-${weekIndex}`}
                style={{ gridColumnStart: weekIndex + 1 }}
              >
                {month}
              </span>
            ))}
          </div>
          <div className="heatmap-grid">
            {weeks.map((week, weekIndex) => (
              <div key={weekIndex} className="week-column">
                {week.map((day, dayIndex) => (
                  <div
                    key={`${weekIndex}-${dayIndex}`}
                    className={`day-cell ${day.date ? getIntensityClass(day.count, day.profit) : 'empty'}`}
                    title={
                      day.date
                        ? `${new Date(day.date).toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                          })}: ${day.count} session${day.count !== 1 ? 's' : ''}, ${formatCurrencyCompact(day.profit, true)}`
                        : ''
                    }
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="heatmap-legend">
        <span>Loss</span>
        <div className="legend-cells">
          <div className="day-cell level-loss-3" title="-$500+" />
          <div className="day-cell level-loss-2" title="-$100 to -$500" />
          <div className="day-cell level-loss-1" title="Small loss" />
          <div className="day-cell level-0" title="No sessions" />
          <div className="day-cell level-even" title="Break even" />
          <div className="day-cell level-win-1" title="Small win" />
          <div className="day-cell level-win-2" title="+$100 to +$500" />
          <div className="day-cell level-win-3" title="+$500+" />
        </div>
        <span>Win</span>
      </div>
    </div>
  );
}
