import { DIFFICULTY } from '../src/data/balance';
import { CREATURES, type CreatureId } from '../src/data/creatures';
import { MASTERY } from '../src/data/mastery';
import { ZONE_RULES } from '../src/data/zones';

/**
 * What-if values for the balance analysis (`--set=...` of `sim:teams`, `sim:coins`, `sim:economy`).
 * The values are written over the data in memory before any run, so every script plays the real
 * sim with them; nothing is saved. Items are separated by `;`:
 *
 *   frosty.slowPercent.5=33    any levelled ability value: <creature>.<field>.<1-based level>
 *   honey.4=44                 short form for the main levelled value (see `LEVELLED`)
 *   mastery.frosty.toleranceAdd=12
 *                              a number of `MASTERY` (data/mastery.ts)
 *   difficulty.ghostCloudSdMult=1.1
 *                              a bot-model number of `DIFFICULTY` (data/balance.ts)
 *   zones.spaceLaps.step=0.08  a number of `ZONE_RULES` (data/zones.ts)
 */

/** Creatures whose main levelled value the short `--set=<id>.<level>=N` replaces, and its field. */
const LEVELLED = { honey: 'tolerance', puff: 'widen', ghost: 'layers' } as const;

/** Writable view of a nested data object for the what-if values. */
type Tree = { [key: string]: Tree | number | readonly number[] | unknown };

function setNumber(root: Tree, path: string[], value: number, item: string): void {
  const leaf = path.at(-1);
  let node: Tree | undefined = root;
  for (const part of path.slice(0, -1)) {
    const next: unknown = node?.[part];
    node = typeof next === 'object' && next !== null ? (next as Tree) : undefined;
  }
  if (!node || leaf === undefined || typeof node[leaf] !== 'number') {
    throw new Error(`Invalid --set item: ${item}`);
  }
  node[leaf] = value;
}

/** Writes a levelled ability value (a `LevelValues` field of the creature's ability). */
function setLevelled(
  id: string,
  field: string | undefined,
  level: string,
  value: number,
  item: string,
): void {
  const ability = CREATURES[id as CreatureId]?.ability as Record<string, unknown> | undefined;
  const found = field === undefined ? undefined : ability?.[field];
  const values = Array.isArray(found) ? (found as number[]) : undefined;
  const index = Number(level) - 1;
  if (!values || !Number.isInteger(index) || index < 0 || index >= values.length) {
    throw new Error(`Invalid --set item: ${item}`);
  }
  values[index] = value;
}

/** Applies a `--set` spec; throws on anything it cannot place. Returns the applied items. */
export function applySets(spec: string): string[] {
  const items = spec.split(';').filter(Boolean);
  for (const item of items) {
    const [target = '', raw = ''] = item.split('=');
    const value = Number(raw);
    if (raw === '' || !Number.isFinite(value)) throw new Error(`Invalid --set item: ${item}`);
    const [head = '', ...rest] = target.split('.');
    if (head === 'mastery') setNumber(MASTERY as unknown as Tree, rest, value, item);
    else if (head === 'difficulty') setNumber(DIFFICULTY as unknown as Tree, rest, value, item);
    else if (head === 'zones') setNumber(ZONE_RULES as unknown as Tree, rest, value, item);
    else if (rest.length === 1) {
      setLevelled(head, LEVELLED[head as keyof typeof LEVELLED], rest[0] ?? '', value, item);
    } else if (rest.length === 2) setLevelled(head, rest[0], rest[1] ?? '', value, item);
    else throw new Error(`Invalid --set item: ${item}`);
  }
  return items;
}

/** The `--set=` argument of a script's arguments, `''` when absent. */
export const setArg = (args: readonly string[]): string =>
  args.find((a) => a.startsWith('--set='))?.slice('--set='.length) ?? '';
