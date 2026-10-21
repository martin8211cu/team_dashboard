import { statusColor } from "./charts/chartColors";

export function StatusPill({ status }: { status: string }) {
  const background = statusColor(status);

  return (
    <span
      className="status-pill status-pill-colored"
      style={{ backgroundColor: background, background: background }}
    >
      {status}
    </span>
  );
}
