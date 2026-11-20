export interface PickedId {
  id: string;
  source: 'google sample' | '.env';
}

export function parseEnv(text: string): Record<string, string>;
export function pickAppIds(
  env: Record<string, string | undefined>,
  internal: boolean,
): { ios: PickedId; android: PickedId };
export const SAMPLE_APP_IDS: { ios: string; android: string };
