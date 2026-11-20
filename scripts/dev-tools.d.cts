export function parseArgs(
  argv: readonly string[],
  withValue: readonly string[],
): { options: Record<string, string | true>; positional: string[] };
export function freePort(): Promise<number>;
export function startVite(): Promise<{ url: string; stop: () => void }>;
export function findPlaywright(given?: string): string | null;
