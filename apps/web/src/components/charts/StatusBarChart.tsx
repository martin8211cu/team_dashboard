import { Bar } from "react-chartjs-2";
import type { SprintMetricsSummary } from "@team-dashboard/shared";
import { ensureChartsRegistered } from "./chartSetup";
import { chartGridColor, chartTextColor, statusColor } from "./chartColors";

ensureChartsRegistered();

export function StatusBarChart({ summary }: { summary: SprintMetricsSummary }) {
  const labels = summary.byStatus.map((item) => item.status);
  const data = summary.byStatus.map((item) => item.count);

  return (
    <div className="chart-panel">
      <h3>Tickets by status</h3>
      <div className="chart-canvas-wrap">
        <Bar
          data={{
            labels,
            datasets: [
              {
                label: "Tickets",
                data,
                backgroundColor: labels.map((status, index) => statusColor(status, index)),
              },
            ],
          }}
          options={{
            indexAxis: "y",
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              x: {
                ticks: { color: chartTextColor(), precision: 0 },
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
