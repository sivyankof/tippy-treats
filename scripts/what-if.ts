import { DIFFICULTY } from '../src/data/balance';
import { CREATURES, type CreatureId } from '../src/data/creatures';
import { MASTERY } from '../src/data/mastery';

/**
 * What-if values for the balance analysis (`--set=...` of `sim:teams`, `sim:coins`, `sim:economy`).
 * The values are written over the data in memory before any run, so every script plays the real
 * sim with them; nothing is saved. Items are separated by `;`:
 *
 *   honey.4=44                 levelled ability value at a 1-based level (see `LEVELLED`)
 *   mastery.frosty.toleranceAdd=12
 *                              a number of `MASTERY` (data/mastery.ts)
 *   difficulty.ghostCloudSdMult=1.1
 *                              a bot-model number of `DIFFICULTY` (data/balance.ts)
 */

/** Creatures whose levelled value `--set=<id>.<level>=N` can replace, and the field that holds it. */
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

function setLevelled(id: string, level: string, value: number, item: string): void {
  const field = LEVELLED[id as keyof typeof LEVELLED];
  const ability = CREATURES[id as CreatureId]?.ability as unknown as Record<string, number[]>;
  const values = field ? ability[field] : undefined;
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
    else if (rest.length === 1) setLevelled(head, rest[0] ?? '', value, item);
    else throw new Error(`Invalid --set item: ${item}`);
  }
  return items;
}

/** The `--set=` argument of a script's arguments, `''` when absent. */
export const setArg = (args: readonly string[]): string =>
  args.find((a) => a.startsWith('--set='))?.slice('--set='.length) ?? '';
