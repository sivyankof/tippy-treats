import { describe, expect, it } from 'vitest';
import { Rng } from '../../core/rng';
import { BALANCE } from '../../data/balance';
import { EFFECT_LEVELS } from '../../data/effect-levels';
import { SQUASH_PICTURES, SQUASH_TEXTURES, TOPPER_SQUASH } from '../../data/topper-squash';
import { channels, luma, overlayColor } from '../../util/color';
import { PLAIN_PAIRS } from '../../data/plain-layers';
import {
  MAX_PRESS_PICTURES,
  markVanish,
  squeezeDoneMs,
  squeezeScale,
  type LayerMark,
} from '../objects/layer-mark-store';
import { CUT_TEXTURES } from '../../data/cut-look';
import { faceHalfSpan } from './glaze-growth';
import { glazeWave, waveY } from '../objects/glaze-wave';
import { layerBox } from '../objects/layer-draw';
import {
  burstCount,
  burstStates,
  classifySquash,
  creamRollMarks,
  creamRollTint,
  crouchScale,
  crouchStep,
  edgeLaunch,
  launchX,
  ovalBottomAt,
  ridgePictureSize,
  rollSpots,
  simX,
  squashLevelPlan,
  stainSpot,
  type DropObstacle,
} from './topper-squash-plan';

describe('classifySquash', () => {
  it('is a hit when the whole body is under the layer', () => {
    expect(classifySquash(300, 30, 300, 400)).toBe('hit');
    expect(classifySquash(440, 30, 300, 400)).toBe('hit');
  });

  it('is an edge shot when the middle is under the layer but the body sticks out', () => {
    expect(classifySquash(480, 30, 300, 400)).toBe('edge');
    expect(classifySquash(120, 30, 300, 400)).toBe('edge');
  });

  it('is a miss when the middle is past the edge of the layer', () => {
    expect(classifySquash(520, 30, 300, 400)).toBe('miss');
    expect(classifySquash(700, 30, 300, 400)).toBe('miss');
  });

  it('keeps a small margin at the edge', () => {
    const edge = 200 - 30 - TOPPER_SQUASH.hitMarginPx;
    expect(classifySquash(300 + edge, 30, 300, 400)).toBe('hit');
    expect(classifySquash(300 + edge + 1, 30, 300, 400)).toBe('edge');
  });
});

describe('squashLevelPlan', () => {
  it('plays everything on full', () => {
    expect(squashLevelPlan('full')).toEqual({
      play: true,
      crouch: true,
      dip: true,
      trace: true,
      squeeze: true,
    });
  });

  it('keeps the squash and the trace on lite, without the dip and the squeeze of the cream', () => {
    expect(squashLevelPlan('lite')).toEqual({
      play: true,
      crouch: true,
      dip: false,
      trace: true,
      squeeze: false,
    });
  });

  it('plays nothing on minimal', () => {
    expect(squashLevelPlan('minimal')).toEqual({
      play: false,
      crouch: false,
      dip: false,
      trace: false,
      squeeze: false,
    });
  });

  it('knows every level', () => {
    for (const level of EFFECT_LEVELS) expect(squashLevelPlan(level)).toBeDefined();
  });
});

describe('crouch', () => {
  it('eases towards the target and lands on it', () => {
    let c = 0;
    let last = 0;
    for (let i = 0; i < 100; i++) {
      c = crouchStep(c, 1, 16.7);
      expect(c).toBeGreaterThanOrEqual(last);
      last = c;
    }
    expect(c).toBe(1);
    for (let i = 0; i < 100; i++) c = crouchStep(c, 0, 16.7);
    expect(c).toBe(0);
  });

  it('does not jump in one frame', () => {
    expect(crouchStep(0, 1, 16.7)).toBeLessThan(0.2);
  });

  it('scales down by the data at full crouch', () => {
    expect(crouchScale(0)).toEqual({ x: 1, y: 1 });
    expect(crouchScale(1).y).toBeCloseTo(TOPPER_SQUASH.crouch.scaleY);
  });
});

