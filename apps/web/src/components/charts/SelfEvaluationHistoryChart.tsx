import { Line } from "react-chartjs-2";
import type { FollowUpSelfEvaluation } from "@team-dashboard/shared";
import { FOLLOW_UP_EVALUATION_DIMENSIONS, formatPeriodLabel } from "@team-dashboard/shared";
import { ensureChartsRegistered } from "./chartSetup";
import { chartGridColor, chartTextColor, paletteColor } from "./chartColors";

ensureChartsRegistered();

type SelfEvaluationHistoryChartProps = {
  history: FollowUpSelfEvaluation[];
};

export function SelfEvaluationHistoryChart({ history }: SelfEvaluationHistoryChartProps) {
  if (history.length === 0) {
    return null;
  }

  const labels = history.map((item) => formatPeriodLabel(item.period));
  const avgColor = paletteColor(0);

  const datasets = [
    {
      label: "Average",
      data: history.map((item) => item.promedio),
      borderColor: avgColor,
      backgroundColor: avgColor,
      borderWidth: 3,
      tension: 0.25,
      pointRadius: 5,
      order: 0,
    },
    ...FOLLOW_UP_EVALUATION_DIMENSIONS.map((dim, index) => {
      const color = paletteColor(index + 1);
      return {
        label: dim.label,
        data: history.map((item) => item[dim.key]),
        borderColor: color,
        backgroundColor: color,
        borderWidth: 1.5,
        borderDash: [4, 3] as number[],
        tension: 0.25,
        pointRadius: 3,
        order: index + 1,
      };
    }),
  ];

  return (
    <div className="chart-panel personal-self-eval-chart">
      <h3 className="chart-panel-title">Self-evaluation trend</h3>
      <p className="meta-line meta-muted">Last {history.length} submitted period{history.length === 1 ? "" : "s"}</p>
      <div className="chart-canvas-wrap">
        <Line
          data={{ labels, datasets }}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: "index", intersect: false },
            plugins: {
              legend: {
                position: "bottom",
                labels: {
                  color: chartTextColor(),
                  boxWidth: 12,
                  font: { size: 11 },
                },
              },
              tooltip: {
                callbacks: {
                  label(context) {
                    const value = context.parsed.y;
                    if (value == null) {
                      return `${context.dataset.label}: —`;
                    }
                    return `${context.dataset.label}: ${Number(value).toFixed(1)}`;
                  },
                },
              },
            },
            scales: {
              x: {
                ticks: { color: chartTextColor() },
                grid: { color: chartGridColor() },
              },
              y: {
                min: 1,
                max: 5,
                ticks: {
                  stepSize: 1,
                  color: chartTextColor(),
                },
                grid: { color: chartGridColor() },
              },
            },
          }}
        />
      </div>
    </div>
  );
}
