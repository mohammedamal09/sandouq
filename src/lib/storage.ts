import { createSeed } from "./seed";
import { applyCommand, type Command, type TreasuryState } from "./domain";

const KEY = "sandouq:local:v1";
export function loadLocal(): TreasuryState {
  try { const raw = localStorage.getItem(KEY); if (raw) return JSON.parse(raw) as TreasuryState; } catch { /* use seed */ }
  const seed = createSeed();
  localStorage.setItem(KEY, JSON.stringify(seed));
  return seed;
}
export function saveLocal(state: TreasuryState) { localStorage.setItem(KEY, JSON.stringify(state)); }
export function dispatchLocal(state: TreasuryState, command: Command) {
  const next = applyCommand(state, command);
  saveLocal(next);
  return next;
}
