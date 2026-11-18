import { describe, expect, it } from 'vitest';
import { NodeTally } from '../node-tally';
import { FileLoop, musicFileUrl } from './file-loop';

class FakeSource {
  buffer: unknown = null;
  loop = false;
  onended: ((event: Event) => void) | null = null;
  startAt = -1;
  stopAt = -1;
  connected: unknown = null;
  connect(node: unknown): void {
    this.connected = node;
  }
  disconnect(): void {
    this.connected = null;
  }
  start(at = 0): void {
    this.startAt = at;
  }
  stop(at = 0): void {
    this.stopAt = at;
  }
}

function setup() {
  const sources: FakeSource[] = [];
  const ctx = {
    currentTime: 2,
    createBufferSource: () => {
      const source = new FakeSource();
      sources.push(source);
      return source;
    },
  };
  const loads: string[] = [];
  const buffer = { duration: 30 };
  const load = (url: string) => {
    loads.push(url);
    return url.includes('broken')
      ? Promise.reject(new Error('404'))
      : Promise.resolve(buffer as unknown as AudioBuffer);
  };
  const tally = new NodeTally();
  const files = new FileLoop(ctx as unknown as BaseAudioContext, tally, load);
  return { ctx, sources, loads, files, tally, buffer };
}

describe('musicFileUrl', () => {
  it('maps a file name in assets/music to its URL, nothing for a missing one', () => {
    const files = { '../../../../assets/music/calm.mp3': '/assets/calm-123.mp3' };
    expect(musicFileUrl('calm.mp3', files)).toBe('/assets/calm-123.mp3');
    expect(musicFileUrl('other.mp3', files)).toBeNull();
    expect(musicFileUrl(undefined, files)).toBeNull();
  });
});

describe('FileLoop', () => {
  const out = { name: 'fader' } as unknown as AudioNode;

  it('loops the decoded file through one source into the fader, from the asked time', async () => {
    const { sources, files, tally, buffer } = setup();
    await files.play('/a.mp3', out, 5);
    expect(sources).toHaveLength(1);
    const [source] = sources;
    expect(source?.loop).toBe(true);
    expect(source?.buffer).toBe(buffer);
    expect(source?.connected).toBe(out);
    expect(source?.startAt).toBe(5);
    expect(files.playing).toBe(true);
    expect(tally.live).toBe(1);
    files.stop(7);
    expect(source?.stopAt).toBe(7);
    source?.onended?.(new Event('ended'));
    expect(tally.live).toBe(0);
  });

  it('decodes a file once, and a stop before the load ends cancels the start', async () => {
    const { sources, loads, files } = setup();
    const pending = files.play('/a.mp3', out, 0);
    files.stop(0);
    await pending;
    expect(sources).toHaveLength(0);
    await files.play('/a.mp3', out, 0);
    expect(loads).toEqual(['/a.mp3']);
    expect(sources).toHaveLength(1);
  });

  it('a broken file leaves the music silent and does not throw', async () => {
    const { sources, files } = setup();
    await expect(files.play('/broken.mp3', out, 0)).resolves.toBeUndefined();
    expect(sources).toHaveLength(0);
    expect(files.playing).toBe(false);
  });
});
