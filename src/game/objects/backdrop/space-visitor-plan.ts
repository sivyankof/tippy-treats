import {
  SPACE_VISITOR,
  SPACE_VISITOR_IDS,
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
 * Rolls the pass of a run from a decorative random stream (never the run's own stream, so the run
 * stays the same). `forced` (the debug parameter) always gives a pass, soon.
 */
export function planVisitor(
  random: () => number,
  forced: SpaceVisitorId | null = null,
): VisitorPlan | null {
  if (!forced && random() >= SPACE_VISITOR.chancePerRun) return null;
  const guest = forced ?? pickGuest(random());
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

/** The guest whose share of the total weight `roll` (0..1) falls into. */
export function pickGuest(roll: number): SpaceVisitorId {
  const total = SPACE_VISITOR_IDS.reduce((sum, id) => sum + SPACE_VISITOR.guests[id].weight, 0);
  let left = roll * total;
  for (const id of SPACE_VISITOR_IDS) {
    left -= SPACE_VISITOR.guests[id].weight;
    if (left < 0) return id;
  }
  return SPACE_VISITOR_IDS[SPACE_VISITOR_IDS.length - 1] as SpaceVisitorId;
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

/** The lane a guest flies in on a screen `screenH` tall: above the flying row when it fits there, else below; null when neither. */
export function visitorLane(guest: SpaceVisitorId, screenH: number): VisitorLane | null {
  for (const lane of ['above', 'below'] as const) {
    if (scaleIn(guest, visitorBand(screenH, lane)) > 0) return lane;
  }
  return null;
}

/** How much the guest is drawn at on a screen `screenH` tall; 0 when even the smallest size would not fit. */
export function visitorScale(guest: SpaceVisitorId, screenH: number): number {
  const lane = visitorLane(guest, screenH);
  return lane ? scaleIn(guest, visitorBand(screenH, lane)) : 0;
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
  const scale = visitorScale(plan.guest, screenH);
  out.scale = scale;
  const margin = spec.width * scale * SPACE_VISITOR.offscreenShare;
  const from = plan.leftward ? width + margin : -margin;
  const to = plan.leftward ? -margin : width + margin;
  const band = visitorBand(screenH, visitorLane(plan.guest, screenH) ?? 'above');
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
