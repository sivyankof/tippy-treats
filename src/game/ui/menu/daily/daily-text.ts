// Texts of the daily tower shared by its screen, its explainer and the results of a daily run.
import { dailyProgress, tierReached } from '../../../../core/progression/daily';
import { DAILY } from '../../../../data/progression/daily';
import { formatNumber, t, tn } from '../../../../i18n';

/** "One tower for all players. 3 attempts." and, on the second line, "The higher, the more rewards." */
export function dailyExplainText(): string {
  return tn('daily.explain', DAILY.attempts);
}

/** The four lines of the explainer window. */
export function dailyIntroText(): string {
  return [
    t('daily.intro.same'),
    t('daily.intro.team'),
    tn('daily.intro.attempts', DAILY.attempts),
    t('daily.intro.best'),
  ].join('\n');
}

/** The progress line under the tiers: the first tier, the layers to the next one, or all done. */
export function dailyProgressText(best: number, played: boolean): string {
  const progress = dailyProgress(best, played);
  switch (progress.kind) {
    case 'start':
      return tn('daily.progress.start', progress.first);
    case 'next':
      return tn('daily.progress.next', progress.left, { best: formatNumber(progress.best) });
    case 'done':
      return t('daily.progress.done');
  }
}

/** The tier one attempt of `height` layers reached, or how far the first tier was. */
export function dailyAttemptText(height: number): string {
  const tier = tierReached(height);
  if (tier !== null) return t('resultsDaily.attempt', { n: formatNumber(tier) });
  return tn('resultsDaily.attemptNone', DAILY.tiers[0]?.height ?? 0);
}
