/** What a failure report carries besides the error itself (docs/09-services-analytics.md, section 7). */
export interface CrashContext {
  /** Key of the scene on screen; empty before the first scene starts. */
  scene: string;
  /** Version of the save format. */
  saveVersion: number;
  /** Where the report comes from: `error`, `rejection` or `effect:<name>`. */
  kind: string;
}

/** Failure reports of the game. The game decides what to report, the service only delivers it. */
export interface CrashService {
  /** Records a non-fatal error. Never throws, never rejects. */
  recordError(error: unknown, context: CrashContext): void;
  /** Debug builds only: ends the app at once, so the crash report of a real crash can be tested. */
  crash(): void;
}
