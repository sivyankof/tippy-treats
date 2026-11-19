import { afterEach, describe, expect, it, vi } from 'vitest';

const played: unknown[][] = [];
vi.mock('../../fx-sound', () => ({ playFx: (...args: unknown[]) => played.push(args) }));

import { listenCueSounds, soundOfCue } from './cue-sounds';
import { effectCues } from './effect-cues';

afterEach(() => {
  played.length = 0;
  effectCues.listen(null);
});

describe('cue sounds', () => {
  it('maps every cue to its sound', () => {
    soundOfCue({ kind: 'cutStretch' });
    soundOfCue({ kind: 'cutStrandSnap' });
    soundOfCue({ kind: 'cutDrip' });
    soundOfCue({ kind: 'cutPanic' });
    soundOfCue({ kind: 'topperSquash', topper: 'lemon' });
    soundOfCue({ kind: 'topperSquash', topper: 'cream' });
    expect(played).toEqual([
      ['cutStretch'],
      ['cutStrandSnap'],
      ['cutDrip'],
      ['cutPanic'],
      ['topperSquash', 'lemon'],
      ['topperSquash', 'cream'],
    ]);
  });

  it('listens until it is stopped', () => {
    const stop = listenCueSounds();
    effectCues.emit({ kind: 'cutPanic' });
    expect(played).toEqual([['cutPanic']]);
    stop();
    effectCues.emit({ kind: 'cutPanic' });
    expect(played).toHaveLength(1);
  });
});
