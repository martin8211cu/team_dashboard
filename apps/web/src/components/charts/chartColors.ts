export const CHART_PALETTE = [
  "#1f4e79",
  "#2e75b6",
  "#70ad47",
  "#ffc000",
  "#ed7d31",
  "#c00000",
  "#7030a0",
  "#00b0f0",
  "#548235",
  "#a5a5a5",
];

const STATUS_COLORS: Record<string, string> = {
  "In Development": "#fce4cc",
  "Ready for Test": "#d9ead3",
  "Waiting Feedback": "#fce5cd",
  "Peer Review": "#ead1dc",
  "To Do": "#d9e2f3",
  "In Progress": "#fff2cc",
  Open: "#e2efda",
  POSTPONED: "#edede9",
  Closed: "#d9ead3",
  "SPECIFICATION IN PROGRESS": "#fff2cc",
  "Ready for Workshop": "#d9e2f3",
  "READY FOR ESTIMATION": "#fce5cd",
  Estimated: "#ead1dc",
  "Test In Progress": "#d9e2f3",
  Done: "#c6e0b4",
  Canceled: "#d6d6d6",
  "In Design And Specifications": "#e8dff5",
  "In Testing": "#cfe2f3",
  "ON HOLD": "#c4aedb",
  "On Hold": "#c4aedb",
};

function hashStatus(status: string): number {
  let hash = 0;
  for (let i = 0; i < status.length; i += 1) {
    hash = (hash + status.charCodeAt(i) * (i + 1)) % CHART_PALETTE.length;
  }
  return hash;
}

export function statusColor(status: string, index = 0): string {
  return STATUS_COLORS[status] ?? CHART_PALETTE[hashStatus(status) || index];
}

export function paletteColor(index: number): string {
  return CHART_PALETTE[index % CHART_PALETTE.length];
}

export function chartTextColor(): string {
  const dark = document.documentElement.dataset.theme === "dark";
  return dark ? "#e2e8f0" : "#334155";
}

export function chartGridColor(): string {
  const dark = document.documentElement.dataset.theme === "dark";
  return dark ? "rgba(226, 232, 240, 0.12)" : "rgba(15, 23, 42, 0.08)";
}
