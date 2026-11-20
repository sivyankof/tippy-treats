import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CONTEXT_HEALTH } from '../../data/audio/context-health';
import { NO_MUSIC, type MusicFactory } from './music-control';
import { FakeContext } from './fake-context';
import { WebAudioService } from './web';

const DEVICE_ERROR = 'Failed to start the audio device';

/**
 * A context whose clock goes while it runs and its audio device works. `brokenDevice`: after a
 * refused resume, as on the owner's iPhone, a later resume says `running` yet the clock stands.
 */
class DeviceContext extends FakeContext {
  deviceDead = false;
  /** The app is not active yet: resume is refused. */
  refuseResume = false;
  constructor(private readonly brokenDevice: boolean) {
    super();
    this.state = 'running';
  }
  override resume = (): Promise<void> => {
    this.resumes++;
    if (this.refuseResume) {
      if (this.brokenDevice) this.deviceDead = true;
      return Promise.reject(new DOMException(DEVICE_ERROR, 'InvalidStateError'));
    }
    this.state = 'running';
    return Promise.resolve();
  };
  override suspend = (): Promise<void> => {
    this.suspends++;
    this.state = 'suspended';
    return Promise.resolve();
  };
  /** The clock moves only while running on a live device. */
  tick(ms: number): void {
    if (this.state === 'running' && !this.deviceDead) this.currentTime += ms / 1000;
  }
}

function setup(brokenDevice: boolean) {
  const contexts: DeviceContext[] = [];
  const players: string[] = [];
  let made = 0;
  const factory: MusicFactory = () => {
    const id = ++made;
    return {
      ...NO_MUSIC,
      position: () => ({ index: 5, turnSec: 42 }),
      resumeAt: (at) => players.push(`${id} resume ${at.index} ${at.turnSec}`),
      dispose: () => players.push(`${id} dispose`),
    };
  };
  const service = new WebAudioService(
    () => {
      // Only the first context has the broken device; a new one starts on a working one.
      const ctx = new DeviceContext(brokenDevice && contexts.length === 0);
      contexts.push(ctx);
      return ctx as unknown as AudioContext;
    },
    Math.random,
    factory,
    () => undefined,
    true,
  );
  /** Moves the clocks of all live contexts and the timers on together. */
  const run = (ms: number): void => {
    for (let t = 0; t < ms; t += 50) {
      for (const ctx of contexts) ctx.tick(50);
      vi.advanceTimersByTime(50);
    }
  };
  const settle = async (): Promise<void> => {
    await vi.advanceTimersByTimeAsync(0);
  };
  return { service, contexts, players, run, settle, live: () => contexts.at(-1) };
}

describe('the sound after a return from the background (owner log, build 0.1.0 (2))', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('a refused resume, then running with a standing clock: the context is made again within 3 s', async () => {
    const t = setup(true);
    t.service.music.playlist();
    t.service.unlock();
    t.run(1000);
    const first = t.contexts[0];
    if (!first) throw new Error('no context');
    // 74.97 app inactive -> suspend app.
    t.service.suspend('app');
    await t.settle();
    t.run(3000);
    // 81.93 back: the device is not up yet, resume is refused ("Failed to start the audio device").
    first.refuseResume = true;
    t.service.resume('app');
    await t.settle();
    // 0.3 s later the app is active: resume is taken, the state says running, the clock stands.
    t.run(300);
    first.refuseResume = false;
    t.run(2700);
    await t.settle();
    t.run(400);
    expect(t.contexts).toHaveLength(2);
    expect(first.closes).toBe(1);
    expect(t.service.status()).toMatchObject({ resumeRejects: 1, remakes: 1 });
    // The old player went first, the new one took the playlist's place over.
    expect(t.players).toEqual(['1 dispose', '2 resume 5 42']);
    // The new context runs and its clock goes: the check sees it alive.
    const now = t.live();
    expect(now?.state).toBe('running');
    const before = now?.currentTime ?? 0;
    t.run(500);
    expect((now?.currentTime ?? 0) - before).toBeGreaterThan(0.4);
    expect(t.service.status().clockRunning).toBe(true);
  });

  it('the remake comes no later than 3 s after the return', async () => {
    const t = setup(true);
    t.service.unlock();
    t.run(1000);
    const first = t.contexts[0];
    if (!first) throw new Error('no context');
    t.service.suspend('app');
    await t.settle();
    first.refuseResume = true;
    t.service.resume('app');
    await t.settle();
    first.refuseResume = false;
    let remadeAt: number | null = null;
    for (let ms = 0; ms <= 3000 && remadeAt === null; ms += 50) {
      t.run(50);
      await t.settle();
      if (t.contexts.length > 1) remadeAt = ms;
    }
    expect(remadeAt).not.toBeNull();
    expect(remadeAt ?? Infinity).toBeLessThanOrEqual(3000);
  });

  it('a healthy return is left alone: the clock goes, nothing is made again', async () => {
    const t = setup(false);
    t.service.unlock();
    t.run(1000);
    t.service.suspend('app');
    await t.settle();
    t.run(2000);
    t.service.resume('app');
    await t.settle();
    t.run(3000);
    await t.settle();
    expect(t.contexts).toHaveLength(1);
    expect(t.service.status()).toMatchObject({ remakes: 0, clockRunning: true });
  });

  it('a context back in the background stays as it is until the app returns', async () => {
    const t = setup(true);
    t.service.unlock();
    t.run(1000);
    const first = t.contexts[0];
    if (!first) throw new Error('no context');
    first.refuseResume = true;
    t.service.resume('app');
    await t.settle();
    t.service.suspend('app');
    t.run(10_000);
    await t.settle();
    expect(t.contexts).toHaveLength(1);
  });

  it('the automatic remakes stop after a few', async () => {
    const contexts: DeviceContext[] = [];
    const service = new WebAudioService(
      () => {
        // Every context made here stands for good.
        const ctx = new DeviceContext(false);
        ctx.deviceDead = true;
        contexts.push(ctx);
        return ctx as unknown as AudioContext;
      },
      Math.random,
      undefined,
      () => undefined,
      true,
    );
    service.unlock();
    for (let i = 0; i < 20; i++) {
      vi.advanceTimersByTime(3000);
      await vi.advanceTimersByTimeAsync(0);
    }
    expect(contexts).toHaveLength(1 + CONTEXT_HEALTH.maxRemakes);
  });

  it('switching the sounds or the music off and on makes the whole context again', () => {
    const t = setup(false);
    t.service.unlock();
    t.service.setEnabled(false);
    t.service.setEnabled(true);
    expect(t.contexts).toHaveLength(2);
    t.service.setMusicEnabled(false);
    t.service.setMusicEnabled(true);
    expect(t.contexts).toHaveLength(3);
    expect(t.service.status().remakes).toBe(2);
  });

  it('in a browser the remake waits for the next tap', async () => {
    const contexts: DeviceContext[] = [];
    const service = new WebAudioService(() => {
      const ctx = new DeviceContext(false);
      ctx.deviceDead = contexts.length === 0;
      contexts.push(ctx);
      return ctx as unknown as AudioContext;
    });
    service.unlock();
    vi.advanceTimersByTime(5000);
    await vi.advanceTimersByTimeAsync(0);
    expect(contexts).toHaveLength(1);
    service.unlock();
    expect(contexts).toHaveLength(2);
  });
});
