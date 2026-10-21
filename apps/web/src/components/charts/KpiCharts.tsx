import { Bar, Doughnut } from "react-chartjs-2";
import type { MetricsRow, SprintMetricsSummary } from "@team-dashboard/shared";
import { ensureChartsRegistered } from "./chartSetup";
import { ChartPanelTitle } from "../KpiInfo";
import { chartGridColor, chartTextColor, paletteColor, statusColor } from "./chartColors";

ensureChartsRegistered();

const CLOSED_STATUSES = new Set(["Closed", "Done", "Canceled"]);
const WIP_STATUSES = new Set([
  "To Do",
  "In Progress",
  "In Development",
  "Ready for Test",
  "Test In Progress",
  "In Testing",
  "Waiting Feedback",
  "ON HOLD",
  "On Hold",
  "Peer Review",
]);

function pctValue(value: number | null): number {
  if (value == null || Number.isNaN(value)) {
    return 0;
  }
  return value;
}

function CommitmentChart({ summary }: { summary: SprintMetricsSummary }) {
  const spDone = pctValue(summary.commitmentStoryPointsPct);
  const ticketsDone = pctValue(summary.commitmentTicketsPct);

  return (
    <div className="chart-panel chart-panel-wide">
      <ChartPanelTitle title="Commitment" helpId="commitment" />
      <p className="meta-line chart-panel-note">
        {summary.velocityStoryPoints}/{summary.totalStoryPoints} SP · {summary.velocityTickets}/
        {summary.total} tickets delivered
      </p>
      <div className="chart-canvas-wrap chart-canvas-wrap-compact">
        <Bar
          data={{
            labels: ["Story Points", "Tickets"],
            datasets: [
              {
                label: "Done",
                data: [spDone, ticketsDone],
                backgroundColor: paletteColor(2),
              },
              {
                label: "Remaining",
                data: [Math.max(0, 100 - spDone), Math.max(0, 100 - ticketsDone)],
                backgroundColor: paletteColor(9),
              },
            ],
          }}
          options={{
            indexAxis: "y",
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                display: true,
                labels: { color: chartTextColor() },
              },
              tooltip: {
                callbacks: {
                  label: (context) => {
                    const value = context.parsed.x ?? 0;
                    return `${context.dataset.label}: ${value.toFixed(1)}%`;
                  },
                },
              },
            },
            scales: {
              x: {
                stacked: true,
                max: 100,
                ticks: {
                  color: chartTextColor(),
                  callback: (value) => `${value}%`,
                },
                grid: { color: chartGridColor() },
              },
              y: {
                stacked: true,
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

function ScopeCreepChart({ summary }: { summary: SprintMetricsSummary }) {
  if (summary.total === 0) {
    return null;
  }

  const initial = summary.total - summary.scopeCreepCount;

  return (
    <div className="chart-panel">
      <ChartPanelTitle title="Scope creep" helpId="scopeCreep" />
      <p className="meta-line chart-panel-note">
        {summary.scopeCreepCount} tickets added ({pctValue(summary.scopeCreepPct).toFixed(1)}%)
      </p>
      <div className="chart-canvas-wrap chart-canvas-wrap-square">
        <Doughnut
          data={{
            labels: ["Initial scope", "Added to sprint"],
            datasets: [
              {
                data: [initial, summary.scopeCreepCount],
                backgroundColor: [paletteColor(1), paletteColor(4)],
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

function BugRateChart({ summary }: { summary: SprintMetricsSummary }) {
  if (summary.velocityTickets === 0) {
    return null;
  }

  const bugs = summary.bugsCreated;
  const otherDelivered = Math.max(0, summary.velocityTickets - bugs);

  return (
    <div className="chart-panel">
      <ChartPanelTitle title="Bug rate" helpId="bugRate" />
      <p className="meta-line chart-panel-note">
        {pctValue(summary.bugRatePct).toFixed(1)}% new bugs over delivered
      </p>
      <div className="chart-canvas-wrap chart-canvas-wrap-square">
        <Doughnut
          data={{
            labels: ["Other delivered", "New bugs"],
            datasets: [
              {
                data: [otherDelivered, bugs],
                backgroundColor: [paletteColor(2), paletteColor(5)],
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

function WipStatusChart({ metrics }: { metrics: MetricsRow[] }) {
  const statusMap = new Map<string, number>();

  for (const row of metrics) {
    if (CLOSED_STATUSES.has(row.status) || !WIP_STATUSES.has(row.status)) {
      continue;
    }
    statusMap.set(row.status, (statusMap.get(row.status) ?? 0) + 1);
  }

  const items = [...statusMap.entries()]
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count);

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="chart-panel">
      <ChartPanelTitle title="WIP by status" helpId="wipByStatus" />
      <p className="meta-line chart-panel-note">{items.reduce((sum, item) => sum + item.count, 0)} open tickets in flow</p>
      <div className="chart-canvas-wrap">
        <Bar
          data={{
            labels: items.map((item) => item.status),
            datasets: [
              {
                label: "Tickets",
                data: items.map((item) => item.count),
                backgroundColor: items.map((item, index) => statusColor(item.status, index)),
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

function BlockedTopChart({ metrics }: { metrics: MetricsRow[] }) {
  const items = [...metrics]
    .filter((row) => row.blockedTimeDays > 0)
    .sort((a, b) => b.blockedTimeDays - a.blockedTimeDays)
    .slice(0, 10);

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="chart-panel">
      <ChartPanelTitle title="Top blocked (days)" helpId="topBlocked" />
      <p className="meta-line chart-panel-note">Time accumulated in Waiting Feedback</p>
      <div className="chart-canvas-wrap">
        <Bar
          data={{
            labels: items.map((item) => item.key),
            datasets: [
              {
                label: "Blocked (d)",
                data: items.map((item) => item.blockedTimeDays),
                backgroundColor: paletteColor(4),
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

export function KpiCharts({
  summary,
  metrics,
}: {
  summary: SprintMetricsSummary;
  metrics: MetricsRow[];
}) {
  return (
    <>
      <h3 className="charts-subsection-title">Sprint KPIs</h3>
      <section className="charts-grid charts-grid-kpi">
        <CommitmentChart summary={summary} />
        <ScopeCreepChart summary={summary} />
        <BugRateChart summary={summary} />
        <WipStatusChart metrics={metrics} />
        <BlockedTopChart metrics={metrics} />
      </section>
    </>
  );
}
