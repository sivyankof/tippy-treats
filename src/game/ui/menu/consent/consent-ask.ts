import { gameState } from '../../../../state';
import { services } from '../../../../services';
import { consentDue, runConsentFlow } from '../../../economy/consent-flow';
import type { HomeAsk } from '../home/home-asks';

/**
 * The consent flow as a question of the Home entry: due after the first finished run, once per
 * launch (docs/09-services-analytics.md, section 4). The only window it can show is our tracking
 * explainer; the Google form and the system question are native.
 */
export const consentAsk: HomeAsk = {
  name: 'consent',
  due: () => consentDue(gameState.data.stats.runs),
  run(scene, done) {
    void runConsentFlow({
      consent: services.consent,
      ads: services.ads,
      attAsked: gameState.data.consent.attAsked,
      markAttAsked: () => gameState.noteAttAsked(),
      // A scene that is already gone cannot show the explainer: then the system question is not asked either.
      explain: () =>
        new Promise<boolean>((resolve) => {
          if (!scene.scene.isActive()) {
            resolve(false);
            return;
          }
          // Loaded on demand: the list of Home questions stays free of the window code (and of Phaser) in tests.
          void import('./consent-explainer').then(
            ({ openConsentExplainer }) => openConsentExplainer(scene, () => resolve(true)),
            () => resolve(false),
          );
        }),
    }).then(done);
  },
};
