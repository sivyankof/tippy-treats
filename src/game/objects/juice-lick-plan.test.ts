import { describe, expect, it } from 'vitest';
import { LICK } from '../../data/lick';
import { JuiceQueue, stainTarget, type JuiceCheck } from './juice-lick-plan';

const OK = (): JuiceCheck => 'ok';
const READY = LICK.juice.delayMs;

describe('JuiceQueue', () => {
  it('licks a stain only once it is ripe, about a second after the burst', () => {
    const q = new JuiceQueue();
    q.add(3, 500);
    expect(q.poll(500 + READY - 1, false, true, OK).kind).toBe('none');
    const action = q.poll(500 + READY, false, true, OK);
    expect(action.kind).toBe('lick');
    expect(q.size).toBe(0);
  });

  it('never breaks into a running scene', () => {
    const q = new JuiceQueue();
    q.add(1, 0);
    expect(q.poll(READY + 100, true, true, OK).kind).toBe('none');
    expect(q.poll(READY + 200, false, true, OK).kind).toBe('lick');
  });

  it('serves stains in the order they were made, with a pause after each lick', () => {
    const q = new JuiceQueue();
    q.add(5, 0);
    q.add(2, 100);
    const first = q.poll(READY + 100, false, true, OK);
    expect(first).toMatchObject({ kind: 'lick', stain: { index: 5 } });
    q.done(READY + 500);
    expect(q.poll(READY + 500 + LICK.juice.betweenMs - 1, false, true, OK).kind).toBe('none');
    expect(q.poll(READY + 500 + LICK.juice.betweenMs, false, true, OK)).toMatchObject({
      kind: 'lick',
      stain: { index: 2 },
    });
  });

  it('skips a layer that must wait and licks the next one that can', () => {
    const q = new JuiceQueue();
    q.add(5, 0);
    q.add(2, 0);
    const check = (i: number): JuiceCheck => (i === 5 ? 'wait' : 'ok');
    expect(q.poll(READY, false, true, check)).toMatchObject({ kind: 'lick', stain: { index: 2 } });
    expect(q.size).toBe(1);
  });

  it('melts a stain whose layer left the screen at once, even before it is ripe', () => {
    const q = new JuiceQueue();
    q.add(4, 0);
    expect(q.poll(10, false, true, () => 'gone').kind).toBe('melt');
    expect(q.size).toBe(0);
  });

  it('melts a stain that could not be licked for longer than the timeout', () => {
    const q = new JuiceQueue();
    q.add(4, 0);
    const wait = (): JuiceCheck => 'wait';
    expect(q.poll(READY + LICK.juice.timeoutMs - 1, false, true, wait).kind).toBe('none');
    expect(q.poll(READY + LICK.juice.timeoutMs, false, true, wait).kind).toBe('melt');
  });

  it('melts a ripe stain without the tongue on lite, and not before it is ripe', () => {
    const q = new JuiceQueue();
    q.add(1, 0);
    expect(q.poll(READY - 1, false, false, OK).kind).toBe('none');
    expect(q.poll(READY, false, false, OK).kind).toBe('melt');
  });

  it('melts while a scene is on, so a gone stain does not hang about', () => {
    const q = new JuiceQueue();
    q.add(1, 0);
    expect(q.poll(10, true, true, () => 'gone').kind).toBe('melt');
  });

  it('keeps one stain per layer, and asks again after a broken lick with the old deadline', () => {
    const q = new JuiceQueue();
    q.add(1, 0);
    q.add(1, 50);
    expect(q.size).toBe(1);
    const action = q.poll(READY, false, true, OK);
    if (action.kind !== 'lick') throw new Error('expected a lick');
    q.retry(action.stain, READY + 200);
    expect(q.poll(READY + 200 + LICK.juice.retryMs - 1, false, true, OK).kind).toBe('none');
    expect(q.poll(READY + 200 + LICK.juice.retryMs, false, true, OK).kind).toBe('lick');
    q.retry(action.stain, READY + 5000);
    expect(q.poll(action.stain.expireMs, false, true, OK).kind).toBe('melt');
  });

  it('forgets everything on clear', () => {
    const q = new JuiceQueue();
    q.add(1, 0);
    q.add(2, 0);
    expect(q.clear()).toHaveLength(2);
    expect(q.size).toBe(0);
  });
});

describe('stainTarget', () => {
  it('aims into the stain, in the face pixels of a scaled face', () => {
    const stain = { dx: 100, dy: 40, height: 34, originY: 0.15 };
    const t = stainTarget(stain, 10, 4, 0.5, { x: 0, y: 0 });
    expect(t.x).toBeCloseTo((100 - 10) / 0.5);
    expect(t.y).toBeCloseTo((40 + (LICK.juice.targetShare - 0.15) * 34 - 4) / 0.5);
  });
});
