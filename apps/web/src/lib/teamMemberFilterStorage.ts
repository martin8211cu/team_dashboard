export const TEAM_MEMBER_FILTER_STORAGE_KEY = "team-dashboard-team-filter";

export type StoredTeamMemberFilter = {
  teamOnly: boolean;
  selectedMembers: string[] | null;
};

const DEFAULT_FILTER: StoredTeamMemberFilter = {
  teamOnly: true,
  selectedMembers: null,
};

export function getStoredTeamMemberFilter(): StoredTeamMemberFilter {
  try {
    const raw = localStorage.getItem(TEAM_MEMBER_FILTER_STORAGE_KEY);
    if (!raw) {
      return DEFAULT_FILTER;
    }

    const parsed = JSON.parse(raw) as Partial<StoredTeamMemberFilter>;
    return {
      teamOnly: typeof parsed.teamOnly === "boolean" ? parsed.teamOnly : DEFAULT_FILTER.teamOnly,
      selectedMembers: Array.isArray(parsed.selectedMembers)
        ? parsed.selectedMembers.filter((name): name is string => typeof name === "string")
        : null,
    };
  } catch {
    return DEFAULT_FILTER;
  }
}

export function storeTeamMemberFilter(state: StoredTeamMemberFilter): void {
  try {
    localStorage.setItem(TEAM_MEMBER_FILTER_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore quota or privacy mode errors.
  }
}