describe('edgeLaunch', () => {
  it('flies away from the layer, up and spinning the same way', () => {
    const right = edgeLaunch(1, new Rng(1));
    expect(right.vx).toBeGreaterThan(TOPPER_SQUASH.edge.speedX[0] - 1);
    expect(right.vy).toBeLessThan(0);
    expect(right.spinDeg).toBeGreaterThan(0);
    const left = edgeLaunch(-1, new Rng(1));
    expect(left.vx).toBeLessThan(0);
    expect(left.spinDeg).toBeLessThan(0);
  });
});

describe('stainSpot', () => {
  const waveOf = (width: number) => glazeWave(layerBox(width), null, faceHalfSpan(width, null));

  it('stays clear of the face and of the side of the layer', () => {
    const { stain } = TOPPER_SQUASH;
    for (const width of [300, 480, 720]) {
      const face = faceHalfSpan(width, null);
      for (const topperDx of [-300, -60, 0, 60, 300]) {
        const spot = stainSpot(width, face, topperDx, waveOf(width));
        if (!spot) continue;
        expect(Math.abs(spot.dx) - stain.width / 2).toBeGreaterThanOrEqual(face + stain.faceGapPx);
        expect(Math.abs(spot.dx) + stain.width / 2).toBeLessThanOrEqual(
          width / 2 - stain.edgeGapPx,
        );
      }
    }
  });

  it('keeps the side of the topper', () => {
    const face = faceHalfSpan(720, null);
    expect(stainSpot(720, face, -200, waveOf(720))!.dx).toBeLessThan(0);
    expect(stainSpot(720, face, 200, waveOf(720))!.dx).toBeGreaterThan(0);
  });

  it('lies on the sponge under the glaze edge over it, inside the layer', () => {
    const stain = TOPPER_SQUASH.stain;
    for (const width of [480, 600, 720]) {
      const wave = waveOf(width);
      for (const topperDx of [-250, -120, 120, 250]) {
        const spot = stainSpot(width, faceHalfSpan(width, null), topperDx, wave)!;
        const top = spot.dy - stain.originY * stain.height;
        for (let x = spot.dx - stain.width / 2; x <= spot.dx + stain.width / 2; x += 2) {
          // Sampled every 2 px: within half a pixel of the edge's lowest point.
          expect(top).toBeGreaterThanOrEqual(waveY(wave, x) + stain.belowGlazePx - 0.5);
        }
        const bottom = spot.dy + (1 - stain.originY) * stain.height;
        expect(bottom).toBeLessThan(BALANCE.layer.height / 2);
      }
    }
  });

  it('never caps a growing drip: it moves along, or to the other side', () => {
    const stain = TOPPER_SQUASH.stain;
    const width = 720;
    const face = faceHalfSpan(width, null);
    const half = 17;
    const free = stainSpot(width, face, 200, waveOf(width))!;
    const drips = [free.dx, -250];
    const spot = stainSpot(width, face, 200, waveOf(width), drips, half)!;
    expect(spot.dx).toBeGreaterThan(0);
    for (const d of drips) {
      expect(Math.abs(spot.dx - d)).toBeGreaterThanOrEqual(
        stain.width / 2 + half + stain.dripGapPx,
      );
    }
    // No room on the topper's side: the other side.
    const crowded = [];
    for (let x = 0; x <= width / 2; x += 20) crowded.push(x);
    expect(stainSpot(width, face, 200, waveOf(width), crowded, half)!.dx).toBeLessThan(0);
    // No room anywhere: no stain.
    const all = crowded.flatMap((x) => [x, -x]);
    expect(stainSpot(width, face, 200, waveOf(width), all, half)).toBeNull();
  });

  it('is none on a layer too narrow to hold it beside the face', () => {
    expect(stainSpot(120, faceHalfSpan(120, null), 30, waveOf(120))).toBeNull();
  });
});

