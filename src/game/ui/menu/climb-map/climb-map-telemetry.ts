import { services } from '../../../../services';

/** The climb map was opened from the record plate of Home. */
export function logMapOpen(): void {
  services.telemetry.logEvent('map_open');
}
