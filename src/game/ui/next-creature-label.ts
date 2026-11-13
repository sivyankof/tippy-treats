import type { NextCreature } from '../../core/team-queue';
import { t, tn } from '../../i18n';

/** The words of the indicator: "now" on the creature layer, "in N layers" before it. */
export function nextCreatureLabel(next: Pick<NextCreature, 'inLayers'>): string {
  return next.inLayers === 0 ? t('run.nextCreatureNow') : tn('run.nextCreatureIn', next.inLayers);
}