describe('rollSpots', () => {
  it('puts the rolls at the two ends of the seam', () => {
    const [left, right] = rollSpots(500, 600, 520, 300)!;
    expect(left.dx).toBeCloseTo(520 - 150 - 500);
    expect(right.dx).toBeCloseTo(520 + 150 - 500);
    expect(left.side).toBe(-1);
    expect(right.side).toBe(1);
  });

  it('keeps the outer end within the overhang past the lower layer when the upper one is wider', () => {
    const [left, right] = rollSpots(500, 300, 500, 600)!;
    const { roll } = TOPPER_SQUASH;
    const reach = 150 + roll.overhangPx - (1 - roll.originX) * roll.width;
    expect(left.dx).toBeCloseTo(-reach);
    expect(right.dx).toBeCloseTo(reach);
  });

  it('sits at the seam', () => {
    const [left] = rollSpots(500, 600, 500, 600)!;
    expect(left.dy).toBeLessThan(-BALANCE.layer.height / 2 + 20);
  });

  it('is none when the layers barely overlap', () => {
    expect(rollSpots(500, 300, 760, 300)).toBeNull();
  });
});

describe('burstStates', () => {
  const burst = TOPPER_SQUASH.kinds.cherry.burst;

  it('counts inside the range and draws the same number of values each time', () => {
    const a = new Rng(7);
    const b = new Rng(7);
    const n = burstCount(burst, a);
    expect(n).toBeGreaterThanOrEqual(burst.count[0]);
    expect(n).toBeLessThanOrEqual(burst.count[1]);
    burstCount(burst, b);
    expect(burstStates(burst, n, 0, 0, 1, a)).toHaveLength(n);
    burstStates(burst, n, 0, 0, -1, b);
    expect(a.next()).toBe(b.next());
  });

  it('flies up and outwards to the chosen side', () => {
    for (const p of burstStates(burst, 20, 10, 20, 1, new Rng(3))) {
      expect(p.vx).toBeGreaterThan(0);
      expect(p.vy).toBeLessThan(0);
    }
    for (const p of burstStates(burst, 20, 10, 20, -1, new Rng(3))) expect(p.vx).toBeLessThan(0);
  });

  it('is the same for the same seed', () => {
    expect(burstStates(burst, 5, 0, 0, 1, new Rng(9))).toEqual(
      burstStates(burst, 5, 0, 0, 1, new Rng(9)),
    );
  });
});

describe('squash data', () => {
  it('has 5-7 berry drops and 3-4 mint leaves', () => {
    expect(TOPPER_SQUASH.kinds.cherry.burst.count).toEqual([5, 7]);
    expect(TOPPER_SQUASH.kinds.strawberry.burst.count).toEqual([5, 7]);
    expect(TOPPER_SQUASH.kinds.mint.burst.count).toEqual([3, 4]);
  });
});

describe('launchX', () => {
  it('keeps the launch clear of the face and inside the edge, on the topper side', () => {
    const { launch } = TOPPER_SQUASH;
    // Topper at the middle: pushed out of the face zone to its side.
    expect(launchX(500, 500, 300, 40) - 500).toBeCloseTo(40 + launch.faceGapPx);
    expect(launchX(480, 500, 300, 40) - 500).toBeCloseTo(-(40 + launch.faceGapPx));
    // Topper near the edge: held inside it.
    expect(launchX(700, 500, 300, 40) - 500).toBeCloseTo(150 - launch.edgeInsetPx);
    // A topper already between the two stays where it is.
    expect(launchX(600, 500, 300, 40)).toBeCloseTo(600);
  });
});

describe('simX', () => {
  it('takes the sway out of a world x: the layer sits at sim 300 but is drawn at world 340', () => {
    expect(simX({ x: 300 }, 340, 340)).toBe(300);
    expect(simX({ x: 300 }, 360, 340)).toBe(320);
  });

  it('makes the crouch agree with the landing outcome while the tower sways', () => {
    const half = 20;
    // Topper 20 px right of the layer centre; a flying layer centred on the layer covers 100 px each side.
    const swayed = simX({ x: 300 }, 340 + 20, 340);
    expect(classifySquash(swayed, half, 300, 200)).toBe(classifySquash(320, half, 300, 200));
  });
});

