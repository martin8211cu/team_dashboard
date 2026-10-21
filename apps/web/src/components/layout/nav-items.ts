export type NavItem = {
  to: string;
  label: string;
  description?: string;
  icon: "dashboard" | "members" | "sprints" | "metrics" | "retros";
  activePrefix?: string[];
};

export const navSections: { title: string; items: NavItem[] }[] = [
  {
    title: "General",
    items: [
      {
        to: "/",
        label: "Dashboard",
        description: "Team overview",
        icon: "dashboard",
      },
    ],
  },
  {
    title: "Jira",
    items: [
      {
        to: "/sprints",
        label: "Sprints",
        description: "Tasks and snapshots",
        icon: "sprints",
        activePrefix: ["/sprints", "/tasks"],
      },
      {
        to: "/metrics/evolution",
        label: "Evolution",
        description: "Trends across sprints",
        icon: "metrics",
        activePrefix: ["/metrics"],
      },
    ],
  },
  {
    title: "Team",
    items: [
      {
        to: "/members",
        label: "Members",
        description: "Team members",
        icon: "members",
      },
      {
        to: "/retros",
        label: "Retros",
        description: "Sprint retrospectives",
        icon: "retros",
        activePrefix: ["/retros"],
      },
    ],
  },
];

export const pageTitles: Record<string, string> = {
  "/": "Dashboard",
  "/login": "Sign in",
  "/members": "Members",
  "/sprints": "Sprints",
  "/sprint": "Sprint metrics",
  "/metrics/evolution": "Metrics evolution",
  "/tasks/compare": "Compare tasks",
  "/retros": "Retrospectives",
};

function parseSprintNumbersFromSearch(search: Record<string, unknown>): number[] {
  const raw = search.sprints;
  const values = Array.isArray(raw) ? raw : typeof raw === "string" ? raw.split(",") : [];
  return values
    .map((value) => Number.parseInt(String(value).trim(), 10))
    .filter((value) => !Number.isNaN(value) && value > 0);
}

export function resolvePageTitle(pathname: string, search: Record<string, unknown> = {}): string {
  if (pathname.startsWith("/tasks/compare")) {
    const sprintNumbers = parseSprintNumbersFromSearch(search);
    return sprintNumbers.length >= 2 ? "Compare sprints" : "Sprint tasks";
  }
  if (pathname.startsWith("/metrics/evolution")) {
    return pageTitles["/metrics/evolution"];
  }
  if (pathname.startsWith("/retros/")) {
    return "Retro board";
  }
  if (pathname === "/retros") {
    return pageTitles["/retros"];
  }
  return pageTitles[pathname] ?? "Team Dashboard";
}
