import type { MetricsRow } from "@team-dashboard/shared";
import { StatusPill } from "./StatusPill";

export function MetricsTable({ rows }: { rows: MetricsRow[] }) {
  if (rows.length === 0) {
    return <p>No tickets in this sprint.</p>;
  }

  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>Key</th>
            <th>Summary</th>
            <th>Assignee</th>
            <th>Status</th>
            <th>SP</th>
            <th>Cycle (d)</th>
            <th>Blocked (d)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <td>
                <a href={row.url} target="_blank" rel="noreferrer">
                  {row.key}
                </a>
              </td>
              <td className="summary-cell">{row.summary}</td>
              <td>{row.assignee}</td>
              <td>
                <StatusPill status={row.status} />
              </td>
              <td>{row.storyPoints ?? "—"}</td>
              <td>{row.cycleTimeDays ?? "—"}</td>
              <td>{row.blockedTimeDays}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
