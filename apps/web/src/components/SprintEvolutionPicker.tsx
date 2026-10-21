import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { HiChevronDown, HiChevronUp, HiMagnifyingGlass } from "react-icons/hi2";
import type { SprintListItem } from "@team-dashboard/shared";

type SprintEvolutionPickerProps = {
  sprints: SprintListItem[];
  selected: number[];
  onChange: (sprintNumbers: number[]) => void;
};

export function SprintEvolutionPicker({
  sprints,
  selected,
  onChange,
}: SprintEvolutionPickerProps) {
  const [expanded, setExpanded] = useState(() => selected.length === 0);
  const [search, setSearch] = useState("");
  const [showUnavailable, setShowUnavailable] = useState(false);

  const sortedSprints = useMemo(
    () =>
      sprints
        .filter((sprint) => sprint.number != null)
        .sort((a, b) => (b.number ?? 0) - (a.number ?? 0)),
    [sprints],
  );

  const availableSprints = useMemo(
    () => sortedSprints.filter((sprint) => sprint.metricsSnapshot != null),
    [sortedSprints],
  );

  const filteredSprints = useMemo(() => {
    const query = search.trim().toLowerCase();

    return sortedSprints.filter((sprint) => {
      const hasMetrics = sprint.metricsSnapshot != null;
      if (!showUnavailable && !hasMetrics) {
        return false;
      }

      if (!query) {
        return true;
      }

      return (
        String(sprint.number ?? "").includes(query) ||
        sprint.name.toLowerCase().includes(query)
      );
    });
  }, [search, showUnavailable, sortedSprints]);

  const allAvailableSelected =
    availableSprints.length > 0 &&
    availableSprints.every((sprint) => selected.includes(sprint.number!));

  const selectedLabel =
    selected.length === 0
      ? "No sprint selected"
      : selected.length <= 8
        ? selected.map((value) => `#${value}`).join(", ")
        : `${selected.length} sprints (${selected.slice(0, 3).map((value) => `#${value}`).join(", ")}…)`;

  function toggleSprint(sprintNumber: number, enabled: boolean) {
    if (!enabled) {
      return;
    }

    onChange(
      selected.includes(sprintNumber)
        ? selected.filter((value) => value !== sprintNumber)
        : [...selected, sprintNumber].sort((a, b) => a - b),
    );
  }

  function selectAllAvailable() {
    onChange(availableSprints.map((sprint) => sprint.number!).sort((a, b) => a - b));
  }

  function selectLastAvailable(count: number) {
    onChange(
      availableSprints
        .slice(0, count)
        .map((sprint) => sprint.number!)
        .sort((a, b) => a - b),
    );
  }

  function clearSelection() {
    onChange([]);
  }

  return (
    <section className={`sprint-evolution-picker${expanded ? " is-expanded" : ""}`}>
      <div className="sprint-evolution-picker-bar">
        <div className="sprint-evolution-picker-summary">
          <strong>Sprints</strong>
          <span className="sprint-evolution-picker-summary-text">{selectedLabel}</span>
        </div>
        <button
          type="button"
          className="sprint-evolution-picker-toggle-btn"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
        >
          {expanded ? "Hide" : "Edit"}
          {expanded ? <HiChevronUp aria-hidden="true" /> : <HiChevronDown aria-hidden="true" />}
        </button>
      </div>

      {expanded && (
        <div className="sprint-evolution-picker-body">
          <div className="sprint-evolution-picker-controls">
            <label className="sprint-evolution-picker-search">
              <HiMagnifyingGlass aria-hidden="true" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search…"
                aria-label="Search sprint"
              />
            </label>

            <div className="sprint-evolution-picker-actions">
              <button
                type="button"
                className="sprint-evolution-picker-action"
                onClick={() => selectLastAvailable(6)}
                disabled={availableSprints.length === 0}
              >
                Last 6
              </button>
              <button
                type="button"
                className="sprint-evolution-picker-action"
                onClick={selectAllAvailable}
                disabled={allAvailableSelected || availableSprints.length === 0}
              >
                All
              </button>
              <button
                type="button"
                className="sprint-evolution-picker-action"
                onClick={clearSelection}
                disabled={selected.length === 0}
              >
                None
              </button>
            </div>

            <label className="sprint-evolution-picker-unavailable">
              <input
                type="checkbox"
                checked={showUnavailable}
                onChange={(event) => setShowUnavailable(event.target.checked)}
              />
              <span>No snapshot</span>
            </label>
          </div>

          {filteredSprints.length === 0 ? (
            <p className="sprint-evolution-picker-empty">
              {showUnavailable
                ? "No matches."
                : (
                    <>
                      No sprints with metrics. <Link to="/sprints">Load in Sprints</Link>
                    </>
                  )}
            </p>
          ) : (
            <div className="sprint-evolution-chip-list" role="group" aria-label="Available sprints">
              {filteredSprints.map((sprint) => {
                const sprintNumber = sprint.number!;
                const hasMetrics = sprint.metricsSnapshot != null;
                const isSelected = selected.includes(sprintNumber);

                return (
                  <button
                    key={sprint.id}
                    type="button"
                    className={`sprint-evolution-chip${isSelected ? " is-selected" : ""}${!hasMetrics ? " is-disabled" : ""} sprint-state-${sprint.state}`}
                    aria-pressed={isSelected}
                    disabled={!hasMetrics}
                    onClick={() => toggleSprint(sprintNumber, hasMetrics)}
                    title={
                      hasMetrics
                        ? `${sprint.name} · ${sprint.metricsSnapshot!.metricsCount} metrics`
                        : "No metrics snapshot"
                    }
                  >
                    {sprintNumber}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
