import { t } from '../../../i18n';

const SECOND_MS = 1000;
const MINUTE_S = 60;
const HOUR_S = 3600;
const DAY_S = 86_400;

/**
 * Time left as short text: "2 d 5 h" from a day up, "3 h 05 min" from an hour up, "12 min 07 s" below it, "45 s" below
 * a minute. Rounds up to whole seconds, so a running timer never shows 0 before it is done.
 */
export function formatTimeLeft(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / SECOND_MS));
  const d = Math.floor(total / DAY_S);
  const h = Math.floor((total % DAY_S) / HOUR_S);
  const m = Math.floor((total % HOUR_S) / MINUTE_S);
  const s = total % MINUTE_S;
  if (d > 0) return t('time.dh', { d, h });
  if (h > 0) return t('time.hm', { h, m: String(m).padStart(2, '0') });
  if (m > 0) return t('time.ms', { m, s: String(s).padStart(2, '0') });
  return t('time.s', { s });
}
