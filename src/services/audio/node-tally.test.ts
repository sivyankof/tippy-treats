import { describe, expect, it } from 'vitest';
import { NodeTally, runSource, stopQuietly, type TimedSource } from './node-tally';

interface FakeSource extends TimedSource {
  started: number | undefined;
  stopped: number | undefined;
}

function fakeSource(): FakeSource {
  const src = {
    onended: null as ((e: Event) => void) | null,
    started: undefined as number | undefined,
    stopped: undefined as number | undefined,
    disconnect() {},
    start(when?: number) {
      src.started = when;
    },
    stop(when?: number) {
      src.stopped = when;
    },
  };
  return src as unknown as FakeSource;
}

describe('NodeTally', () => {
  it('counts live nodes as created minus released', () => {
    const tally = new NodeTally();
    tally.add([1, 2, 3]);
    tally.release([1]);
    expect(tally.live).toBe(2);
    expect(tally.createdTotal).toBe(3);
  });
});

describe('runSource', () => {
  it('schedules the source and releases its nodes when it ends', () => {
    const tally = new NodeTally();
    const source = fakeSource();
    let disconnected = 0;
    const other = { disconnect: () => disconnected++ } as unknown as AudioNode;
    runSource(tally, source, [source, other], 1, 2);
    expect(source.started).toBe(1);
    expect(source.stopped).toBe(2);
    expect(tally.live).toBe(2);
    source.onended?.(new Event('ended'));
    expect(tally.live).toBe(0);
    expect(disconnected).toBe(1);
  });

  it('releases once when the source fires ended twice', () => {
    const tally = new NodeTally();
    const source = fakeSource();
    runSource(tally, source, [source], 0, 1);
    source.onended?.(new Event('ended'));
    source.onended?.(new Event('ended'));
    expect(tally.live).toBe(0);
  });
});

describe('stopQuietly', () => {
  it('stops a source at the time and swallows the error of one that already stopped', () => {
    const src = fakeSource();
    stopQuietly(src, 2);
    expect(src.stopped).toBe(2);
    const broken = {
      stop() {
        throw new Error('InvalidStateError');
      },
    };
    expect(() => stopQuietly(broken, 1)).not.toThrow();
  });
});
