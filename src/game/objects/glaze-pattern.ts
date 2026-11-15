import type { CutSide } from '../../core/drop';
import { PLAIN_LAYER, type PatternKind } from '../../data/plain-layers';
import { mixColor, shade } from '../../util/color';
import { type GlazeWave, waveY } from './glaze-wave';
import type { LayerBox } from './layer-draw';
import { clipPolylines, uAxis, xAt, type Polyline } from './plain-lines';

const P = PLAIN_LAYER.pattern;
const GLAZE = PLAIN_LAYER.glaze;

/** A round dot of the pattern. */
export interface PatternDot {
  x: number;
  y: number;
  r: number;
}

/** What a pattern is drawn from: stroked lines of one width and filled dots. */
export interface GlazePattern {
  lineWidth: number;
  lines: Polyline[];
  dots: PatternDot[];
}

const FULL_TURN = Math.PI * 2;
/** Directions the edge of a dot is tested in. */
const DOT_TESTS = 8;

/** Brightness of a colour, 0..1. */
function luma(color: number): number {
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/** Colour of a pattern on this glaze: white drizzle, a light tone of the glaze otherwise; darker on a very light glaze. */
export function patternColor(glaze: number, kind: PatternKind): number {
  if (luma(glaze) > P.lightLuma) return shade(glaze, P.darkShade);
  return kind === 'zigzag' ? 0xffffff : mixColor(glaze, 0xffffff, P.lift);
}

/** Highest y a pattern may reach at `x`: above the wavy edge and its darker band. */
function limitY(wave: GlazeWave, x: number): number {
  return waveY(wave, x) - GLAZE.bandPx - P.edgeGap;
}

/**
 * The pattern on the glaze of a plain layer: only inside the glaze (above its wavy edge), clear
 * of the face (`faceHalf` either side of the centre plus a margin; `null`: a faceless piece),
 * of the bitten strip and of the sides. Counted from the uncut edge, so it is cut with the layer.
 */
export function glazePattern(
  kind: PatternKind,
  box: LayerBox,
  cut: CutSide | null,
  faceHalf: number | null,
  wave: GlazeWave,
): GlazePattern {
  const axis = uAxis(box, cut);
  const faceEdge = faceHalf === null ? 0 : faceHalf + P.faceMargin;
  const left = Math.min(axis.anchor, xAt(axis, axis.length)) + P.sideGap;
  const right = Math.max(axis.anchor, xAt(axis, axis.length)) - P.sideGap;
  const topY = box.innerTop + P.topGap;
  const inside = (x: number, y: number): boolean =>
    x >= left && x <= right && Math.abs(x) >= faceEdge && y >= topY && y <= limitY(wave, x);
  const u0 = P.sideGap;
  const u1 = axis.length - P.sideGap;
  const deepest = wave.crestY + wave.tongues.reduce((m, t) => Math.max(m, t.depth), 0);
  const result: GlazePattern = { lineWidth: 0, lines: [], dots: [] };

  if (kind === 'zigzag') {
    const { period, amplitude, width } = P.zigzag;
    // Centred in the band between the top and the lowest the glaze edge allows.
    const row = (topY + wave.crestY - GLAZE.bandPx - P.edgeGap) / 2;
    result.lineWidth = width;
    result.lines = clipPolylines(
      (u) => [xAt(axis, u), row + amplitude * (4 * Math.abs(((u / period) % 1) - 0.5) - 1)],
      u0,
      u1,
      P.step,
      inside,
    );
  } else if (kind === 'lattice') {
    const { pitch, width } = P.lattice;
    result.lineWidth = width;
    const yMin = topY;
    const yMax = deepest;
    // Lines y = u - c and y = c - u, with c on a grid from the uncut edge.
    for (const d of [1, -1] as const) {
      const cLo = d === 1 ? -yMax : yMin;
      const cHi = d === 1 ? axis.length - yMin : axis.length + yMax;
      for (let k = Math.ceil(cLo / pitch); k * pitch <= cHi; k++) {
        const c = k * pitch;
        result.lines.push(
          ...clipPolylines((u) => [xAt(axis, u), d === 1 ? u - c : c - u], u0, u1, P.step, inside),
        );
      }
    }
  } else if (kind === 'waves') {
    const { period, amplitude, width, rowPitch } = P.waves;
    result.lineWidth = width;
    for (let j = 0; topY + amplitude + j * rowPitch <= deepest; j++) {
      const y = topY + amplitude + j * rowPitch;
      const phase = j * Math.PI;
      result.lines.push(
        ...clipPolylines(
          (u) => [xAt(axis, u), y + amplitude * Math.sin((FULL_TURN * u) / period + phase)],
          u0,
          u1,
          P.step,
          inside,
        ),
      );
    }
  } else {
    const { pitch, rowPitch, radius } = P.dots;
    for (let j = 0; topY + radius + j * rowPitch <= deepest; j++) {
      const y = topY + radius + j * rowPitch;
      for (let i = 0; (i + 0.5) * pitch <= axis.length; i++) {
        const u = (i + (j % 2 === 0 ? 0.5 : 1)) * pitch;
        const x = xAt(axis, u);
        let whole = true;
        for (let a = 0; a < DOT_TESTS && whole; a++) {
          const t = (FULL_TURN * a) / DOT_TESTS;
          whole = inside(x + radius * Math.cos(t), y + radius * Math.sin(t));
        }
        if (whole) result.dots.push({ x, y, r: radius });
      }
    }
  }
  return result;
}
