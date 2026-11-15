/**
 * The few Node built-ins the analysis scripts use. The project does not pull in the Node type
 * definitions, so they are typed here once.
 */
interface NodeFs {
  writeFileSync(path: string, data: string): void;
  readFileSync(path: string, encoding: 'utf8'): string;
  existsSync(path: string): boolean;
}

declare const process: {
  argv: string[];
  getBuiltinModule(id: 'node:fs'): NodeFs;
};

/** Command line arguments after the script path. */
export const scriptArgs = (): string[] => process.argv.slice(2);

export const nodeFs = (): NodeFs => process.getBuiltinModule('node:fs');

/** The value of a `--name=N` argument as a positive integer, `fallback` when it is absent; throws on anything else. */
export function intArg(args: readonly string[], name: string, fallback: number): number {
  const prefix = `--${name}=`;
  const arg = args.find((a) => a.startsWith(prefix));
  if (arg === undefined) return fallback;
  const value = Number(arg.slice(prefix.length));
  if (!Number.isInteger(value) || value <= 0) throw new Error(`Invalid argument: ${arg}`);
  return value;
}
