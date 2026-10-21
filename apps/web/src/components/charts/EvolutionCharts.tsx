import { Line } from "react-chartjs-2";
import type { SprintEvolutionPoint } from "@team-dashboard/shared";
import { ensureChartsRegistered } from "./chartSetup";
import type { KpiHelpId } from "../../lib/kpiHelp";
import { ChartPanelTitle } from "../KpiInfo";
import { chartGridColor, chartTextColor, paletteColor } from "./chartColors";
import { VelocityBarChart } from "./VelocityBarChart";

ensureChartsRegistered();

type LineMetricKey =
  | "commitmentStoryPointsPct"
  | "commitmentTicketsPct"
  | "scopeCreepPct"
  | "bugRatePct"
  | "avgCycleTime"
  | "avgLeadTime"
  | "bugsCreated";

const KPI_LINE_CHARTS: {
  key: LineMetricKey;
  title: string;
  helpId: KpiHelpId;
  colorIndex: number;
  percent?: boolean;
}[] = [
  {
    key: "commitmentStoryPointsPct",
    title: "Commitment SP (%)",
    helpId: "commitmentSpPct",
    colorIndex: 2,
    percent: true,
  },
  {
    key: "commitmentTicketsPct",
    title: "Commitment tickets (%)",
    helpId: "commitmentTicketsPct",
    colorIndex: 3,
    percent: true,
  },
  { key: "scopeCreepPct", title: "Scope creep (%)", helpId: "scopeCreep", colorIndex: 5, percent: true },
  { key: "bugRatePct", title: "Bug rate (%)", helpId: "bugRate", colorIndex: 6, percent: true },
];

const FLOW_LINE_CHARTS: {
  key: LineMetricKey;
  title: string;
  helpId: KpiHelpId;
  colorIndex: number;
  integer?: boolean;
}[] = [
  { key: "avgCycleTime", title: "Avg cycle time (d)", helpId: "cycleTime", colorIndex: 0 },
  { key: "avgLeadTime", title: "Avg lead time (d)", helpId: "leadTime", colorIndex: 4 },
  { key: "bugsCreated", title: "New bugs", helpId: "bugNew", colorIndex: 7, integer: true },
];

function formatValue(value: number | null): number | null {
  if (value == null || Number.isNaN(value)) {
    return null;
  }
  return value;
}

function EvolutionLineChart({
  title,
  helpId,
  labels,
  values,
  colorIndex,
  integer = false,
  percent = false,
}: {
  title: string;
  helpId: KpiHelpId;
  labels: string[];
  values: Array<number | null>;
  colorIndex: number;
  integer?: boolean;
  percent?: boolean;
}) {
  const color = paletteColor(colorIndex);

  return (
    <div className="chart-panel">
      <ChartPanelTitle title={title} helpId={helpId} />
      <div className="chart-canvas-wrap chart-canvas-wrap-compact">
        <Line
          data={{
            labels,
            datasets: [
              {
                label: title,
                data: values,
                borderColor: color,
                backgroundColor: color,
                tension: 0.25,
                pointRadius: 5,
                spanGaps: true,
              },
            ],
          }}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
            },
            scales: {
              x: {
                ticks: { color: chartTextColor() },
                grid: { color: chartGridColor() },
              },
              y: {
                beginAtZero: true,
                max: percent ? 100 : undefined,
                ticks: {
                  color: chartTextColor(),
                  precision: integer ? 0 : percent ? 0 : undefined,
                  callback: percent
                    ? (value) => `${value}%`
                    : undefined,
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

export function EvolutionCharts({ points }: { points: SprintEvolutionPoint[] }) {
  if (points.length === 0) {
    return <p className="meta-line">Select sprints with a metrics snapshot.</p>;
  }

  const labels = points.map((point) => `S${point.sprintNumber}`);

  return (
    <>
      <h3 className="charts-subsection-title">KPIs</h3>
      <section className="charts-grid charts-grid-evolution">
        {KPI_LINE_CHARTS.map((chart) => (
          <EvolutionLineChart
            key={chart.key}
            title={chart.title}
            helpId={chart.helpId}
            labels={labels}
            values={points.map((point) => formatValue(point[chart.key]))}
            colorIndex={chart.colorIndex}
            percent={chart.percent}
          />
        ))}
      </section>

      <h3 className="charts-subsection-title">Velocity and flow</h3>
      <section className="charts-grid charts-grid-evolution">
        <VelocityBarChart
          title="Velocity (SP)"
          helpId="velocitySp"
          labels={labels}
          planned={points.map((point) => point.plannedStoryPoints)}
          done={points.map((point) => point.doneStoryPoints)}
        />
        <VelocityBarChart
          title="Velocity (tickets)"
          helpId="velocityTickets"
          labels={labels}
          planned={points.map((point) => point.plannedTickets)}
          done={points.map((point) => point.doneTickets)}
        />
        {FLOW_LINE_CHARTS.map((chart) => (
          <EvolutionLineChart
            key={chart.key}
            title={chart.title}
            helpId={chart.helpId}
            labels={labels}
            values={points.map((point) => formatValue(point[chart.key]))}
            colorIndex={chart.colorIndex}
            integer={chart.integer}
          />
        ))}
      </section>
    </>
  );
}
