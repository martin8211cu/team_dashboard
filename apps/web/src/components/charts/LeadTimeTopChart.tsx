import { Bar } from "react-chartjs-2";
import type { SprintMetricsSummary } from "@team-dashboard/shared";
import { ensureChartsRegistered } from "./chartSetup";
import { chartGridColor, chartTextColor, paletteColor } from "./chartColors";

ensureChartsRegistered();

export function LeadTimeTopChart({ summary }: { summary: SprintMetricsSummary }) {
  const items = summary.topLeadTime;

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="chart-panel">
      <h3>Top 10 lead time (days)</h3>
      <div className="chart-canvas-wrap">
        <Bar
          data={{
            labels: items.map((item) => item.key),
            datasets: [
              {
                label: "Lead time (d)",
                data: items.map((item) => item.leadTimeDays),
                backgroundColor: paletteColor(0),
              },
            ],
          }}
          options={{
            indexAxis: "y",
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  afterLabel: (context) => items[context.dataIndex]?.summary ?? "",
                },
              },
            },
            scales: {
              x: {
                ticks: { color: chartTextColor() },
                grid: { color: chartGridColor() },
              },
              y: {
                ticks: { color: chartTextColor() },
                grid: { display: false },
              },
            },
          }}
        />
      </div>
    </div>
  );
}
