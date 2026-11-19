import { describe, expect, it } from 'vitest';
import { EffectCues, type EffectCue } from './effect-cues';

describe('effect cues', () => {
  it('hands each moment to the listener, and nothing without one', () => {
    const cues = new EffectCues();
    cues.emit({ kind: 'cutPanic' });
    const heard: EffectCue[] = [];
    cues.listen((cue) => heard.push(cue));
    cues.emit({ kind: 'cutStrandSnap' });
    cues.emit({ kind: 'topperSquash', topper: 'lemon' });
    cues.listen(null);
    cues.emit({ kind: 'cutPanic' });
    expect(heard).toEqual([{ kind: 'cutStrandSnap' }, { kind: 'topperSquash', topper: 'lemon' }]);
  });
});
