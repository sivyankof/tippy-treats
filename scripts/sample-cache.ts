/**
 * The `--cache` file of `sim:economy`. Samples are only valid for the run count and the what-if
 * values they were played with, so the file keeps both next to the samples and a cache played
 * with other ones is refused instead of being read as if it fit.
 */
export interface SampleCache<T> {
  runs: number;
  /** The applied `--set` items, in order. */
  sets: string[];
  samples: Record<string, T>;
}

const sameSets = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((item, i) => item === b[i]);

function isSampleCache(value: unknown): value is SampleCache<unknown> {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Partial<SampleCache<unknown>>;
  return (
    typeof v.runs === 'number' &&
    Array.isArray(v.sets) &&
    v.sets.every((s) => typeof s === 'string') &&
    typeof v.samples === 'object' &&
    v.samples !== null
  );
}

/**
 * The samples of a cache file text (`null` = no file yet, an empty set). Throws when the file was
 * played with another run count or other what-if values, or has no such record (older format).
 */
export function readSampleCache<T>(
  text: string | null,
  runs: number,
  sets: readonly string[],
  path: string,
): Record<string, T> {
  if (text === null) return {};
  const parsed: unknown = JSON.parse(text);
  if (!isSampleCache(parsed)) {
    throw new Error(
      `Cache ${path} has no run count and what-if values: delete it or use another path`,
    );
  }
  if (parsed.runs !== runs || !sameSets(parsed.sets, sets)) {
    const was = `--runs=${parsed.runs} --set=${parsed.sets.join(';')}`;
    const now = `--runs=${runs} --set=${sets.join(';')}`;
    throw new Error(`Cache ${path} was played with ${was}, not ${now}: use another path`);
  }
  return parsed.samples as Record<string, T>;
}

/** The text of a cache file for these samples. */
export const sampleCacheText = <T>(
  runs: number,
  sets: readonly string[],
  samples: Record<string, T>,
): string => JSON.stringify({ runs, sets: [...sets], samples } satisfies SampleCache<T>);
