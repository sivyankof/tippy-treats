import type { RunSummary } from '../state/game-state';
import type { RunRequest } from './run-request';
import { SCENES, type CreatureDetailData, type NewCreatureData, type SceneKey } from './scene-keys';
import { newCreaturesOf } from './ui/menu/results-text';

/** A screen to open, with its data. */
export interface ScreenTarget {
  key: SceneKey;
  data?: object;
}

/**
 * Where a run that is left without its results goes: the creature card after a demo; Home after
 * a normal run, through the new creature scene first when its level-ups handed creatures out
 * (they would never be shown otherwise). `summary` is the recorded run, or `null`.
 */
export function exitTarget(request: RunRequest, summary: RunSummary | null): ScreenTarget {
  if (request.kind === 'demo') {
    const data: CreatureDetailData = { id: request.creature, back: request.back };
    return { key: SCENES.creatureDetail, data };
  }
  const creatures = summary ? newCreaturesOf(summary.levelUps) : [];
  if (creatures.length === 0) return { key: SCENES.home };
  const data: NewCreatureData = { creatures, then: { kind: 'screen', key: SCENES.home } };
  return { key: SCENES.newCreature, data };
}
