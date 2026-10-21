import type { SprintMetricsSummary } from "@team-dashboard/shared";
import { KpiLabelWithInfo } from "./KpiInfo";
import { KpiIcon, type KpiIconName } from "./KpiIcon";

function fmt(value: number | null, digits = 1): string {
  if (value == null || Number.isNaN(value)) {
    return "—";
  }
  return value.toFixed(digits);
}

function pct(part: number, total: number): number {
  if (total === 0) {
    return 0;
  }
  return Math.round((part / total) * 100);
}

function fmtPct(value: number | null): string {
  if (value == null || Number.isNaN(value)) {
    return "—";
  }
  return `${value.toFixed(1)}%`;
}

function commitmentTone(value: number | null): "green" | "amber" | "red" | undefined {
  if (value == null) {
    return undefined;
  }
  if (value >= 85) {
    return "green";
  }
  if (value >= 65) {
    return "amber";
  }
  return "red";
}

export function SummaryCards({ summary }: { summary: SprintMetricsSummary }) {
  const cards: Array<{
    title: string;
    value: string;
    meta: string;
    icon: KpiIconName;
    tone?: "green" | "amber" | "red";
  }> = [
    {
      title: "Total tickets",
      value: String(summary.total),
      meta: `${summary.closed} closed · ${summary.open} open`,
      icon: "total",
    },
    {
      title: "Closed",
      value: String(summary.closed),
      meta: `${pct(summary.closed, summary.total)}% of total`,
      icon: "closed",
      tone: summary.closed > 0 ? "green" : undefined,
    },
    {
      title: "Open",
      value: String(summary.open),
      meta: `${pct(summary.open, summary.total)}% of total`,
      icon: "open",
      tone: summary.open > 0 ? "amber" : "green",
    },
    {
      title: "Commitment",
      value: fmtPct(summary.commitmentStoryPointsPct),
      meta: `${fmtPct(summary.commitmentTicketsPct)} tickets · planned vs done`,
      icon: "commitment",
      tone: commitmentTone(summary.commitmentStoryPointsPct),
    },
    {
      title: "WIP",
      value: String(summary.wipCount),
      meta: "in progress, test, or blocked",
      icon: "wip",
      tone: summary.wipCount > 0 ? "amber" : "green",
    },
    {
      title: "Scope creep",
      value: String(summary.scopeCreepCount),
      meta: `${fmtPct(summary.scopeCreepPct)} added to sprint`,
      icon: "scopeCreep",
      tone: summary.scopeCreepCount > 0 ? "amber" : "green",
    },
    {
      title: "Bug rate",
      value: fmtPct(summary.bugRatePct),
      meta: `${summary.bugsCreated} bugs / ${summary.velocityTickets} delivered`,
      icon: "bugRate",
      tone:
        summary.bugRatePct == null
          ? undefined
          : summary.bugRatePct > 15
            ? "red"
            : summary.bugRatePct > 5
              ? "amber"
              : "green",
    },
    {
      title: "Blocked total",
      value: `${fmt(summary.totalBlockedDays)} d`,
      meta: "days accumulated in Waiting Feedback",
      icon: "blockedTotal",
      tone: summary.totalBlockedDays > 0 ? "amber" : "green",
    },
    {
      title: "Avg lead time",
      value: `${fmt(summary.avgLeadTime)} d`,
      meta: "creation → resolution",
      icon: "leadTime",
    },
    {
      title: "Avg cycle time",
      value: `${fmt(summary.avgCycleTime)} d`,
      meta: "first time in To Do",
      icon: "cycleTime",
    },
    {
      title: "Avg blocked",
      value: `${fmt(summary.avgBlockedDays)} d`,
      meta: "Waiting Feedback",
      icon: "blocked",
    },
    {
      title: "Avg refinement",
      value: `${fmt(summary.avgRefinementDays)} d`,
      meta: "In Design & Specs",
      icon: "refinement",
    },
    {
      title: "New bugs",
      value: String(summary.bugsCreated),
      meta: "created in the sprint",
      icon: "bugNew",
      tone: summary.bugsCreated > 0 ? "red" : "green",
    },
    {
      title: "Carried bugs",
      value: String(summary.bugsCarried),
      meta: "in sprint, created earlier",
      icon: "bugCarried",
      tone: "amber",
    },
  ];

  return (
    <section className="kpi-grid">
      {cards.map((card) => (
        <article key={card.title} className={`kpi-card${card.tone ? ` kpi-card-${card.tone}` : ""}`}>
          <div className="kpi-card-header">
            <span className="kpi-icon" aria-hidden="true">
              <KpiIcon name={card.icon} />
            </span>
            <KpiLabelWithInfo helpId={card.icon}>{card.title}</KpiLabelWithInfo>
          </div>
          <p className="kpi-value">{card.value}</p>
          <p className="kpi-meta">{card.meta}</p>
        </article>
      ))}
    </section>
  );
}
