import { describe, expect, it } from 'vitest';
import { SFX } from '../../data/sfx';
import { WebAudioService } from './web';

/** The only parts of the audio graph the synth touches; everything else is not needed. */
interface FakeParam {
  value: number;
  setValueAtTime(): void;
  linearRampToValueAtTime(): void;
  exponentialRampToValueAtTime(): void;
}

class FakeNode {
  onended: (() => void) | null = null;
  type = '';
  buffer: unknown = null;
  disconnected = false;
  readonly gain = fakeParam();
  readonly frequency = fakeParam();
  readonly Q = fakeParam();
  readonly threshold = fakeParam();
  readonly knee = fakeParam();
  readonly ratio = fakeParam();
  readonly attack = fakeParam();
  readonly release = fakeParam();
  connect(): void {}
  disconnect(): void {
    this.disconnected = true;
  }
  start(): void {}
  stop(): void {}
}

function fakeParam(): FakeParam {
  return {
    value: 0,
    setValueAtTime() {},
    linearRampToValueAtTime() {},
    exponentialRampToValueAtTime() {},
  };
}

class FakeContext {
  currentTime = 0;
  sampleRate = 8000;
  destination = new FakeNode();
  oscillators: FakeNode[] = [];
  nodes = 0;
  resumes = 0;
  suspends = 0;
  private node(): FakeNode {
    this.nodes++;
    return new FakeNode();
  }
  createGain = () => this.node();
  createDynamicsCompressor = () => this.node();
  createBiquadFilter = () => this.node();
  createBufferSource = () => this.node();
  createOscillator = () => {
    const osc = this.node();
    this.oscillators.push(osc);
    return osc;
  };
  createBuffer = (_channels: number, length: number) => ({
    getChannelData: () => new Float32Array(length),
  });
  resume = () => {
    this.resumes++;
    return Promise.resolve();
  };
  suspend = () => {
    this.suspends++;
    return Promise.reject(new Error('closed'));
  };
}

function setup() {
  const ctx = new FakeContext();
  let created = 0;
  const service = new WebAudioService(() => {
    created++;
    // The fake implements just the members the synth uses.
    return ctx as unknown as AudioContext;
  });
  return { ctx, service, created: () => created };
}

describe('WebAudioService', () => {
  it('is a silent no-op without Web Audio', () => {
    const service = new WebAudioService(() => null);
    service.unlock();
    expect(() => {
      service.drop();
      service.perfect(3);
      service.collapseThud(0);
      service.suspend('app');
      service.resume('app');
    }).not.toThrow();
  });

  it('survives a throwing context factory', () => {
    const service = new WebAudioService(() => {
      throw new Error('blocked');
    });
    expect(() => {
      service.unlock();
      service.click();
    }).not.toThrow();
  });

  it('drops sounds requested before unlock', () => {
    const { ctx, service } = setup();
    service.drop();
    expect(ctx.oscillators).toHaveLength(0);
  });

  it('plays nothing while disabled and again once enabled', () => {
    const { ctx, service } = setup();
    service.unlock();
    service.setEnabled(false);
    expect(service.enabled).toBe(false);
    service.drop();
    service.coin();
    expect(ctx.oscillators).toHaveLength(0);
    service.setEnabled(true);
    service.drop();
    expect(ctx.oscillators.length).toBeGreaterThan(0);
  });

  it('creates the context once and resumes it on each unlock', () => {
    const { ctx, service, created } = setup();
    service.unlock();
    service.unlock();
    expect(created()).toBe(1);
    expect(ctx.resumes).toBe(2);
  });

  it('forwards suspend and resume, ignoring rejections, and is silent while hidden', async () => {
    const { ctx, service } = setup();
    service.unlock();
    service.suspend('app');
    expect(ctx.suspends).toBe(1);
    service.click();
    expect(ctx.oscillators).toHaveLength(0);
    service.resume('app');
    expect(ctx.resumes).toBe(2);
    service.click();
    expect(ctx.oscillators).toHaveLength(1);
    await Promise.resolve();
  });

  it('stays silent until every suspend reason is lifted', () => {
    const { ctx, service } = setup();
    service.unlock();
    service.suspend('ad');
    service.suspend('app');
    service.resume('app');
    expect(ctx.resumes).toBe(1);
    service.click();
    expect(ctx.oscillators).toHaveLength(0);
    service.resume('ad');
    expect(ctx.resumes).toBe(2);
    service.click();
    expect(ctx.oscillators).toHaveLength(1);
  });

  it('does not resume on unlock while a reason holds', () => {
    const { ctx, service } = setup();
    service.suspend('ad');
    service.unlock();
    expect(ctx.resumes).toBe(0);
  });

  it('throttles the collapse series', () => {
    const { ctx, service } = setup();
    service.unlock();
    for (let i = 0; i < 100; i++) service.collapseThud(i);
    expect(ctx.oscillators).toHaveLength(1);
    ctx.currentTime += SFX.collapse.minIntervalSec + 0.001;
    service.collapseThud(101);
    expect(ctx.oscillators).toHaveLength(2);
  });

  it('plays a perfect bell with several partials and a five-note record fanfare', () => {
    const { ctx, service } = setup();
    service.unlock();
    service.perfect(1);
    expect(ctx.oscillators).toHaveLength(SFX.perfect.partials.length);
    ctx.oscillators.length = 0;
    service.record();
    expect(ctx.oscillators).toHaveLength(5);
  });

  it('plays the record blip as two short notes', () => {
    const { ctx, service } = setup();
    service.unlock();
    service.recordBlip();
    expect(ctx.oscillators).toHaveLength(SFX.recordBlip.notes.length);
  });

  it('plays the lick as two notes over a hiss', () => {
    const { ctx, service } = setup();
    service.unlock();
    service.lick();
    expect(ctx.oscillators).toHaveLength(2);
  });

  it('disconnects nodes when a sound ends', () => {
    const { ctx, service } = setup();
    service.unlock();
    service.click();
    const osc = ctx.oscillators[0];
    osc?.onended?.();
    expect(osc?.disconnected).toBe(true);
  });
});
