import { CREATURE_IDS, type CreatureId } from './creatures';

/** Creature level used by `npm run sim` unless `--level=N` is given. */
export const SIM_TEAM_LEVEL = 3;

export interface SimTeamSet {
  /** Name printed in the tables and accepted by `--team=`. */
  name: string;
  /** Creatures in slot order; fewer than three means the other slots are empty. */
  creatures: readonly CreatureId[];
}

/** Every creature alone in slot 1, to see what each ability is worth by itself. */
const SOLO_TEAMS: SimTeamSet[] = CREATURE_IDS.map((id) => ({ name: id, creatures: [id] }));

/** The example teams of docs/03-creatures.md plus a few more full teams worth comparing. */
const FULL_TEAMS: SimTeamSet[] = [
  { name: 'reliable', creatures: ['honey', 'jelly', 'brownie'] },
  { name: 'greedy', creatures: ['caramel', 'crumb', 'lemon'] },
  { name: 'score', creatures: ['sprinkle', 'lemon', 'rainbow'] },
  { name: 'frosty-ghost-puff', creatures: ['frosty', 'ghost', 'puff'] },
  { name: 'honey-frosty-rainbow', creatures: ['honey', 'frosty', 'rainbow'] },
  { name: 'twins-puff-jelly', creatures: ['twins', 'puff', 'jelly'] },
];

/** The baseline: no creatures at all. */
export const NO_TEAM: SimTeamSet = { name: 'none', creatures: [] };

export const SIM_TEAMS: readonly SimTeamSet[] = [NO_TEAM, ...SOLO_TEAMS, ...FULL_TEAMS];

/** A set counts as a full team when all three slots are filled. */
export const isFullTeam = (set: SimTeamSet): boolean => set.creatures.length === 3;
