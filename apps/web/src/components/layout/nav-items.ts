export type NavItem = {
  to: string;
  label: string;
  description?: string;
  icon: "dashboard" | "me" | "members" | "sprints" | "metrics" | "retros" | "followUp";
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
      {
        to: "/me",
        label: "My sprint",
        description: "Personal metrics and self-eval",
        icon: "me",
        activePrefix: ["/me"],
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
      {
        to: "/follow-up",
        label: "Follow Up",
        description: "Monthly 1:1 tracking",
        icon: "followUp",
        activePrefix: ["/follow-up"],
      },
    ],
  },
];

export const pageTitles: Record<string, string> = {
  "/": "Dashboard",
  "/login": "Sign in",
  "/me": "My sprint",
  "/members": "Members",
  "/sprints": "Sprints",
  "/sprint": "Sprint metrics",
  "/metrics/evolution": "Metrics evolution",
  "/tasks/compare": "Compare tasks",
  "/retros": "Retrospectives",
  "/follow-up": "Follow Up",
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
  if (pathname.startsWith("/follow-up/reports/")) {
    return "Follow Up report";
  }
  if (pathname.startsWith("/follow-up/")) {
    return "Follow Up session";
  }
  if (pathname === "/follow-up") {
    return pageTitles["/follow-up"];
  }
  if (pathname.startsWith("/me")) {
    return pageTitles["/me"];
  }
  return pageTitles[pathname] ?? "Team Dashboard";
}
