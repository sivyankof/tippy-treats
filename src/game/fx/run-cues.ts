import type { SimEvent, TowerState } from '../../core/tower-sim';
import { CREATURES } from '../../data/creatures';
import type { Rarity } from '../../data/rarity';
import type { HapticKind } from '../../services/haptics/types';
import { isBigBite } from '../../services/haptics/bite';
import type { Services } from '../../services';
import type { FlyingMemo } from './run-fx';

/** A sound of one sim step; `perfect` carries the step of the combo ladder, `ability` the rarity. */
export type SoundCue =
  | { kind: 'drop' | 'bite' | 'sneeze' | 'miss' | 'shieldPop' | 'coin' | 'berry' }
  | { kind: 'perfect'; step: number }
  | { kind: 'ability'; rarity: Rarity };

/** What the player should hear and feel after one sim step. */
export interface RunCues {
  sounds: SoundCue[];
  haptics: HapticKind[];
}

type LandEvent = Extract<SimEvent, { type: 'land' }>;

/**
 * Maps the events of one sim step to sounds and haptics. Presentation only: it decides
 * nothing about the run. `memo` is the flying layer before the step (its width is the
 * width before landing).
 */
export function cuesForEvents(
  events: readonly SimEvent[],
  state: Pick<TowerState, 'combo'>,
  memo: Pick<FlyingMemo, 'width'> | null,
): RunCues {
  const cues: RunCues = { sounds: [], haptics: [] };
  let errorFelt = false;
  for (const event of events) {
    switch (event.type) {
      case 'land':
        addLanding(cues, event, state.combo, memo);
        break;
      case 'wobble_sneeze':
        cues.sounds.push({ kind: 'sneeze' });
        cues.haptics.push('error');
        errorFelt = true;
        break;
      case 'miss':
        // The shield catches the miss: the run goes on, so it is a bubble pop, not the miss jingle.
        if (event.shielded) {
          cues.sounds.push({ kind: 'shieldPop' });
          cues.haptics.push('medium');
          break;
        }
        cues.sounds.push({ kind: 'miss' });
        if (!errorFelt) cues.haptics.push('error');
        break;
      case 'coin_collect':
        // Several payouts of one step ring once.
        if (!cues.sounds.some((s) => s.kind === 'coin')) cues.sounds.push({ kind: 'coin' });
        break;
      case 'golden':
        if (event.perfect) cues.sounds.push({ kind: 'berry' });
        break;
      case 'ability':
        cues.sounds.push({ kind: 'ability', rarity: CREATURES[event.creature].rarity });
        cues.haptics.push('success');
        break;
      default:
        break;
    }
  }
  return cues;
}

function addLanding(
  cues: RunCues,
  land: LandEvent,
  combo: number,
  memo: Pick<FlyingMemo, 'width'> | null,
): void {
  if (land.quality === 'perfect') {
    cues.sounds.push({ kind: 'perfect', step: combo });
    cues.haptics.push('medium');
    return;
  }
  cues.sounds.push({ kind: 'drop' });
  const bitten = land.cutWidth > 0;
  if (bitten) cues.sounds.push({ kind: 'bite' });
  const big = bitten && memo !== null && isBigBite(land.cutWidth, memo.width);
  cues.haptics.push(big ? 'heavy' : 'light');
}

/** Hands the cues to the services. */
export function playCues(cues: RunCues, services: Services): void {
  for (const sound of cues.sounds) {
    if (sound.kind === 'perfect') services.audio.perfect(sound.step);
    else if (sound.kind === 'ability') services.audio.ability(sound.rarity);
    else services.audio[sound.kind]();
  }
  for (const kind of cues.haptics) services.haptics.play(kind);
}
