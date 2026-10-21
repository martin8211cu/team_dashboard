import { Bar } from "react-chartjs-2";
import { ensureChartsRegistered } from "./chartSetup";
import type { KpiHelpId } from "../../lib/kpiHelp";
import { ChartPanelTitle } from "../KpiInfo";
import { chartGridColor, chartTextColor, paletteColor } from "./chartColors";

ensureChartsRegistered();

export function VelocityBarChart({
  title,
  helpId,
  labels,
  planned,
  done,
}: {
  title: string;
  helpId: KpiHelpId;
  labels: string[];
  planned: number[];
  done: number[];
}) {
  return (
    <div className="chart-panel chart-panel-wide">
      <ChartPanelTitle title={title} helpId={helpId} />
      <p className="meta-line chart-panel-note">Planned = sprint scope · Done = Done/Closed</p>
      <div className="chart-canvas-wrap">
        <Bar
          data={{
            labels,
            datasets: [
              {
                label: "Planned",
                data: planned,
                backgroundColor: paletteColor(1),
              },
              {
                label: "Done",
                data: done,
                backgroundColor: paletteColor(2),
              },
            ],
          }}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                display: true,
                labels: { color: chartTextColor() },
              },
            },
            scales: {
              x: {
                ticks: { color: chartTextColor() },
                grid: { display: false },
              },
              y: {
                beginAtZero: true,
                ticks: { color: chartTextColor(), precision: 0 },
                grid: { color: chartGridColor() },
              },
            },
          }}
        />
      </div>
    </div>
  );
}
