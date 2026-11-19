import type { TowerState } from '../../../core/tower/tower-sim';
import type { Stagger } from './tower-guest-plan';

/** What the guest needs to know about the frame. */
export interface GuestContext {
  state: Readonly<TowerState>;
  /** World scroll of the camera and the logical screen size. */
  cam: { scrollY: number; width: number; height: number };
  /** The shadow of the flying layer on the tower (world x of its centre). */
  shadow: Readonly<{ x: number; visible: boolean }>;
}

/** Sounds and the camera kick of the guest; the run wires them to the audio service and its camera. */
export interface GuestCues {
  splat: () => void;
  peel: () => void;
  buzz: () => void;
  giggle: () => void;
  /** Kicks the camera `mul` times a normal landing. */
  kick: (mul: number) => void;
}

/** Style of one flight: zigzag turns, an optional reel, and how far up it climbs when it leaves. */
export interface FlightSpec {
  zigzagPx: number;
  zigzagCycles: number;
  stagger?: Stagger;
}

/** A layer of the tower the guest is tied to and where on it. */
export interface Anchor {
  index: number;
  /** The top surface (sitting) or the lower edge (pressed under the layer above). */
  edge: 'top' | 'bottom';
  /** Offset from the centre of the layer, pixels. */
  dx: number;
}
