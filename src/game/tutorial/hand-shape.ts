import { DEG_TO_RAD } from '../../util/math';
import { ellipsePoints, roundRectPoints, type Pt } from '../fx/common/plain-style';

/** The look of the hand that `buildHand` turns into points. */
export interface HandLook {
  scale: number;
  tiltDeg: number;
  palmShadowRight: number;
  palmShadowBottom: number;
  cuffShadowRight: number;
  cuffShadowBottom: number;
}

/** A rounded rectangle of the sketch: centre, half sizes and corner radius, sketch units. */
interface Round {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  r: number;
}

/** A round part of the sketch: centre and radius. */
interface Disc {
  cx: number;
  cy: number;
  r: number;
}

/**
 * The parts of the hand in the units of its sketch (a finger that points up, 250 x 270 around):
 * the numbers are the shape, `HandLook.scale` brings them to logical pixels.
 */
const SKETCH = {
  finger: { cx: 98, cy: 75, rx: 30, ry: 65, r: 30 } satisfies Round,
  knuckles: [
    { cx: 150, cy: 116, r: 27 },
    { cx: 181, cy: 134, r: 24 },
  ] satisfies Disc[],
  palm: { cx: 132, cy: 151, rx: 74, ry: 53, r: 50 } satisfies Round,
  /** The thumb is a rounded rectangle turned by `thumbTurnDeg` around `thumbPivot`. */
  thumb: { cx: 58, cy: 143, rx: 26, ry: 39, r: 26 } satisfies Round,
  thumbTurnDeg: -38,
  thumbPivot: { x: 60, y: 176 },
  cuff: { cx: 133, cy: 215, rx: 61, ry: 27, r: 27 } satisfies Round,
  /** Two curved strokes on the knuckles: start, bend, end. */
  creases: [
    [
      { x: 126, y: 104 },
      { x: 134, y: 128 },
      { x: 128, y: 146 },
    ],
    [
      { x: 160, y: 126 },
      { x: 166, y: 142 },
      { x: 160, y: 156 },
    ],
  ] satisfies (readonly [Pt, Pt, Pt])[],
  /** The streak on the finger: centre, half sizes, and the dot below it. */
  fingerGloss: { cx: 86, cy: 52, rx: 8, ry: 26, dotY: 92, dotR: 5 },
  /** The streak on the cuff: centre, half sizes, tilt in degrees. */
  cuffGloss: { cx: 116, cy: 200, rx: 24, ry: 3.5, tiltDeg: -10 },
} as const;

const CREASE_STEPS = 8;

/** The point at `t` of a quadratic curve. */
function quadAt(a: Pt, b: Pt, c: Pt, t: number): Pt {
  const u = 1 - t;
  return {
    x: u * u * a.x + 2 * u * t * b.x + t * t * c.x,
    y: u * u * a.y + 2 * u * t * b.y + t * t * c.y,
  };
}

export interface HandGeometry {
  /** Size of the hand without its outline, logical pixels. */
  width: number;
  height: number;
  /** The touch point: the highest point of the fingertip. */
  tip: Pt;
  /** The parts that make the silhouette, each pushed `grow` px outwards: the outline pass. */
  silhouette: (grow: number) => Pt[][];
  finger: Pt[];
  knuckles: Pt[][];
  palm: Pt[];
  /** The lit part of the palm: what the shadow band leaves. */
  palmLit: Pt[];
  thumb: Pt[];
  cuff: Pt[];
  /** The cuff pushed `grow` px outwards: its own outline. */
  cuffGrown: (grow: number) => Pt[];
  cuffLit: Pt[];
  creases: Pt[][];
  /** The streak on the finger and the dot below it. */
  fingerGloss: { streak: Pt[]; dot: Pt; dotRadius: number };
  cuffGloss: Pt[];
}

/**
 * The points of the chubby glove, tilted and scaled, with the top left of its bounding box at
 * (0, 0). Pure geometry: `hint-textures.ts` fills it with colours.
 */
