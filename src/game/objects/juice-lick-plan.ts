import { LICK } from '../../data/lick';

/**
 * Plan of the juice licks (docs/06, "Слизывание глазури", "Сок"): a berry burst leaves a stain on
 * the lower layer and about a second later that layer licks it off. Pure rules, no Phaser: the
 * queue of stains waiting for their lick and the point the tongue aims at. Times are ms on the
 * clock of the lick director, layers are 0-based view indices.
 */

/** A stain waiting to be licked. */
export interface JuiceStain {
  /** 0-based index of the layer that carries the stain. */
  index: number;
  /** The stain may be licked from this moment on. */
  readyMs: number;
  /** A stain still waiting at this moment melts. */
  expireMs: number;
}

/** What the layer of a stain can do right now: lick, wait for a better moment, or it is gone (left the screen). */
export type JuiceCheck = 'ok' | 'wait' | 'gone';

/** What the queue asks the director to do. */
export type JuiceAction =
  { kind: 'none' } | { kind: 'lick'; stain: JuiceStain } | { kind: 'melt'; stain: JuiceStain };

const NONE: JuiceAction = { kind: 'none' };

/**
 * The stains of the run in the order they were made. One action per `poll`: a stain whose layer
 * is gone, whose time ran out or (on lite) whose second is up melts; otherwise the first stain
 * that is ripe and whose layer can lick is licked, but only when no scene is on and the pause
 * after the last juice lick is over.
 */
export class JuiceQueue {
  private readonly stains: JuiceStain[] = [];
  private blockedUntilMs = 0;

  get size(): number {
    return this.stains.length;
  }

  /** A stain of layer `index` was made at `nowMs`; a layer carries one stain, a second is ignored. */
  add(index: number, nowMs: number): void {
    if (this.stains.some((s) => s.index === index)) return;
    const readyMs = nowMs + LICK.juice.delayMs;
    this.stains.push({ index, readyMs, expireMs: readyMs + LICK.juice.timeoutMs });
  }

  /**
   * The next thing to do. `busy`: a scene is on; `tongue`: the level lets the tongue out (false on
   * lite: the stain melts at its second); `check` tells what a layer can do.
   */
  poll(
    nowMs: number,
    busy: boolean,
    tongue: boolean,
    check: (index: number) => JuiceCheck,
  ): JuiceAction {
    for (const stain of this.stains) {
      const ripe = nowMs >= stain.readyMs;
      const verdict = check(stain.index);
      if (verdict === 'gone' || nowMs >= stain.expireMs || (ripe && !tongue)) {
        this.remove(stain);
        return { kind: 'melt', stain };
      }
    }
    if (busy || !tongue || nowMs < this.blockedUntilMs) return NONE;
    for (const stain of this.stains) {
      if (nowMs < stain.readyMs || check(stain.index) !== 'ok') continue;
      this.remove(stain);
      return { kind: 'lick', stain };
    }
    return NONE;
  }

  /** A lick that was started broke off before it took the stain: it asks again soon, with its old deadline. */
  retry(stain: JuiceStain, nowMs: number): void {
    this.stains.unshift({ ...stain, readyMs: nowMs + LICK.juice.retryMs });
  }

  /** A juice lick is over: the next one waits `betweenMs`. */
  done(nowMs: number): void {
    this.blockedUntilMs = nowMs + LICK.juice.betweenMs;
  }

  /** Forgets every stain (the level went minimal, the run is over); returns them. */
  clear(): JuiceStain[] {
    return this.stains.splice(0);
  }

  private remove(stain: JuiceStain): void {
    const at = this.stains.indexOf(stain);
    if (at >= 0) this.stains.splice(at, 1);
  }
}

/** The look of a stain picture as the aim needs it: anchor offset from the layer's centre, size and anchor share. */
export interface StainPicture {
  dx: number;
  dy: number;
  height: number;
  originY: number;
}

/** Where the tongue aims for a stain, in the face's own pixels (the face sits at (`faceX`, `faceY`) on the layer and is scaled `faceScale`). */
export function stainTarget(
  stain: Readonly<StainPicture>,
  faceX: number,
  faceY: number,
  faceScale: number,
  out: { x: number; y: number },
): { x: number; y: number } {
  const scale = faceScale || 1;
  out.x = (stain.dx - faceX) / scale;
  out.y = (stain.dy + (LICK.juice.targetShare - stain.originY) * stain.height - faceY) / scale;
  return out;
}
