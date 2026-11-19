import { playFx } from '../../fx-sound';
import { effectCues, type EffectCue } from './effect-cues';

/** The sound of one effect cue (the strands, the panic, the squashed toppers). */
export function soundOfCue(cue: Readonly<EffectCue>): void {
  switch (cue.kind) {
    case 'cutStretch':
      playFx('cutStretch');
      break;
    case 'cutStrandSnap':
      playFx('cutStrandSnap');
      break;
    case 'cutDrip':
      playFx('cutDrip');
      break;
    case 'cutPanic':
      playFx('cutPanic');
      break;
    case 'topperSquash':
      playFx('topperSquash', cue.topper);
      break;
  }
}

/** Makes the effect cues audible; call once when a run starts. Returns the function that stops it. */
export function listenCueSounds(): () => void {
  effectCues.listen(soundOfCue);
  return () => effectCues.listen(null);
}