describe('the cream roll', () => {
  const spots = rollSpots(500, 600, 520, 300)!;
  const input = {
    nowMs: 10_000,
    squeeze: true,
    tint: 0xffd6e1,
    outline: 0x9a6a50,
    faceHalf: 60,
    avoid: [] as DropObstacle[],
  };
  const ridgeKeys: string[] = [SQUASH_TEXTURES.creamRidgeA, SQUASH_TEXTURES.creamRidgeB];
  const ridges = (marks: LayerMark[]): LayerMark[] =>
    marks.filter((m) => ridgeKeys.includes(m.texture));
  const beads = (marks: LayerMark[]): LayerMark[] =>
    marks.filter((m) => m.texture === CUT_TEXTURES.bead);
  const drops = (marks: LayerMark[]): LayerMark[] =>
    marks.filter((m) => m.texture === SQUASH_TEXTURES.creamDrop);

  it('goes back to front: drops, ridges, beads, and fits in one press mark', () => {
    const marks = creamRollMarks(spots, input);
    expect(marks.length).toBeLessThanOrEqual(MAX_PRESS_PICTURES);
    const firstRidge = marks.findIndex((m) => ridgeKeys.includes(m.texture));
    const firstBead = marks.findIndex((m) => m.texture === CUT_TEXTURES.bead);
    expect(drops(marks.slice(firstRidge))).toHaveLength(0);
    expect(ridges(marks.slice(firstBead))).toHaveLength(0);
    expect(ridges(marks)).toHaveLength(2);
    expect(beads(marks)).toHaveLength(4);
  });

  it('swells a round bead at the seam first, then pushes the ridge out from behind it as the bead shrinks away', () => {
    const marks = creamRollMarks(spots, input);
    const [left, right] = ridges(marks);
    const [outline, fill] = beads(marks);
    for (const b of beads(marks)) expect(b.width).toBe(b.height);
    expect(outline!.width).toBeGreaterThan(fill!.width);
    expect(outline!.tint).toBe(input.outline);
    expect(fill!.tint).toBe(input.tint);
    // The bead shows from its first frame, before its ridge starts.
    expect(outline!.bornMs).toBeLessThan(left!.bornMs);
    expect(squeezeScale(outline!.squeeze!, 1, 0)).toBeGreaterThan(0.45);
    // It is gone while its ridge is still being pushed out (so the ridge never pops out from behind it).
    const goneAt = outline!.handOver!.startMs + outline!.handOver!.durMs;
    expect(goneAt).toBeLessThan(
      left!.bornMs + TOPPER_SQUASH.roll.squeeze.bulgeMs + TOPPER_SQUASH.roll.squeeze.pushMs,
    );
    expect(markVanish(outline!, goneAt)).toBe(0);
    expect(markVanish(outline!, outline!.handOver!.startMs - 1)).toBe(1);
    // Next to the anchor of its ridge, above its bottom line.
    expect(Math.abs(outline!.dx - left!.dx)).toBeLessThan(TOPPER_SQUASH.roll.bead.size);
    expect(outline!.dy).toBeLessThan(left!.dy);
    expect(right!.bornMs).toBeGreaterThan(left!.bornMs);
  });

  it('has no bead when it lies there at once', () => {
    expect(beads(creamRollMarks(spots, { ...input, squeeze: false }))).toHaveLength(0);
  });

  it('slides a drop along its ridge away from the swirls and drips of the lower layer', () => {
    const plain = drops(creamRollMarks(spots, input));
    const { halfPx, clearPx } = TOPPER_SQUASH.roll.drop;
    // A swirl right under every drop where it would hang.
    const avoid = plain.map((d) => ({ x: d.dx, half: 11 }));
    const moved = drops(creamRollMarks(spots, { ...input, avoid }));
    expect(moved.length).toBeGreaterThan(0);
    for (const d of moved) {
      for (const o of avoid) {
        expect(Math.abs(d.dx - o.x)).toBeGreaterThanOrEqual(
          o.half + (halfPx * d.width) / plain[0]!.width + clearPx - 0.01,
        );
      }
    }
    // Two drops of a ridge never touch each other.
    const right = moved.filter((d) => d.dx > 0);
    if (right.length === 2) expect(Math.abs(right[0]!.dx - right[1]!.dx)).toBeGreaterThan(halfPx);
  });

  it('leaves a drop out when its ridge has no free spot', () => {
    const avoid = [{ x: 0, half: 1000 }];
    const marks = creamRollMarks(spots, { ...input, avoid });
    expect(drops(marks)).toHaveLength(0);
    expect(ridges(marks)).toHaveLength(2);
  });

  it('gives the two ends different ridges and drops, not a mirror', () => {
    const marks = creamRollMarks(spots, input);
    const [left, right] = ridges(marks);
    expect(left!.texture).toBe(SQUASH_TEXTURES.creamRidgeA);
    expect(right!.texture).toBe(SQUASH_TEXTURES.creamRidgeB);
    expect(left!.flipX).toBe(true);
    expect(right!.flipX).toBe(false);
    const hanging = drops(marks);
    const leftDrops = hanging.filter((d) => d.dx < 0);
    const rightDrops = hanging.filter((d) => d.dx > 0);
    expect(leftDrops).toHaveLength(1);
    expect(rightDrops).toHaveLength(2);
    // Measured from the anchor of its ridge, no drop of one side sits where a drop of the other does.
    for (const l of leftDrops) {
      for (const r of rightDrops) {
        expect(Math.abs(left!.dx - l.dx - (r.dx - right!.dx))).toBeGreaterThan(4);
      }
    }
  });

  it('hangs every drop from the bottom line of its ridge, on its outer side', () => {
    const marks = creamRollMarks(spots, input);
    const [left, right] = ridges(marks);
    for (const d of drops(marks)) {
      const ridge = d.dx < 0 ? left! : right!;
      expect(Math.abs(d.dy - ridge.dy)).toBeLessThan(TOPPER_SQUASH.roll.drop.tuckPx + 3);
      expect(Math.sign(d.dx - ridge.dx)).toBe(d.dx < 0 ? -1 : 1);
    }
  });

  it('never hangs a drop over the face of the lower layer', () => {
    const near = rollSpots(500, 600, 500, 160)!;
    const faceHalf = 110;
    const marks = creamRollMarks(near, { ...input, faceHalf });
    for (const d of drops(marks)) {
      expect(Math.abs(d.dx)).toBeGreaterThanOrEqual(faceHalf + TOPPER_SQUASH.roll.drop.faceGapPx);
    }
    expect(drops(marks).length).toBeLessThan(3);
    expect(ridges(marks)).toHaveLength(2);
  });

  it('is tinted with the overlay of the cream tone', () => {
    const marks = creamRollMarks(spots, input);
    for (const m of [...ridges(marks), ...drops(marks)]) {
      expect(m.tint).toBe(input.tint);
      expect(m.tintMode).toBe('overlay');
    }
  });

  it('squeezes the left ridge out first, the right one a moment later, the drops after their ridge', () => {
    const marks = creamRollMarks(spots, input);
    const [left, right] = ridges(marks);
    expect(left!.bornMs).toBeGreaterThan(input.nowMs);
    expect(right!.bornMs).toBeGreaterThan(left!.bornMs);
    for (const d of drops(marks)) {
      const ridge = d.dx < 0 ? left! : right!;
      expect(d.bornMs).toBeGreaterThan(ridge.bornMs + TOPPER_SQUASH.roll.squeeze.bulgeMs);
    }
  });

  it('lies there at once in its final shape without the squeeze', () => {
    for (const m of creamRollMarks(spots, { ...input, squeeze: false })) {
      const look = m.squeeze!;
      const age = input.nowMs - m.bornMs;
      expect(age).toBe(squeezeDoneMs(look));
      expect(squeezeScale(look, age, 0)).toBeCloseTo(look.sag?.to[0] ?? 1);
      expect(squeezeScale(look, age, 1)).toBeCloseTo(look.sag?.to[1] ?? 1);
    }
  });

  it('takes the tone of the glaze, lighter than it', () => {
    for (const glaze of [0xffaecb, 0x7a4630, 0xb7e1ff, 0xfff4e4]) {
      const tint = creamRollTint(glaze);
      expect(luma(tint)).toBeGreaterThanOrEqual(luma(glaze));
      expect(luma(tint)).toBeLessThan(luma(SQUASH_PICTURES.cream.cream) + 0.001);
    }
    expect(creamRollTint(0x7a4630)).not.toBe(creamRollTint(0xffaecb));
  });

  it('reads as cream on every glaze that carries cream: lighter than the glaze, a warm outline a tone darker', () => {
    const { tones } = SQUASH_PICTURES.cream;
    for (const pair of PLAIN_PAIRS.filter((p) => p.decor.includes('cream'))) {
      const tint = creamRollTint(pair.glaze);
      expect(luma(tint)).toBeGreaterThan(Math.min(0.9, luma(pair.glaze) + 0.04));
      const outline = channels(overlayColor(tones.outline, tint));
      const shade = overlayColor(tones.shade, tint);
      // Warm: red over green over blue, whatever the glaze hue.
      expect(outline[0]).toBeGreaterThan(outline[1]! + 10);
      expect(outline[1]).toBeGreaterThan(outline[2]! + 10);
      expect(luma(overlayColor(tones.outline, tint))).toBeLessThan(luma(tint) * 0.7);
      expect(luma(shade)).toBeGreaterThan(luma(tint) * 0.82);
      expect(luma(shade)).toBeLessThan(luma(tint));
    }
  });

  it('takes less of a dark glaze, so the cream stays light on chocolate', () => {
    const { creamShare, darkGlaze } = TOPPER_SQUASH.roll;
    const chocolate = 0x7a4630;
    expect(luma(chocolate)).toBeLessThan(darkGlaze.toLuma);
    const light = channels(creamRollTint(chocolate));
    const cream = channels(SQUASH_PICTURES.cream.cream);
    const glaze = channels(chocolate);
    // The red channel tells the share of the cream in the mix.
    const share = (light[0]! - glaze[0]!) / (cream[0]! - glaze[0]!);
    expect(share).toBeCloseTo(darkGlaze.share, 1);
    expect(share).toBeGreaterThan(creamShare);
    // A light glaze keeps the plain share.
    const pink = 0xffaecb;
    const g = channels(creamRollTint(pink));
    expect((g[1]! - channels(pink)[1]!) / (cream[1]! - channels(pink)[1]!)).toBeCloseTo(
      creamShare,
      1,
    );
  });

  it('keeps every drawn ridge inside its picture with the clear field', () => {
    const { roll } = TOPPER_SQUASH;
    const { cream, field, bake } = SQUASH_PICTURES;
    // 3 baked pixels of clear field at least (docs/06, "Поле картинки").
    const room = field - 3 / bake;
    for (const ridge of Object.values(cream.ridges)) {
      for (const b of [ridge.base, ...ridge.festoons]) {
        expect(b.cx - b.rx - cream.outlinePx).toBeGreaterThanOrEqual(-room);
        expect(b.cx + b.rx + cream.outlinePx).toBeLessThanOrEqual(roll.width + room);
        expect(b.cy - b.ry - cream.outlinePx).toBeGreaterThanOrEqual(-room);
        expect(b.cy + b.ry + cream.outlinePx).toBeLessThanOrEqual(roll.height + room);
      }
      // The anchor sits on the bottom line of the base, where the drops hang.
      const bottom = ovalBottomAt(ridge.base, roll.originX * roll.width);
      expect(Math.abs(bottom - roll.originY * roll.height)).toBeLessThan(1.5);
    }
    expect(ridgePictureSize()).toEqual([roll.width + field * 2, roll.height + field * 2]);
  });
});

describe('ovalBottomAt', () => {
  it('is the lowest point of the oval, its centre line outside it', () => {
    const oval = { cx: 10, cy: 20, rx: 8, ry: 4 };
    expect(ovalBottomAt(oval, 10)).toBe(24);
    expect(ovalBottomAt(oval, 18)).toBeCloseTo(20);
    expect(ovalBottomAt(oval, 40)).toBeCloseTo(20);
  });
});
