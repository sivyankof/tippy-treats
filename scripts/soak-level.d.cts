export function pickSoakLevel(files: readonly string[]): {
  level: 'none' | 'smoke' | 'smoke+5min';
  triggers: string[];
};
