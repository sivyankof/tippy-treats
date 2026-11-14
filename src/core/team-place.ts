import { BALANCE } from '../data/balance';
import type { CreatureId } from '../data/creatures';
import { openSlots, type TeamIds } from './team';

/**
 * Puts `id` into the slot at `index` (a drop). A creature that already stands in another slot
 * moves; if the target is taken, the two swap, or the old occupant leaves when `id` was not in
 * the team. Unchanged (the same array) when the slot is locked or already holds `id`.
 */
export function placeInSlot(
  team: TeamIds,
  id: CreatureId,
  index: number,
  bakerLevel: number,
): TeamIds {
  if (index < 0 || index >= openSlots(bakerLevel) || team[index] === id) return team;
  const next: Array<CreatureId | null> = Array.from(
    { length: BALANCE.team.slots },
    (_, i) => team[i] ?? null,
  );
  const from = next.indexOf(id);
  const displaced = next[index] ?? null;
  next[index] = id;
  if (from >= 0) next[from] = displaced;
  return next;
}
