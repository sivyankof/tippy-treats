import { services } from '../../../../services';

/** The baker's journal was opened from the level plate of Home (not on the way back from its windows). */
export function logJournalOpen(): void {
  services.telemetry.logEvent('journal_open');
}
