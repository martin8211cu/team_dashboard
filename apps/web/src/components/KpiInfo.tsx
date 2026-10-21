import type { ReactNode } from "react";
import { useId } from "react";
import { HiInformationCircle } from "react-icons/hi2";
import { KPI_HELP, type KpiHelpId } from "../lib/kpiHelp";

type KpiInfoProps = {
  id: KpiHelpId;
  /** Accessible name for the info control (metric name). */
  metricLabel?: string;
  /** Extra context shown below the main description (e.g. breakdown numbers). */
  detail?: string;
};

export function KpiInfo({ id, metricLabel, detail }: KpiInfoProps) {
  const tooltipId = useId();
  const description = KPI_HELP[id];
  const ariaLabel = metricLabel ? `About ${metricLabel}` : "About this metric";

  return (
    <span className="kpi-info">
      <button type="button" className="kpi-info-trigger" aria-label={ariaLabel} aria-describedby={tooltipId}>
        <HiInformationCircle aria-hidden="true" />
      </button>
      <span role="tooltip" id={tooltipId} className="kpi-info-tooltip">
        {description}
        {detail ? <span className="kpi-info-detail">{detail}</span> : null}
      </span>
    </span>
  );
}

export function ChartPanelTitle({ title, helpId }: { title: string; helpId: KpiHelpId }) {
  return (
    <h3 className="chart-panel-title">
      <span className="chart-panel-title-text">{title}</span>
      <KpiInfo id={helpId} metricLabel={title} />
    </h3>
  );
}

export function KpiLabelWithInfo({
  children,
  helpId,
  detail,
}: {
  children: ReactNode;
  helpId: KpiHelpId;
  detail?: string;
}) {
  const label = typeof children === "string" ? children : undefined;
  return (
    <h2 className="kpi-label">
      <span className="kpi-label-text">{children}</span>
      <KpiInfo id={helpId} metricLabel={label} detail={detail} />
    </h2>
  );
}
