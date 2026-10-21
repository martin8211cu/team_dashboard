import { Bar } from "react-chartjs-2";
import type { SprintMetricsSummary } from "@team-dashboard/shared";
import { ensureChartsRegistered } from "./chartSetup";
import { chartGridColor, chartTextColor, paletteColor } from "./chartColors";

ensureChartsRegistered();

export function AssigneeBarChart({ summary }: { summary: SprintMetricsSummary }) {
  const top = summary.byAssignee.slice(0, 12);

  if (top.length === 0) {
    return null;
  }

  return (
    <div className="chart-panel">
      <h3>Tickets by ALTEN member</h3>
      <p className="meta-line chart-panel-note">
        Counts tickets each member participated in (may sum to more than one person per ticket).
      </p>
      <div className="chart-canvas-wrap">
        <Bar
          data={{
            labels: top.map((item) => item.assignee),
            datasets: [
              {
                label: "Tickets",
                data: top.map((item) => item.count),
                backgroundColor: paletteColor(2),
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
