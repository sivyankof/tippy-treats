import { AUDIO_LOG } from '../../data/audio/audio-log';
import { MS_PER_SECOND } from '../../util/math';

/** Time source of the log: milliseconds since some fixed point (injected in tests). */
export type LogClock = () => number;

const defaultClock: LogClock = () =>
  typeof performance !== 'undefined' ? performance.now() : Date.now();

/**
 * The sound's own journal (docs/08-architecture.md, section 9, "Журнал звука"): the last
 * `AUDIO_LOG.lines` events of the audio context, the music player, its media elements and the app
 * shell, each with the seconds since the page started. The debug menu shows and copies it; in the
 * dev server and the internal build each line also goes to the console (the iOS simulator log).
 */
export class AudioLog {
  private readonly lines: string[] = [];
  private readonly start: number;

  constructor(
    private readonly clock: LogClock = defaultClock,
    private readonly mirror: ((line: string) => void) | null = null,
    private readonly size: number = AUDIO_LOG.lines,
  ) {
    this.start = clock();
  }

  /** Seconds since the log was made (the page start). */
  uptimeSec(): number {
    return (this.clock() - this.start) / MS_PER_SECOND;
  }

  add(message: string): void {
    const line = `${this.uptimeSec().toFixed(2)} ${message}`;
    this.lines.push(line);
    if (this.lines.length > this.size) this.lines.splice(0, this.lines.length - this.size);
    try {
      this.mirror?.(line);
    } catch {
      // The console is a convenience.
    }
  }

  /** The last `count` lines, oldest first. */
  last(count: number): string[] {
    return this.lines.slice(Math.max(0, this.lines.length - count));
  }
}

/** A short text of an error or a rejection reason (its name and message). */
export function errorText(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return String(error);
}

const mirrorToConsole =
  import.meta.env.DEV || import.meta.env.VITE_INTERNAL_BUILD === '1'
    ? (line: string): void => console.info(`[audio] ${line}`)
    : null;

/** The log of the game's sound. */
export const audioLog = new AudioLog(
  defaultClock,
  import.meta.env.MODE === 'test' ? null : mirrorToConsole,
);
