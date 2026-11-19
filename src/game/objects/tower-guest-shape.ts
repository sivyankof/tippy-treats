import { TOWER_GUEST } from '../../data/guests/tower-guest';
import { clamp01, DEG_TO_RAD, flapScale, lerp, sineWave } from '../../util/math';
import { SPLAT_STAGES, splatShape, type GuestPhase, type GuestShape } from './tower-guest-plan';

const { splat, flap, rub } = TOWER_GUEST;

/** What the shape of the guest in one frame depends on (a reused record, filled by the guest). */
export interface ShapeInput {
  phase: GuestPhase;
  phaseMs: number;
  spanMs: number;
  /** Time of the wing beat already going when the flight began (a turned arrival). */
  rampedMs: number;
  clockMs: number;
  /** Tilt of the layer the guest is tied to, radians. */
  swayTilt: number;
  /** Lean of the flinch going now, radians. */
  flinchLean: number;
  plainSplat: boolean;
}

/** 0 to 1: how much of the flight's buzz shows now. */
function flightRamp(i: ShapeInput): number {
  const { flightRampMs } = TOWER_GUEST;
  const landing = i.phase === 'arrive' ? (i.spanMs - i.phaseMs) / flightRampMs : 1;
  return clamp01(Math.min((i.phaseMs + i.rampedMs) / flightRampMs, landing));
}

/** The shape of this frame, written into `shape`: the splat stages, or the flight and the rest. */
export function fillGuestShape(i: ShapeInput, shape: GuestShape): GuestShape {
  const phase = i.phase;
  if (SPLAT_STAGES.includes(phase)) {
    splatShape(phase, i.phaseMs, shape);
    shape.tilt += i.swayTilt;
    return shape;
  }
  shape.flat = false;
  shape.scaleX = 1;
  if (phase === 'sit') {
    shape.scaleY = 1;
    shape.tilt =
      i.swayTilt +
      i.flinchLean +
      rub.twitchDeg * DEG_TO_RAD * sineWave(i.clockMs, rub.twitchPeriodMs);
    return shape;
  }
  // Flying: wing beats flatten the picture and the body tilts with the buzz; both fade in at
  // take-off (and out at landing) so the shape does not jump.
  const ramp = flightRamp(i);
  const tiltDeg = phase === 'flee' && !i.plainSplat ? splat.flee.tiltDeg : TOWER_GUEST.tiltDeg;
  shape.scaleY = lerp(1, flapScale(i.clockMs, flap), ramp);
  shape.tilt =
    ramp * tiltDeg * DEG_TO_RAD * sineWave(i.clockMs, flap.ms * TOWER_GUEST.tiltPeriodMul);
  return shape;
}
