import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { JiraUser, TeamMember } from "@team-dashboard/shared";
import { addMemberFromJira, searchJiraUsers } from "../lib/api";

type JiraUserSearchProps = {
  existingMembers: TeamMember[];
  onAdded?: () => void;
};

export function JiraUserSearch({ existingMembers, onAdded }: JiraUserSearchProps) {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<JiraUser[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);

  const searchMutation = useMutation({
    mutationFn: searchJiraUsers,
    onSuccess: (users) => {
      setResults(users);
      setSearchError(null);
    },
    onError: (err: Error) => {
      setResults([]);
      setSearchError(err.message);
    },
  });

  const addMutation = useMutation({
    mutationFn: addMemberFromJira,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["members"] });
      onAdded?.();
    },
    onError: (err: Error) => setSearchError(err.message),
  });

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setSearchError("Enter at least 2 characters");
      return;
    }
    searchMutation.mutate(trimmed);
  }

  function isAlreadyMember(user: JiraUser): boolean {
    return existingMembers.some(
      (m) =>
        m.active &&
        (m.jiraAccountId === user.accountId ||
          (user.emailAddress && m.email === user.emailAddress.toLowerCase()) ||
          m.name.toLowerCase() === user.displayName.toLowerCase()),
    );
  }

  return (
    <section className="jira-search">
      <h3>Search in Jira</h3>
      <p className="meta-line">By email or partial name (min. 2 characters)</p>

      <form className="jira-search-form" onSubmit={handleSearch}>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. m.estevez or Martin"
          disabled={searchMutation.isPending}
        />
        <button type="submit" disabled={query.trim().length < 2 || searchMutation.isPending}>
          {searchMutation.isPending ? "Searching…" : "Search"}
        </button>
      </form>

      {searchError && <p className="alert">{searchError}</p>}

      {results.length > 0 && (
        <ul className="jira-search-results">
          {results.map((user) => {
            const already = isAlreadyMember(user);
            return (
              <li key={user.accountId} className="jira-search-item">
                <div className="jira-search-user">
                  <strong>{user.displayName}</strong>
                  <span>{user.emailAddress ?? "no visible email"}</span>
                  {!user.active && <span className="jira-inactive">inactive in Jira</span>}
                </div>
                <div className="member-actions">
                  <button
                    type="button"
                    onClick={() => addMutation.mutate(user)}
                    disabled={already || addMutation.isPending}
                  >
                    {already ? "On the team" : "Add"}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {searchMutation.isSuccess && results.length === 0 && !searchError && (
        <p className="meta-line">No results for &quot;{query.trim()}&quot;</p>
      )}
    </section>
  );
}
