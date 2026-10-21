import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { HiCheck } from "react-icons/hi2";
import {
  getStoredTeamMemberFilter,
  storeTeamMemberFilter,
} from "../lib/teamMemberFilterStorage";

function memberInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "?";
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

export function useTeamMemberFilter(activeMemberNames: string[]) {
  const [teamOnly, setTeamOnly] = useState(() => getStoredTeamMemberFilter().teamOnly);
  const [selectedMembers, setSelectedMembers] = useState<string[] | null>(
    () => getStoredTeamMemberFilter().selectedMembers,
  );

  const activeKey = useMemo(() => activeMemberNames.join("\0"), [activeMemberNames]);

  useEffect(() => {
    storeTeamMemberFilter({ teamOnly, selectedMembers });
  }, [teamOnly, selectedMembers]);

  useEffect(() => {
    setSelectedMembers((current) => {
      if (activeMemberNames.length === 0) {
        return [];
      }

      if (current == null) {
        return activeMemberNames;
      }

      const valid = current.filter((name) => activeMemberNames.includes(name));
      return valid.length > 0 ? valid : activeMemberNames;
    });
  }, [activeKey, activeMemberNames]);

  const effectiveSelectedMembers = selectedMembers ?? activeMemberNames;
  const filterMemberNames = teamOnly ? effectiveSelectedMembers : [];

  function handleTeamOnlyChange(checked: boolean) {
    setTeamOnly(checked);
    if (checked && (selectedMembers == null || selectedMembers.length === 0)) {
      setSelectedMembers(activeMemberNames);
    }
  }

  function toggleMember(name: string) {
    setSelectedMembers((current) => {
      const base = current ?? activeMemberNames;
      return base.includes(name) ? base.filter((member) => member !== name) : [...base, name];
    });
  }

  function selectAllMembers() {
    setSelectedMembers(activeMemberNames);
  }

  function clearAllMembers() {
    setSelectedMembers([]);
  }

  return {
    teamOnly,
    setTeamOnly: handleTeamOnlyChange,
    selectedMembers: effectiveSelectedMembers,
    toggleMember,
    selectAllMembers,
    clearAllMembers,
    filterMemberNames,
  };
}

type TeamMemberFilterPanelProps = {
  teamOnly: boolean;
  onTeamOnlyChange: (checked: boolean) => void;
  activeMemberNames: string[];
  selectedMembers: string[];
  onToggleMember: (name: string) => void;
  onSelectAllMembers: () => void;
  onClearAllMembers: () => void;
};

export function TeamMemberFilterPanel({
  teamOnly,
  onTeamOnlyChange,
  activeMemberNames,
  selectedMembers,
  onToggleMember,
  onSelectAllMembers,
  onClearAllMembers,
}: TeamMemberFilterPanelProps) {
  const allSelected =
    activeMemberNames.length > 0 && selectedMembers.length === activeMemberNames.length;
  const noneSelected = teamOnly && activeMemberNames.length > 0 && selectedMembers.length === 0;

  return (
    <section className={`member-filter-panel${teamOnly ? " is-active" : ""}`}>
      <div className="member-filter-header">
        <div className="member-filter-heading-text">
          <span className="member-filter-stats">
            {teamOnly
              ? `${selectedMembers.length} of ${activeMemberNames.length} active members`
              : "Not filtering by team"}
          </span>
        </div>

        <label className="member-filter-switch">
          <input
            type="checkbox"
            checked={teamOnly}
            onChange={(event) => onTeamOnlyChange(event.target.checked)}
          />
          <span className="member-filter-switch-track" aria-hidden="true">
            <span className="member-filter-switch-thumb" />
          </span>
          <span className="member-filter-switch-label">{teamOnly ? "Active" : "Inactive"}</span>
        </label>
      </div>

      {teamOnly && activeMemberNames.length > 0 && (
        <div className="member-filter-body">
          <div className="member-filter-toolbar">
            <span className="member-filter-count">
              {selectedMembers.length} selected
            </span>
            <div className="member-filter-actions">
              <button
                type="button"
                className="member-filter-action"
                onClick={onSelectAllMembers}
                disabled={allSelected}
              >
                All
              </button>
              <button
                type="button"
                className="member-filter-action"
                onClick={onClearAllMembers}
                disabled={noneSelected}
              >
                None
              </button>
            </div>
          </div>

          <div className="member-filter-grid" role="group" aria-label="Team members">
            {activeMemberNames.map((name) => {
              const selected = selectedMembers.includes(name);
              return (
                <button
                  key={name}
                  type="button"
                  className={`member-filter-item${selected ? " is-selected" : ""}`}
                  aria-pressed={selected}
                  onClick={() => onToggleMember(name)}
                >
                  <span className="member-filter-avatar">{memberInitials(name)}</span>
                  <span className="member-filter-name">{name}</span>
                  <span className="member-filter-check" aria-hidden="true">
                    {selected ? <HiCheck /> : null}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {teamOnly && activeMemberNames.length === 0 && (
        <p className="member-filter-alert alert">
          No active members configured. <Link to="/members">Add members</Link> or turn off
          the filter.
        </p>
      )}

      {noneSelected && (
        <p className="member-filter-alert alert">Select at least one member to filter.</p>
      )}
    </section>
  );
}
