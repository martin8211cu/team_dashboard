export type TeamMember = {
  id: number;
  name: string;
  email: string | null;
  jiraAccountId: string | null;
  active: boolean;
  createdAt: string;
};

export type CreateTeamMemberInput = {
  name: string;
  email?: string | null;
};

export type UpdateTeamMemberInput = {
  name?: string;
  email?: string | null;
};

export type AssigneeIdentifier = {
  name: string;
  email?: string | null;
  jiraAccountId?: string | null;
};