export function buildHand(look: HandLook): HandGeometry {
  const s = look.scale;
  const tilt = look.tiltDeg * DEG_TO_RAD;
  const pivot = { x: SKETCH.palm.cx, y: SKETCH.palm.cy };
  const turn = (p: Pt, about: Pt, rad: number): Pt => {
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const dx = p.x - about.x;
    const dy = p.y - about.y;
    return { x: about.x + dx * cos - dy * sin, y: about.y + dx * sin + dy * cos };
  };
  /** Sketch point to the hand: tilted as a whole, then scaled (the offset is fixed below). */
  const place = (p: Pt): Pt => {
    const q = turn(p, pivot, tilt);
    return { x: q.x * s, y: q.y * s };
  };
  const round = (b: Round, grow: number): Pt[] =>
    roundRectPoints(b.cx, b.cy, b.rx + grow / s, b.ry + grow / s, b.r + grow / s).map(place);
  const disc = (d: Disc, grow: number): Pt[] =>
    ellipsePoints(d.cx, d.cy, d.r + grow / s, d.r + grow / s, 0).map(place);
  const thumb = (grow: number): Pt[] =>
    roundRectPoints(
      SKETCH.thumb.cx,
      SKETCH.thumb.cy,
      SKETCH.thumb.rx + grow / s,
      SKETCH.thumb.ry + grow / s,
      SKETCH.thumb.r + grow / s,
    )
      .map((p) => turn(p, SKETCH.thumbPivot, SKETCH.thumbTurnDeg * DEG_TO_RAD))
      .map(place);
  /** The lit copy of a body: the right and the bottom edge pulled in, the corners kept round. */
  const lit = (b: Round, right: number, bottom: number): Pt[] => {
    const rx = b.rx - right / 2;
    const ry = b.ry - bottom / 2;
    return roundRectPoints(b.cx - right / 2, b.cy - bottom / 2, rx, ry, b.r).map(place);
  };

  const silhouette = (grow: number): Pt[][] => [
    round(SKETCH.finger, grow),
    ...SKETCH.knuckles.map((k) => disc(k, grow)),
    round(SKETCH.palm, grow),
    thumb(grow),
    round(SKETCH.cuff, grow),
  ];

  const bounds = silhouette(0)
    .flat()
    .reduce(
      (b, p) => ({
        minX: Math.min(b.minX, p.x),
        minY: Math.min(b.minY, p.y),
        maxX: Math.max(b.maxX, p.x),
        maxY: Math.max(b.maxY, p.y),
      }),
      { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
    );
  const at = (p: Pt): Pt => ({ x: p.x - bounds.minX, y: p.y - bounds.minY });
  const all = (points: Pt[]): Pt[] => points.map(at);

  const finger = all(round(SKETCH.finger, 0));
  const tipPoint = finger.reduce((best, p) => (p.y < best.y ? p : best));
  const gloss = SKETCH.fingerGloss;
  const cuffGloss = SKETCH.cuffGloss;
  return {
    width: bounds.maxX - bounds.minX,
    height: bounds.maxY - bounds.minY,
    tip: tipPoint,
    silhouette: (grow) => silhouette(grow).map(all),
    finger,
    knuckles: SKETCH.knuckles.map((k) => all(disc(k, 0))),
    palm: all(round(SKETCH.palm, 0)),
    palmLit: all(lit(SKETCH.palm, look.palmShadowRight, look.palmShadowBottom)),
    thumb: all(thumb(0)),
    cuff: all(round(SKETCH.cuff, 0)),
    cuffGrown: (grow) => all(round(SKETCH.cuff, grow)),
    cuffLit: all(lit(SKETCH.cuff, look.cuffShadowRight, look.cuffShadowBottom)),
    creases: SKETCH.creases.map((curve) => {
      const [a, b, c] = curve;
      const points: Pt[] = [];
      for (let i = 0; i <= CREASE_STEPS; i++) {
        points.push(at(place(quadAt(a, b, c, i / CREASE_STEPS))));
      }
      return points;
    }),
    fingerGloss: {
      streak: all(ellipsePoints(gloss.cx, gloss.cy, gloss.rx, gloss.ry, 0).map(place)),
      dot: at(place({ x: gloss.cx + 1, y: gloss.dotY })),
      dotRadius: gloss.dotR * s,
    },
    cuffGloss: all(
      ellipsePoints(
        cuffGloss.cx,
        cuffGloss.cy,
        cuffGloss.rx,
        cuffGloss.ry,
        cuffGloss.tiltDeg * DEG_TO_RAD,
      ).map(place),
    ),
  };
}
