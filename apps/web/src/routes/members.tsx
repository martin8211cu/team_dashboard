import { createFileRoute, useRouteContext } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { TeamMember } from "@team-dashboard/shared";
import { JiraUserSearch } from "../components/JiraUserSearch";
import {
  createMember,
  deactivateMember,
  deleteMember,
  fetchMembers,
  resolveMemberInJira,
  setMemberPassword,
  updateMember,
} from "../lib/api";

export const Route = createFileRoute("/members")({
  component: MembersPage,
});

function MemberRow({
  member,
  canManage,
  onDeactivate,
  onDelete,
  onReactivate,
  onResolve,
  isBusy,
}: {
  member: TeamMember;
  canManage: boolean;
  onDeactivate?: () => void;
  onDelete?: () => void;
  onReactivate?: () => void;
  onResolve?: () => void;
  isBusy: boolean;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(member.name);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passwordInfo, setPasswordInfo] = useState<string | null>(null);

  useEffect(() => {
    setName(member.name);
  }, [member.name, member.id]);

  const saveNameMutation = useMutation({
    mutationFn: () => updateMember(member.id, { name: name.trim() }),
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["members"] });
    },
    onError: (err: Error) => setError(err.message),
  });

  const passwordMutation = useMutation({
    mutationFn: () => setMemberPassword(member.id, password),
    onSuccess: () => {
      setError(null);
      setPasswordInfo("Password updated");
      setPassword("");
      setShowPassword(false);
    },
    onError: (err: Error) => {
      setPasswordInfo(null);
      setError(err.message);
    },
  });

  const nameDirty = name.trim() !== member.name;

  return (
    <li className="member-item">
      <div className="member-info">
        <div className="member-name-row">
          {canManage ? (
            <>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Name"
                disabled={isBusy || saveNameMutation.isPending}
              />
              {nameDirty && (
                <button
                  type="button"
                  onClick={() => saveNameMutation.mutate()}
                  disabled={!name.trim() || saveNameMutation.isPending}
                >
                  Save
                </button>
              )}
            </>
          ) : (
            <span className="member-name">{member.name}</span>
          )}
        </div>
        {member.email && <span className="member-email">{member.email}</span>}
        {member.jiraAccountId && (
          <span className="member-jira-id">Jira: {member.jiraAccountId.slice(0, 12)}…</span>
        )}
        {canManage && member.email && (
          <div className="member-password-row">
            {showPassword ? (
              <>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="New password"
                  disabled={isBusy || passwordMutation.isPending}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => passwordMutation.mutate()}
                  disabled={password.trim().length < 6 || passwordMutation.isPending}
                >
                  {passwordMutation.isPending ? "Saving…" : "Set password"}
                </button>
                <button
                  type="button"
                  className="btn-muted"
                  onClick={() => {
                    setShowPassword(false);
                    setPassword("");
                    setPasswordInfo(null);
                  }}
                  disabled={passwordMutation.isPending}
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                type="button"
                className="btn-muted"
                onClick={() => {
                  setShowPassword(true);
                  setPasswordInfo(null);
                }}
                disabled={isBusy}
              >
                Change password
              </button>
            )}
          </div>
        )}
        {passwordInfo && <span className="member-inline-ok">{passwordInfo}</span>}
        {error && <span className="member-inline-error">{error}</span>}
      </div>
      {canManage && (
        <div className="member-actions">
          {member.email && !member.jiraAccountId && onResolve && (
            <button type="button" onClick={onResolve} disabled={isBusy}>
              Link Jira
            </button>
          )}
          {onReactivate && (
            <button type="button" onClick={onReactivate} disabled={isBusy}>
              Reactivate
            </button>
          )}
          {onDeactivate && (
            <button type="button" className="btn-muted" onClick={onDeactivate} disabled={isBusy}>
              Deactivate
            </button>
          )}
          {onDelete && (
            <button type="button" className="btn-danger" onClick={onDelete} disabled={isBusy}>
              Delete
            </button>
          )}
        </div>
      )}
    </li>
  );
}

function MembersPage() {
  const queryClient = useQueryClient();
  const authUser = useRouteContext({ from: "__root__", select: (ctx) => ctx.authUser });
  const canManage = authUser?.role === "admin";
  const [error, setError] = useState<string | null>(null);

  const membersQuery = useQuery({
    queryKey: ["members"],
    queryFn: fetchMembers,
  });

  const deactivateMutation = useMutation({
    mutationFn: deactivateMember,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["members"] }),
    onError: (err: Error) => setError(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteMember,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["members"] }),
    onError: (err: Error) => setError(err.message),
  });

  const resolveMutation = useMutation({
    mutationFn: resolveMemberInJira,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["members"] }),
    onError: (err: Error) => setError(err.message),
  });

  const reactivateMutation = useMutation({
    mutationFn: (input: { name: string; email?: string | null }) => createMember(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["members"] }),
    onError: (err: Error) => setError(err.message),
  });

  const isBusy =
    deactivateMutation.isPending ||
    deleteMutation.isPending ||
    resolveMutation.isPending ||
    reactivateMutation.isPending;

  const activeMembers = membersQuery.data?.filter((m) => m.active) ?? [];
  const inactiveMembers = membersQuery.data?.filter((m) => !m.active) ?? [];

  return (
    <>
      <p className="meta-line meta-line-inline">
        {activeMembers.length} active
        {inactiveMembers.length > 0 ? ` · ${inactiveMembers.length} inactive` : ""}
        {!canManage ? " · view only" : ""}
      </p>

      {canManage && <JiraUserSearch existingMembers={membersQuery.data ?? []} />}

      {error && <p className="alert">{error}</p>}

      {membersQuery.isLoading && <p>Loading members...</p>}

      {membersQuery.isError && (
        <p className="alert">{(membersQuery.error as Error).message}</p>
      )}

      {activeMembers.length > 0 && (
        <ul className="member-list">
          {activeMembers.map((member) => (
            <MemberRow
              key={member.id}
              member={member}
              canManage={canManage}
              isBusy={isBusy}
              onResolve={() => resolveMutation.mutate(member.id)}
              onDeactivate={() => deactivateMutation.mutate(member.id)}
            />
          ))}
        </ul>
      )}

      {inactiveMembers.length > 0 && (
        <>
          <h3 className="subsection-title">Inactive</h3>
          <ul className="member-list member-list-inactive">
            {inactiveMembers.map((member) => (
              <MemberRow
                key={member.id}
                member={member}
                canManage={canManage}
                isBusy={isBusy}
                onResolve={() => resolveMutation.mutate(member.id)}
                onReactivate={() =>
                  reactivateMutation.mutate({ name: member.name, email: member.email })
                }
                onDelete={() => deleteMutation.mutate(member.id)}
              />
            ))}
          </ul>
        </>
      )}
    </>
  );
}
