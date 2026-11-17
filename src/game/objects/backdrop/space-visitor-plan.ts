import {
  SPACE_VISITOR,
  type SpaceVisitorId,
  type VisitorFlight,
} from '../../../data/space-visitor';
import { HUD_LAYOUT } from '../../../data/hud-layout';
import { flightClearBand } from '../../camera-layout';
import { DEG_TO_RAD, lerp, pickRange, sineWave } from '../../../util/math';
import { edgeFade } from './pass-timer';

/** Everything decided about the one pass of a run: whether, which, when, how long, which way. */
export interface VisitorPlan {
  guest: SpaceVisitorId;
  delayMs: number;
  durationMs: number;
  /** True when the guest crosses from right to left. */
  leftward: boolean;
  /** Where in the flight band the guest flies: 0 the upper edge, 1 the lower. */
  bandShare: number;
}

/**
 * Rolls the pass of `guest` on a decorative random stream (never the run's own stream, so the run
 * stays the same). `forced` (the debug parameter) makes the pass come soon.
 */
export function planVisitor(
  guest: SpaceVisitorId,
  random: () => number,
  forced = false,
): VisitorPlan {
  const spec = SPACE_VISITOR.guests[guest];
  const delayMs = forced ? SPACE_VISITOR.forcedDelayMs : pickRange(SPACE_VISITOR.delayMs, random);
  return {
    guest,
    delayMs,
    durationMs: pickRange(spec.flight.durationMs, random),
    leftward: random() < 0.5,
    bandShare: random(),
  };
}

export interface VisitorPose {
  x: number;
  y: number;
  rotation: number;
  alpha: number;
  scale: number;
  flipX: boolean;
}

export function newVisitorPose(): VisitorPose {
  return { x: 0, y: 0, rotation: 0, alpha: 1, scale: 1, flipX: false };
}

export type VisitorLane = 'above' | 'below';

/**
 * The free stripe of a screen `screenH` tall for a lane. Above: under the HUD, above the clear
 * stripe around the line of the flying layer. Below: under that stripe, `belowDepthPx` deep. Each
 * is `bandPadPx` clear of what it borders.
 */
export function visitorBand(
  screenH: number,
  lane: VisitorLane = 'above',
): { top: number; bottom: number } {
  const pad = SPACE_VISITOR.bandPadPx;
  const clear = flightClearBand(screenH);
  if (lane === 'below') {
    const top = clear.bottom + pad;
    return { top, bottom: Math.min(screenH - pad, top + SPACE_VISITOR.belowDepthPx) };
  }
  return { top: HUD_LAYOUT.badgeRowBottom + pad, bottom: clear.top - pad };
}

/** Height a guest takes up in flight: its picture, the slope of its path and its sway. */
function extentOf(guest: SpaceVisitorId): number {
  const spec = SPACE_VISITOR.guests[guest];
  return spec.height + spec.flight.slopePx + spec.flight.bob.px * 2;
}

function scaleIn(guest: SpaceVisitorId, band: { top: number; bottom: number }): number {
  const scale = Math.min(1, (band.bottom - band.top) / extentOf(guest));
  return scale >= SPACE_VISITOR.minFitScale ? scale : 0;
}

/** Where and how large a guest flies on a screen `screenH` tall. */
export interface VisitorFit {
  lane: VisitorLane;
  band: { top: number; bottom: number };
  scale: number;
}

/**
 * The lane a guest flies in: above the flying row when it fits there, else below; null when
 * neither fits, and on a short screen (`minScreenH`).
 */
export function visitorFit(guest: SpaceVisitorId, screenH: number): VisitorFit | null {
  if (screenH < SPACE_VISITOR.minScreenH) return null;
  for (const lane of ['above', 'below'] as const) {
    const band = visitorBand(screenH, lane);
    const scale = scaleIn(guest, band);
    if (scale > 0) return { lane, band, scale };
  }
  return null;
}

export function visitorLane(guest: SpaceVisitorId, screenH: number): VisitorLane | null {
  return visitorFit(guest, screenH)?.lane ?? null;
}

/** How much the guest is drawn at on a screen `screenH` tall; 0 when even the smallest size would not fit. */
export function visitorScale(guest: SpaceVisitorId, screenH: number): number {
  return visitorFit(guest, screenH)?.scale ?? 0;
}

/**
 * Where the guest is at `progress` (0..1) of its pass, on a screen `width` x `screenH`. Fills and
 * returns `out`; `out.scale` is 0 when the guest does not fit this screen.
 */
export function visitorPose(
  plan: VisitorPlan,
  progress: number,
  timeMs: number,
  width: number,
  screenH: number,
  out: VisitorPose,
): VisitorPose {
  const spec = SPACE_VISITOR.guests[plan.guest];
  const flight: VisitorFlight = spec.flight;
  const fit = visitorFit(plan.guest, screenH);
  const scale = fit?.scale ?? 0;
  out.scale = scale;
  const margin = spec.width * scale * SPACE_VISITOR.offscreenShare;
  const from = plan.leftward ? width + margin : -margin;
  const to = plan.leftward ? -margin : width + margin;
  const band = fit?.band ?? visitorBand(screenH);
  const room = (band.bottom - band.top - extentOf(plan.guest) * scale) / 2;
  const centre = (band.top + band.bottom) / 2 + room * (plan.bandShare * 2 - 1);
  const slopeY = flight.slopePx * scale * (progress - 0.5);
  out.x = lerp(from, to, progress);
  out.y = centre + slopeY + flight.bob.px * scale * sineWave(timeMs, flight.bob.ms);
  out.flipX = plan.leftward;
  const rock = flight.rock.deg * DEG_TO_RAD * sineWave(timeMs, flight.rock.ms);
  // A tilt along the slope: the head leads, so a leftward flight mirrors the angle.
  const slope = flight.alongPath ? Math.atan2(flight.slopePx, Math.abs(to - from)) : 0;
  out.rotation = rock + (plan.leftward ? -slope : slope);
  out.alpha = edgeFade(progress, SPACE_VISITOR.fadeEdge);
  return out;
}
