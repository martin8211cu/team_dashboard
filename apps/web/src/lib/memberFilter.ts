export function applyMemberFilter<T>(
  items: T[],
  teamOnly: boolean,
  memberNames: string[],
  filterByMembers: (items: T[], names: string[]) => T[],
): T[] {
  if (!teamOnly) {
    return items;
  }

  if (memberNames.length === 0) {
    return [];
  }

  return filterByMembers(items, memberNames);
}
