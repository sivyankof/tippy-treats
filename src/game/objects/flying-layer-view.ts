import type * as Phaser from 'phaser';
import type { TowerState } from '../../core/tower-sim';
import { ANIM } from '../../data/anim';
import { BALANCE } from '../../data/balance';
import { EDGE_SQUASH } from '../../data/edge-squash';
import { HINT_PULSE } from '../../data/idle-motion';
import { PALETTE } from '../../data/palette';
import { RULE_ANIM } from '../../data/rule-anim';
import { oscillate01, sineWave, stepToward } from '../../util/math';
import { DEPTH } from '../depth';
import { easeFn } from '../fx/ease';
import { effectsMode } from '../effects-mode';
import { shadowLook } from '../fx/shadow-emphasis';
import { safeSides } from '../safe-sides';
import { aimMouth, type Reaction } from './face-state';
import {
  FlyingEdgeSquash,
  type SquashBody,
  type Walls,
  type WallTouch,
} from './flying-edge-squash';
import { LayerView } from './layer-view';
import type { TowerView } from './tower-view';

const fallEase = easeFn(ANIM.fall.ease);

/** The layer that sweeps over the tower, driven by `state.flying`. */
export class FlyingLayerView {
  private readonly view: LayerView;
  private readonly hint: Phaser.GameObjects.Rectangle;
  private shownIndex = -1;
  private squinting = false;
  /** Reused every frame; `hasPos` tells whether it holds a layer. */
  private readonly pos = { x: 0, y: 0 };
  private hasPos = false;
  private stretched = false;
  /** Cloud density the shadow is drawn with, 0..1; it follows `CloudCover.density` smoothly. */
  private shadowDensity = 0;
  /** Centre and top of the drawn shadow, reused every frame. */
  private readonly anchor = { x: 0, y: 0, visible: false };
  /** The squash against the screen edges, the walls it meets and the width of the layer. */
  private readonly edge = new FlyingEdgeSquash();
  private readonly walls: Walls = { left: 0, right: 0 };
  private width = 0;
  /** Centre and width of the drawn body, reused every frame. */
  private readonly drawn = { x: 0, y: 0, width: 0, tall: 1 };

  constructor(
    scene: Phaser.Scene,
    private readonly tower: TowerView,
  ) {
    this.view = new LayerView(scene).setDepth(DEPTH.flying).setVisible(false);
    this.hint = scene.add
      .rectangle(0, 0, 1, ANIM.flying.hintHeight, PALETTE.textDark, ANIM.flying.hintShadowAlpha)
      .setOrigin(0, 0)
      .setDepth(DEPTH.hint)
      .setVisible(false);
  }

  /** World position of the layer centre, `null` while no layer flies. The object is reused: read it at once. */
  position(): Readonly<{ x: number; y: number }> | null {
    return this.hasPos ? this.pos : null;
  }

  /** Where the shadow is drawn now (world space): centre of its clamped rectangle and its top. */
  shadowAnchor(): Readonly<{ x: number; y: number; visible: boolean }> {
    return this.anchor;
  }

  /** A white band runs over the flying layer (the rainbow's sheen). */
  sweepGloss(): void {
    this.view.playGlossSweep();
  }

  /**
   * The body as it is drawn, squashed against a screen edge (world centre, width and how many times
   * taller its tallest column is; the true centre and width, 1, when nothing squashes), for what is laid over the layer. Reused: read it
   * at once; `null` while no layer flies.
   */
  body(): Readonly<{ x: number; y: number; width: number; tall: number }> | null {
    if (!this.hasPos) return null;
    const body: Readonly<SquashBody> = this.edge.drawnBody();
    this.drawn.x = this.pos.x + body.mid;
    this.drawn.y = this.pos.y;
    this.drawn.width = body.width;
    this.drawn.tall = body.tall;
    return this.drawn;
  }

  /** A hard layer knocked against a screen edge this frame (once), for its particles. */
  takeWallTouch(): WallTouch | null {
    return this.edge.takeTouch();
  }

  /**
   * Shifts the picture for this frame (a pull-back, a jolt): call it after `sync`, which puts it
   * back. `position()` moves with it, so what is laid around the layer stays on the picture.
   */
  nudge(dx: number, dy: number): void {
    this.view.x += dx;
    this.view.y += dy;
    this.pos.x += dx;
    this.pos.y += dy;
    this.redrawSquash();
  }

  /** Squeezes or swells the whole picture around its centre for this frame; `sync` puts it back. */
  stretch(scaleX: number, scaleY: number): void {
    this.view.setScale(scaleX, scaleY);
    this.stretched = true;
    this.redrawSquash();
  }

  /** The face of the flying layer makes a short face. */
  react(reaction: Reaction, ms: number): void {
    this.view.faceView.react(reaction, ms);
  }

