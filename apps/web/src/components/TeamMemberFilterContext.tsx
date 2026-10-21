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
};

const TeamMemberFilterContext = createContext<TeamMemberFilterContextValue | null>(null);

export function useTeamMemberFilterContext(): TeamMemberFilterContextValue {
  const context = useContext(TeamMemberFilterContext);
  if (!context) {
    throw new Error("useTeamMemberFilterContext must be used within TeamMemberFilterProvider");
  }
  return context;
}

function TeamMemberFilterFloating() {
  const {
    teamOnly,
    setTeamOnly,
    activeMemberNames,
    selectedMembers,
    toggleMember,
    selectAllMembers,
    clearAllMembers,
    membersError,
  } = useTeamMemberFilterContext();

  const [open, setOpen] = useState(false);
  const [panelVisible, setPanelVisible] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const selectedCount = selectedMembers.length;
  const badge =
    teamOnly && activeMemberNames.length > 0
      ? selectedCount < activeMemberNames.length
        ? String(selectedCount)
        : "✓"
      : null;

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  useEffect(() => {
    if (!open) {
      setPanelVisible(false);
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      setPanelVisible(true);
      panelRef.current?.focus();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  const overlay =
    open &&
    createPortal(
      <>
        <button
          type="button"
          className={`member-filter-float-backdrop${panelVisible ? " is-visible" : ""}`}
          aria-label="Close team filter"
          onClick={() => setOpen(false)}
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
              onClick={() => setOpen(false)}
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

  return (
    <>
      {!open && (
        <div className={`member-filter-float-anchor${teamOnly ? " is-active" : ""}`}>
          <button
            type="button"
            className="member-filter-float-toggle"
            aria-expanded={open}
            aria-controls="team-member-filter-panel"
            aria-label="Open team filter"
            onClick={() => setOpen(true)}
          >
            <HiUsers aria-hidden="true" className="member-filter-float-toggle-icon" />
            {badge != null && <span className="member-filter-float-badge">{badge}</span>}
          </button>
        </div>
      )}
      {overlay}
    </>
  );
}

export function TeamMemberFilterProvider({ children }: { children: ReactNode }) {
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

  const value = useMemo(
    (): TeamMemberFilterContextValue => ({
      ...filterState,
      activeMemberNames,
      membersLoading: membersQuery.isLoading,
      membersError: (membersQuery.error as Error | null) ?? null,
    }),
    [activeMemberNames, filterState, membersQuery.error, membersQuery.isLoading],
  );

  return (
    <TeamMemberFilterContext.Provider value={value}>
      {children}
      <TeamMemberFilterFloating />
    </TeamMemberFilterContext.Provider>
  );
}
