import { useQuery } from "@tanstack/react-query";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { HiUsers } from "react-icons/hi2";
import { fetchMembers } from "../lib/api";
import { TeamMemberFilterPanel, useTeamMemberFilter } from "./TeamMemberFilterBar";

type TeamMemberFilterContextValue = ReturnType<typeof useTeamMemberFilter> & {
  activeMemberNames: string[];
  membersLoading: boolean;
  membersError: Error | null;
  filterPanelOpen: boolean;
  openFilterPanel: () => void;
  closeFilterPanel: () => void;
  filterToggleBadge: string | null;
};

const TeamMemberFilterContext = createContext<TeamMemberFilterContextValue | null>(null);

export function useTeamMemberFilterContext(): TeamMemberFilterContextValue {
  const context = useContext(TeamMemberFilterContext);
  if (!context) {
    throw new Error("useTeamMemberFilterContext must be used within TeamMemberFilterProvider");
  }
  return context;
}

export function TeamMemberFilterToggle({ className }: { className?: string }) {
  const { filterPanelOpen, openFilterPanel, filterToggleBadge, teamOnly } =
    useTeamMemberFilterContext();

  return (
    <button
      type="button"
      className={`member-filter-topnav-toggle${teamOnly ? " is-active" : ""}${className ? ` ${className}` : ""}`}
      aria-expanded={filterPanelOpen}
      aria-controls="team-member-filter-panel"
      aria-label="Open team filter"
      onClick={openFilterPanel}
    >
      <HiUsers aria-hidden="true" className="member-filter-topnav-toggle-icon" />
      <span className="member-filter-topnav-toggle-label">Team</span>
      {filterToggleBadge != null && (
        <span className="member-filter-topnav-badge">{filterToggleBadge}</span>
      )}
    </button>
  );
}

function TeamMemberFilterPanelPortal() {
  const {
    teamOnly,
    setTeamOnly,
    activeMemberNames,
    selectedMembers,
    toggleMember,
    selectAllMembers,
    clearAllMembers,
    membersError,
    filterPanelOpen,
    closeFilterPanel,
  } = useTeamMemberFilterContext();

  const [panelVisible, setPanelVisible] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!filterPanelOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeFilterPanel();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closeFilterPanel, filterPanelOpen]);

  useEffect(() => {
    if (!filterPanelOpen) {
      setPanelVisible(false);
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      setPanelVisible(true);
      panelRef.current?.focus();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [filterPanelOpen]);

  useEffect(() => {
    if (!filterPanelOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [filterPanelOpen]);

  if (!filterPanelOpen) {
    return null;
  }

  return createPortal(
    <>
      <button
        type="button"
        className={`member-filter-float-backdrop${panelVisible ? " is-visible" : ""}`}
        aria-label="Close team filter"
        onClick={closeFilterPanel}
      />
      <div
        id="team-member-filter-panel"
        ref={panelRef}
        className={`member-filter-float-panel${panelVisible ? " is-visible" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="Team filter"
        tabIndex={-1}
      >
        <div className="member-filter-float-panel-header">
          <strong>Team filter</strong>
          <button
            type="button"
            className="member-filter-float-close"
            aria-label="Close"
            onClick={closeFilterPanel}
          >
            ×
          </button>
        </div>

        <div className="member-filter-float-panel-body">
          {membersError && (
            <p className="member-filter-alert alert">{membersError.message}</p>
          )}

          <TeamMemberFilterPanel
            teamOnly={teamOnly}
            onTeamOnlyChange={setTeamOnly}
            activeMemberNames={activeMemberNames}
            selectedMembers={selectedMembers}
            onToggleMember={toggleMember}
            onSelectAllMembers={selectAllMembers}
            onClearAllMembers={clearAllMembers}
          />
        </div>
      </div>
    </>,
    document.body,
  );
}

function computeFilterToggleBadge(
  teamOnly: boolean,
  activeMemberNames: string[],
  selectedCount: number,
): string | null {
  if (!teamOnly || activeMemberNames.length === 0) {
    return null;
  }
  if (selectedCount < activeMemberNames.length) {
    return String(selectedCount);
  }
  return "✓";
}

export function TeamMemberFilterProvider({ children }: { children: ReactNode }) {
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);

  const membersQuery = useQuery({
    queryKey: ["members"],
    queryFn: fetchMembers,
    retry: false,
  });

  const activeMemberNames = useMemo(
    () => (membersQuery.data ?? []).filter((member) => member.active).map((member) => member.name),
    [membersQuery.data],
  );

  const filterState = useTeamMemberFilter(activeMemberNames);

  const filterToggleBadge = useMemo(
    () =>
      computeFilterToggleBadge(
        filterState.teamOnly,
        activeMemberNames,
        filterState.selectedMembers.length,
      ),
    [activeMemberNames, filterState.selectedMembers.length, filterState.teamOnly],
  );

  const value = useMemo(
    (): TeamMemberFilterContextValue => ({
      ...filterState,
      activeMemberNames,
      membersLoading: membersQuery.isLoading,
      membersError: (membersQuery.error as Error | null) ?? null,
      filterPanelOpen,
      openFilterPanel: () => setFilterPanelOpen(true),
      closeFilterPanel: () => setFilterPanelOpen(false),
      filterToggleBadge,
    }),
    [
      activeMemberNames,
      filterPanelOpen,
      filterState,
      filterToggleBadge,
      membersQuery.error,
      membersQuery.isLoading,
    ],
  );

  return (
    <TeamMemberFilterContext.Provider value={value}>
      {children}
      <TeamMemberFilterPanelPortal />
    </TeamMemberFilterContext.Provider>
  );
}