  sync(state: Readonly<TowerState>, nowMs: number, dtMs: number): void {
    if (this.stretched) {
      this.view.setScale(1);
      this.stretched = false;
    }
    const flying = state.flying;
    if (!flying) {
      this.view.setVisible(false);
      this.hint.setVisible(false);
      this.anchor.visible = false;
      this.shownIndex = -1;
      this.hasPos = false;
      return;
    }
    const half = BALANCE.layer.height / 2;
    const surface = this.tower.topY();
    const hoverY = surface - BALANCE.layer.gapAboveTower - half;
    const landY = surface - half;
    const bob = sineWave(nowMs, ANIM.flying.bobPeriodMs) * ANIM.flying.bobAmplitude;
    const falling = state.phase === 'falling';

    let y = hoverY + bob;
    let stretch = 0;
    let stretchT = 0;
    if (falling) {
      const t = Math.min(1, state.phaseMs / BALANCE.layer.fallMs);
      stretchT = t;
      stretch = fallEase(t);
      y = hoverY + (landY - hoverY) * stretch + bob * (1 - t);
    }

    const face = this.view.faceView;
    this.measureWalls();
    if (this.shownIndex !== flying.index) {
      // A fresh layer: clean state, then it flies in squeezed wide.
      this.shownIndex = flying.index;
      this.squinting = false;
      this.view.resetAnim();
      this.view.playAppear();
      this.edge.reset(flying, this.walls);
    }
    // The colour follows the number the layer will have in the tower (twins add height, not layers).
    this.view.setLook(flying).setLayer(state.layers.length + 1, flying.width);
    this.view.setSquash(1 + (ANIM.fall.scaleX - 1) * stretch, 1 + (ANIM.fall.scaleY - 1) * stretch);
    if (falling !== this.squinting) {
      this.squinting = falling;
      if (falling) face.react('squint', Infinity);
      else face.clearReaction();
    }
    face.setMouthHint(aimMouth(flying.x - this.tower.topViewX(), flying.width));
    face.lookAt(this.tower.topViewX() - flying.x, surface - y);
    this.view.setPosition(flying.x, y).setVisible(true);
    this.edge.step(
      flying,
      this.walls,
      state.phase === 'flying',
      falling ? stretchT : 0,
      dtMs,
      this.view,
    );
    this.width = flying.width;
    this.pos.x = flying.x;
    this.pos.y = y;
    this.hasPos = true;
    this.redrawSquash();
    this.view.tick(dtMs);

    // A cloud over the layer does not hide the shadow: it gets clearer (`emphasizeShadow`).
    this.placeHint(flying.x, flying.width, surface, state.phase === 'flying', nowMs);
  }

  /**
   * Makes the shadow clearer under a cloud (`density` 0..1, see `CloudCover.density`): call it
   * after `sync` every frame. The shadow is only restyled, never hidden or moved.
   */
  emphasizeShadow(density: number, nowMs: number, dtMs: number): void {
    const cfg = RULE_ANIM.cloud.shadow;
    // The drawn density follows the cloud's at a limited speed, so the shadow never darkens or
    // clears in a single frame whatever the cloud does.
    this.shadowDensity = stepToward(this.shadowDensity, density, dtMs / cfg.rampMs);
    const look = shadowLook(this.shadowDensity, nowMs, effectsMode.reduced);
    this.hint.setFillStyle(PALETTE.textDark, look.fillAlpha);
    if (look.outlineAlpha > 0) {
      this.hint.setStrokeStyle(cfg.outlineWidth, cfg.outlineColor, look.outlineAlpha);
    } else {
      this.hint.setStrokeStyle();
    }
  }

  /** Screen walls the layer squashes against: the screen edges, the safe area and a margin. */
  private measureWalls(): void {
    const scene = this.view.scene;
    const cam = scene.cameras.main;
    const width = cam.width / (cam.zoom || 1);
    const sides = safeSides(scene.game.canvas, width);
    this.walls.left = cam.scrollX + EDGE_SQUASH.marginPx + sides.left;
    this.walls.right = cam.scrollX + width - EDGE_SQUASH.marginPx - sides.right;
  }

  /** Squashes the picture where it is drawn now. */
  private redrawSquash(): void {
    if (this.hasPos) this.edge.draw(this.view, this.view.x, this.width, this.walls);
  }

  /** Shadow of the flying layer on the top layer of the tower (or on the tray). */
  private placeHint(x: number, width: number, surface: number, show: boolean, nowMs: number): void {
    const span = this.tower.topSpan();
    const inset = Math.min(ANIM.layer.cornerRadius / 2, (span.right - span.left) / 4);
    const left = Math.max(x - width / 2, span.left + inset);
    const right = Math.min(x + width / 2, span.right - inset);
    if (!show || right <= left) {
      this.hint.setVisible(false);
      this.anchor.visible = false;
      return;
    }
    this.anchor.x = (left + right) / 2;
    this.anchor.y = surface + ANIM.layer.outline;
    this.anchor.visible = true;
    // The shadow breathes, so it never stands still even when the layer holds still (a wind-up).
    const pulse = 1 - HINT_PULSE.amount * oscillate01(nowMs, HINT_PULSE.periodMs);
    this.hint
      .setPosition(left, surface + ANIM.layer.outline)
      .setSize(right - left, ANIM.flying.hintHeight)
      .setAlpha(pulse)
      .setVisible(true);
  }
}
