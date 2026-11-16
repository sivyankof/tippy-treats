/**
 * A decoration that failed and was skipped (the run goes on): a console warning in the dev build,
 * nothing in production.
 */
export function devWarn(message: string, error?: unknown): void {
  if (!import.meta.env.DEV) return;
  if (error === undefined) console.warn(message);
  else console.warn(message, error);
}
