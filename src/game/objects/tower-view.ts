import type * as Phaser from 'phaser';
import type { TowerState } from '../../core/tower-sim';
import { wobbleOffset } from '../../core/wobble';
import { ANIM } from '../../data/anim';
import { BALANCE } from '../../data/balance';
import { KITCHEN_COLORS } from '../../data/palette';
import { DEPTH } from '../depth';
import { bakeTexture } from '../ui/bake-texture';
import { LayerView } from './layer-view';

const TRAY_TEXTURE = 'tray';
const TRAY_SHADOW_WIDTH_RATIO = 1.04;

/**
 * The tray and the placed layers. Positions and widths come from the sim state
 * every frame; only the top few layers get a view, deeper ones go back to a pool.
 */
export class TowerView {
  private readonly active = new Map<number, LayerView>();
  private readonly pool: LayerView[] = [];
  private layerCount = 0;
  private topViewXValue: number = BALANCE.tray.centerX;
  private topWidthValue: number = BALANCE.tray.width;

  constructor(
    private readonly scene: Phaser.Scene,
    /** World y of the tray surface. */
    readonly trayTopY: number,
  ) {
    this.drawTray();
  }

  /** World centre y of the layer with the given 0-based index. */
  layerCenterY(index: number): number {
    return this.trayTopY - (index + 0.5) * BALANCE.layer.height;
  }

  /** World y of the top surface of the tower. */
  topY(): number {
    return this.trayTopY - this.layerCount * BALANCE.layer.height;
  }

  /** Current centre x of the top layer including sway, or the tray centre. */
  topViewX(): number {
    return this.topViewXValue;
  }

  /** Horizontal extent of the top layer (the tray when the tower is empty), sway included. */
  topSpan(): { left: number; right: number } {
    return {
      left: this.topViewXValue - this.topWidthValue / 2,
      right: this.topViewXValue + this.topWidthValue / 2,
    };
  }

  /**
   * Places the views. `cameraBottomY` is the world y of the bottom screen edge:
   * layers fully below it are returned to the pool.
   */
  sync(state: Readonly<TowerState>, cameraBottomY: number): void {
    const count = state.layers.length;
    this.layerCount = count;
    const offscreen = Math.floor((this.trayTopY - cameraBottomY) / BALANCE.layer.height);
    const firstVisible = Math.max(0, offscreen - ANIM.pool.offscreenMarginLayers);
    const first = Math.min(Math.max(firstVisible, count - ANIM.pool.maxLiveLayers), count - 1);

    for (const [index, view] of this.active) {
      if (index < first) this.release(index, view);
    }

    for (let i = Math.max(first, 0); i < count; i++) {
      const layer = state.layers[i];
      if (!layer) continue;
      const view = this.active.get(i) ?? this.acquire(i);
      const depth = count - 1 - i;
      const offset = wobbleOffset(state.wobble, state.wobblePhase, depth);
      view.setLayer(i + 1, layer.width);
      view.setPosition(layer.x + offset, this.layerCenterY(i));
      view.setAngle(ANIM.sway.maxRotationDeg * (offset / BALANCE.wobble.amplitudeMax));
      if (depth === 0) {
        this.topViewXValue = layer.x + offset;
        this.topWidthValue = layer.width;
      }
    }
    if (count === 0) {
      this.topViewXValue = BALANCE.tray.centerX;
      this.topWidthValue = BALANCE.tray.width;
    }
  }

  /** Quick squash of the top layer when the tower sneezes. */
  squashTop(): void {
    const view = this.active.get(this.layerCount - 1);
    if (!view) return;
    this.scene.tweens.killTweensOf(view);
    view.setScale(1, ANIM.sneeze.squashScale);
    this.scene.tweens.add({
      targets: view,
      scaleY: 1,
      duration: ANIM.sneeze.durationMs,
      ease: 'Back.easeOut',
    });
  }

  private acquire(index: number): LayerView {
    const view = this.pool.pop() ?? new LayerView(this.scene).setDepth(DEPTH.tower);
    view.setScale(1).setVisible(true).setActive(true);
    // Layers are drawn in list order at equal depth: a reused view must land above the one below.
    this.scene.children.bringToTop(view);
    view.setMouth('smile');
    this.active.set(index, view);
    return view;
  }

  private release(index: number, view: LayerView): void {
    this.scene.tweens.killTweensOf(view);
    view.setVisible(false).setActive(false);
    this.active.delete(index);
    this.pool.push(view);
  }

  private drawTray(): void {
    const { thickness, radius, outline, shadowHeight, shadowAlpha } = ANIM.tray;
    const w = BALANCE.tray.width;
    const texW = 2 * Math.ceil((w * TRAY_SHADOW_WIDTH_RATIO) / 2);
    const texH = thickness + shadowHeight;
    const left = (texW - w) / 2;
    bakeTexture(this.scene, TRAY_TEXTURE, texW, texH, (g) => {
      g.fillStyle(KITCHEN_COLORS.trayShadow, shadowAlpha);
      g.fillEllipse(texW / 2, thickness + shadowHeight / 3, texW, shadowHeight);
      g.fillStyle(KITCHEN_COLORS.trayShadow, 1);
      g.fillRoundedRect(left, 0, w, thickness, radius);
      g.fillStyle(KITCHEN_COLORS.tray, 1);
      g.fillRoundedRect(
        left + outline / 2,
        outline / 2,
        w - outline,
        thickness - outline * 1.5,
        radius - outline / 2,
      );
    });
    this.scene.add
      .image(BALANCE.tray.centerX, this.trayTopY, TRAY_TEXTURE)
      .setOrigin(0.5, 0)
      .setDepth(DEPTH.tray);
  }
}
