import { Doughnut } from "react-chartjs-2";
import type { SprintMetricsSummary } from "@team-dashboard/shared";
import { ensureChartsRegistered } from "./chartSetup";
import { chartTextColor, paletteColor } from "./chartColors";

ensureChartsRegistered();

export function TypeDoughnutChart({ summary }: { summary: SprintMetricsSummary }) {
  if (summary.byType.length === 0) {
    return null;
  }

  return (
    <div className="chart-panel">
      <h3>Tickets by type</h3>
      <div className="chart-canvas-wrap chart-canvas-wrap-square">
        <Doughnut
          data={{
            labels: summary.byType.map((item) => item.type),
            datasets: [
              {
                data: summary.byType.map((item) => item.count),
                backgroundColor: summary.byType.map((_, index) => paletteColor(index)),
              },
            ],
          }}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                position: "bottom",
                labels: { color: chartTextColor(), boxWidth: 12 },
              },
            },
          }}
        />
      </div>
    </div>
  );
}
