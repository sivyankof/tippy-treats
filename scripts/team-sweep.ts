import { DIFFICULTY } from '../src/data/balance';
import { CREATURES, type CreatureId } from '../src/data/creatures';
import { allFullTeams, NO_TEAM, type SimTeamSet } from '../src/data/sim-teams';
import { intArg, nodeFs, scriptArgs } from './node-env';
import { ANALYSIS_MAX_HEIGHT, percentile, playRun, profileStreams, teamSlots } from './sim-runner';
import { applySets, setArg } from './what-if';

/**
 * Team sweep for the balance analysis (`npm run sim:teams`). Plays one profile with the chosen
 * teams at one creature level and prints one JSON line per team: median, spread and the share of
 * runs cut off at `ANALYSIS_MAX_HEIGHT`.
 *
 *   --profile=id         bot profile (default strong)
 *   --level=N            creature level (default 5)
 *   --runs=N             runs per team (default 200)
 *   --team=a+b+c;none    named teams (default: all 220 full teams)
 *   --part=i/n           only the teams with index % n == i, to split a sweep over processes
 *   --set=honey.4=44;puff.5=80;ghost.5=5;mastery.frosty.toleranceAdd=12
 *                        what-if values (scripts/what-if.ts): honey tolerance, puff widen, ghost
 *                        layers at a 1-based level, mastery numbers, bot-model assumptions
 *   --report=f1,f2       print the table of saved JSON lines (with the `none` line) instead of
 *                        playing: teams without the rainbow (the owner's height targets apply to
 *                        them) and teams with it, printed apart
 *   --top=N              rows of each table (default 5)
 */

interface Row {
  team: string;
  profile: string;
  level: number;
  runs: number;
  median: number;
  p25: number;
  p75: number;
  p99: number;
  cutPct: number;
}

const DEFAULT_RUNS = 200;
const DEFAULT_TOP = 5;
const PCT_DIGITS = 1;
/**
 * Owner's height targets of the mastery stage (docs/03-creatures.md, "РџСЂРѕРєР°С‡РєР°"): the best level-5
 * team without the rainbow lifts the median of the strong profile at most this much over no team,
 * with the 99th percentile of its heights at most `MAX_P99`. Rainbow teams are only reported.
 */
const MAX_RATIO = 2.2;
const MAX_P99 = 700;
const RAINBOW: CreatureId = 'rainbow';

const args = scriptArgs();
const textArg = (name: string): string | undefined =>
  args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);

function parseTeams(): SimTeamSet[] {
  const named = textArg('team');
  if (named === undefined) return allFullTeams();
  return named.split(';').map((name) => {
    if (name === 'none') return NO_TEAM;
    const creatures = name.split('+');
    const unknown = creatures.find((id) => !Object.hasOwn(CREATURES, id));
    if (unknown) throw new Error(`Unknown creature in --team: ${unknown}`);
    return { name, creatures: creatures as CreatureId[] };
  });
}

function sweep(): void {
  const profile = textArg('profile') ?? 'strong';
  const target = DIFFICULTY.targets.find((t) => t.id === profile);
  if (!target) throw new Error(`Unknown profile: ${profile}`);
  const level = intArg(args, 'level', 5);
  const runs = intArg(args, 'runs', DEFAULT_RUNS);
  const [partIndex = 0, partCount = 1] = (textArg('part') ?? '0/1').split('/').map(Number);
  if (
    !Number.isInteger(partIndex) ||
    !Number.isInteger(partCount) ||
    partCount < 1 ||
    partIndex < 0 ||
    partIndex >= partCount
  ) {
    throw new Error('Invalid --part, expected i/n with 0 <= i < n');
  }
  applySets(setArg(args));

  for (const [i, set] of parseTeams().entries()) {
    if (i % partCount !== partIndex) continue;
    const { seeds, noise } = profileStreams(target.id);
    const team = teamSlots(set, level);
    const heights: number[] = [];
    for (let r = 0; r < runs; r++) {
      const seed = seeds.int(0, 0xffffffff);
      const result = playRun(
        { seed, mode: 'classic', team, tutorial: false },
        target,
        noise,
        [],
        ANALYSIS_MAX_HEIGHT,
      );
      heights.push(result.height);
    }
    heights.sort((x, y) => x - y);
    const cut = heights.filter((h) => h >= ANALYSIS_MAX_HEIGHT).length;
    const row: Row = {
      team: set.name,
      profile,
      level,
      runs,
      median: percentile(heights, 0.5),
      p25: percentile(heights, 0.25),
      p75: percentile(heights, 0.75),
      p99: percentile(heights, 0.99),
      cutPct: Number(((100 * cut) / runs).toFixed(PCT_DIGITS)),
    };
    console.log(JSON.stringify(row));
  }
}

function report(files: string[]): void {
  const fs = nodeFs();
  const rows: Row[] = files
    .flatMap((file) => fs.readFileSync(file, 'utf8').split('\n'))
    .filter((line) => line.startsWith('{'))
    .map((line) => JSON.parse(line) as Row);
  const base = rows.find((row) => row.team === 'none');
  const teams = rows.filter((row) => row.team !== 'none').sort((a, b) => b.median - a.median);
  const top = intArg(args, 'top', DEFAULT_TOP);
  const ratioOf = (row: Row): number | null => (base ? row.median / base.median : null);
  console.log(`teams ${teams.length}, none median ${base?.median ?? 'n/a'}`);
  const withRainbow = (row: Row): boolean => row.team.split('+').includes(RAINBOW);
  for (const [title, list] of [
    ['without rainbow', teams.filter((row) => !withRainbow(row))],
    ['with rainbow', teams.filter(withRainbow)],
  ] as const) {
    console.log(`-- ${title}: ${list.length}`);
    for (const row of list.slice(0, top)) {
      const ratio = ratioOf(row)?.toFixed(2) ?? 'n/a';
      console.log(
        `${row.team.padEnd(26)} median ${row.median} x${ratio} p75 ${row.p75} p99 ${row.p99} cut ${row.cutPct}%`,
      );
    }
  }
  const reaching = teams.filter((row) => row.cutPct > 0).length;
  console.log(`teams with cut runs: ${reaching}`);
  const best = teams.find((row) => !withRainbow(row));
  const bestRatio = best ? ratioOf(best) : null;
  if (best && bestRatio !== null) {
    const ok = bestRatio <= MAX_RATIO && best.p99 <= MAX_P99 && reaching === 0;
    console.log(
      `target (no rainbow: ratio <= ${MAX_RATIO}, p99 <= ${MAX_P99}, no cut runs): ${ok ? 'ok' : 'MISSED'} ` +
        `(${best.team} x${bestRatio.toFixed(2)}, p99 ${best.p99})`,
    );
  }
  const overRainbow = teams.filter((row) => withRainbow(row) && (ratioOf(row) ?? 0) > MAX_RATIO);
  if (overRainbow.length > 0) {
    console.log(
      `rainbow teams over x${MAX_RATIO} (for the owner): ${overRainbow.map((row) => row.team).join(', ')}`,
    );
  }
}

const reportFiles = textArg('report');
if (reportFiles) report(reportFiles.split(','));
else sweep();
