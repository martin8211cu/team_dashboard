import type { MetricsRow, SprintMetricsSummary } from "@team-dashboard/shared";
import { AssigneeBarChart } from "./AssigneeBarChart";
import { KpiCharts } from "./KpiCharts";
import { LeadTimeTopChart } from "./LeadTimeTopChart";
import { StatusBarChart } from "./StatusBarChart";
import { TypeDoughnutChart } from "./TypeDoughnutChart";
import { VelocityBarChart } from "./VelocityBarChart";

export function SprintMetricsCharts({
  summary,
  metrics,
}: {
  summary: SprintMetricsSummary;
  metrics: MetricsRow[];
}) {
  return (
    <>
      <KpiCharts summary={summary} metrics={metrics} />
      <section className="charts-grid">
      <VelocityBarChart
        title="Velocity (SP)"
        helpId="velocitySp"
        labels={["Story Points"]}
        planned={[summary.totalStoryPoints]}
        done={[summary.velocityStoryPoints]}
      />
      <VelocityBarChart
        title="Velocity (tickets)"
        helpId="velocityTickets"
        labels={["Tickets"]}
        planned={[summary.total]}
        done={[summary.velocityTickets]}
      />
      <StatusBarChart summary={summary} />
      <LeadTimeTopChart summary={summary} />
      <TypeDoughnutChart summary={summary} />
      <AssigneeBarChart summary={summary} />
      </section>
    </>
  );
}
