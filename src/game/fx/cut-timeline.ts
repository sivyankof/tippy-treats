import { CUT_LOOK, CUT_PICTURE } from '../../data/cut-look';
import { backOut, clamp01, lerp, smoothstep } from '../../util/math';

/** Spin of a piece in degrees per second: fast when narrow, slow when big. */
export function cutSpinDegPerSec(width: number): number {
  const { narrowPx, widePx, narrowDegPerSec, wideDegPerSec } = CUT_LOOK.spin;
  return lerp(narrowDegPerSec, wideDegPerSec, clamp01((width - narrowPx) / (widePx - narrowPx)));
}

/** Opacity of a piece at `progress` of its life: solid, then fading out smoothly in the last part only. */
export function cutPieceAlpha(progress: number, fadeFrom: number): number {
  return 1 - smoothstep((progress - fadeFrom) / (1 - fadeFrom));
}

/** How far the anticipation pose has come (0 rest, 1 sagged), `ageMs` after the piece appeared. */
export function sagAmount(ageMs: number): number {
  const { anticipationMs, sagRecoverMs } = CUT_LOOK;
  if (ageMs < anticipationMs) return smoothstep(ageMs / anticipationMs);
  return 1 - smoothstep((ageMs - anticipationMs) / sagRecoverMs);
}

/** The beats of one strand, in time from the let-go of the piece. */
export type StrandPhase = 'bridge' | 'stretch' | 'recoil' | 'gone';

export interface StrandClock {
  phase: StrandPhase;
  /** Thinning of the strand: 0 at the let-go, 1 at the snap. */
  stretch: number;
  /** Progress of the recoil, 0..1. */
  recoil: number;
}

/** When a strand with this trait snaps, ms from the let-go. */
export function snapTimeMs(snapShift: number): number {
  return CUT_LOOK.strands.snapMs + snapShift;
}

/** Where a strand is `sinceMs` after the let-go (negative: not yet). */
export function strandClock(sinceMs: number, snapShift: number, out: StrandClock): StrandClock {
  const { bridgeMs, recoilMs } = CUT_LOOK.strands;
  const snap = snapTimeMs(snapShift);
  out.stretch = clamp01(sinceMs / snap);
  out.recoil = clamp01((sinceMs - snap) / recoilMs);
  if (sinceMs >= snap + recoilMs) out.phase = 'gone';
  else if (sinceMs >= snap) out.phase = 'recoil';
  else out.phase = sinceMs < bridgeMs ? 'bridge' : 'stretch';
  return out;
}

/** Whether a strand in this phase has passed its snap (a long frame can jump from the stretch to the end). */
export function snapDue(phase: StrandPhase): boolean {
  return phase === 'recoil' || phase === 'gone';
}

/** Thickness of the strand's middle as a share of its thick ends: a bridge at first, a thin thread at the snap. */
export function middleShare(stretch: number): number {
  const stages = CUT_PICTURE.strand.midShare;
  const last = stages[stages.length - 1]!;
  // Necking: slow at first, quickly thinner towards the snap.
  return lerp(1, last, Math.pow(clamp01(stretch), 2));
}

/** Two neighbouring stage pictures to blend for a middle of `share`, and the weight of the second. */
export interface StagePair {
  low: number;
  high: number;
  weight: number;
}

export function stagePair(share: number, out: StagePair): StagePair {
  const stages = CUT_PICTURE.strand.midShare;
  let i = 0;
  while (i < stages.length - 2 && share < stages[i + 1]!) i++;
  const from = stages[i]!;
  const to = stages[i + 1]!;
  out.low = i;
  out.high = i + 1;
  out.weight = clamp01((from - share) / (from - to));
  return out;
}

/** Share of the strand's length that is left `u` (0..1) into the recoil: it springs back past rest and settles. */
export function recoilLength(u: number): number {
  const { restShare } = CUT_LOOK.strands.recoil;
  return restShare + (1 - restShare) * (1 - backOut(u));
}

/** Opacity of a stub `u` into the recoil: solid, then gone. */
export function recoilAlpha(u: number): number {
  const { fadeFrom } = CUT_LOOK.strands.recoil;
  return 1 - smoothstep((u - fadeFrom) / (1 - fadeFrom));
}
