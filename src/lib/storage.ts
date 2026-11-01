import { createEmptyState } from "./seed";
import { applyCommand, type Command, type TreasuryState } from "./domain";

const KEY = "sandouq:local:v1";

const LEGACY_DEMO_MEMBER_IDS = ["m1", "m2", "m3", "m4", "m5", "m6", "m7", "m8"];

function isBundledDemo(state: TreasuryState) {
  return (
    state.group?.id === "demo-group" &&
    LEGACY_DEMO_MEMBER_IDS.every((id) =>
      state.members.some((member) => member.id === id),
    )
  );
}

export function createCleanLocalState(previous?: TreasuryState): TreasuryState {
  const currentAdmin =
    previous?.admins.find((admin) => admin.active && !admin.archivedAt) ??
    previous?.admins[0];
  return createEmptyState(
    previous?.group.id === "demo-group"
      ? "local-group"
      : (previous?.group.id ?? "local-group"),
    previous?.group.name ?? "صندوق المجموعة",
    currentAdmin?.id ?? "shared-admin",
    currentAdmin?.name ?? "المشرف",
  );
}

export function loadLocal(): TreasuryState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const stored = JSON.parse(raw) as TreasuryState;
      if (!isBundledDemo(stored)) return stored;
      const clean = createCleanLocalState(stored);
      saveLocal(clean);
      return clean;
    }
  } catch {
    /* create a clean local workspace */
  }
  const empty = createCleanLocalState();
  localStorage.setItem(KEY, JSON.stringify(empty));
  return empty;
}
export function saveLocal(state: TreasuryState) {
  localStorage.setItem(KEY, JSON.stringify(state));
}
export function dispatchLocal(state: TreasuryState, command: Command) {
  const next = applyCommand(state, command);
  saveLocal(next);
  return next;
}
