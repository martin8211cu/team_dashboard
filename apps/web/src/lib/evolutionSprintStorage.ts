export const EVOLUTION_SPRINTS_STORAGE_KEY = "team-dashboard-evolution-sprints";

export function getStoredEvolutionSprints(): number[] | null {
  try {
    const raw = localStorage.getItem(EVOLUTION_SPRINTS_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return null;
    }

    return parsed
      .map((value) => Number.parseInt(String(value), 10))
      .filter((value) => !Number.isNaN(value) && value > 0);
  } catch {
    return null;
  }
}

export function storeEvolutionSprints(sprints: number[]): void {
  try {
    localStorage.setItem(EVOLUTION_SPRINTS_STORAGE_KEY, JSON.stringify(sprints));
  } catch {
    // Ignore quota or privacy mode errors.
  }
}
