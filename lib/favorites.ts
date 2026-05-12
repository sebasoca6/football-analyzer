import type { SavedMatch } from '@/types/football';

const KEY = 'fa_saved_matches';

export function getSavedMatches(): SavedMatch[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]');
  } catch {
    return [];
  }
}

export function saveMatch(m: SavedMatch): void {
  const existing = getSavedMatches().filter((s) => s.fixtureId !== m.fixtureId);
  localStorage.setItem(KEY, JSON.stringify([m, ...existing].slice(0, 20)));
}

export function removeSavedMatch(fixtureId: number): void {
  const updated = getSavedMatches().filter((s) => s.fixtureId !== fixtureId);
  localStorage.setItem(KEY, JSON.stringify(updated));
}

export function isMatchSaved(fixtureId: number): boolean {
  return getSavedMatches().some((s) => s.fixtureId === fixtureId);
}
