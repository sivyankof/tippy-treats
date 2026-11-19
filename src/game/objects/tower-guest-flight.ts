import { TOWER_GUEST } from '../../data/guests/tower-guest';
import { easeInQuad, easeOutQuad } from '../../util/math';
import { flightPoint, type FlightPoint } from './tower-guest-plan';
import type { FlightSpec } from './tower-guest-types';

/** One flight of the guest: where it starts and ends, how it zigzags and how it is eased. */
export class GuestFlight {
  /** Where the guest is now (the flight writes it, the anchor too). */
  readonly pos: FlightPoint = { x: 0, y: 0 };
  readonly from: FlightPoint = { x: 0, y: 0 };
  readonly to: FlightPoint = { x: 0, y: 0 };
  private zigzag: FlightSpec = { zigzagPx: 0, zigzagCycles: 0 };
  private ease: (t: number) => number = easeOutQuad;

  /** The style of an arrival: it eases out to the layer. */
  setArrival(spec: FlightSpec): void {
    this.zigzag = spec;
    this.ease = easeOutQuad;
  }

  /**
   * Aims a flight from where the guest is to beyond the screen edge on the side `toRight`, climbing
   * by `riseBy` pixels, and eases it in. `screenWidth` is the logical width of the screen.
   */
  aimOff(spec: FlightSpec, screenWidth: number, toRight: boolean, riseBy: number): void {
    this.from.x = this.pos.x;
    this.from.y = this.pos.y;
    this.to.x = toRight ? screenWidth + TOWER_GUEST.offscreenPx : -TOWER_GUEST.offscreenPx;
    this.to.y = this.pos.y - riseBy;
    this.zigzag = spec;
    this.ease = easeInQuad;
  }

  /** Places the guest `t` of the way along the flight from `from` to `to`. */
  fly(t: number): void {
    const { zigzagPx, zigzagCycles } = this.zigzag;
    flightPoint(
      this.from.x,
      this.from.y,
      this.to.x,
      this.to.y,
      t,
      zigzagPx,
      zigzagCycles,
      this.ease,
      this.pos,
      this.zigzag.stagger ?? null,
    );
  }
}
