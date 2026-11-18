import { describe, expect, it } from 'vitest';
import type { MusicControl, MusicStartOptions } from './music-control';
import { MusicProxy } from './music-proxy';

function recorder(): MusicControl & { log: string[] } {
  const log: string[] = [];
  return {
    log,
    start: (o: MusicStartOptions) => log.push(`start ${o.variant} ${o.layer} ${o.menu ?? '-'}`),
    stop: () => log.push('stop'),
    setLayer: (n) => log.push(`layer ${n}`),
    setMenu: (on) => log.push(`menu ${on}`),
    setMix: (mix) => log.push(`mix ${JSON.stringify(mix)}`),
  };
}

describe('MusicProxy', () => {
  it('remembers calls made before a player exists and replays them on attach', () => {
    const proxy = new MusicProxy();
    proxy.start({ variant: 'b', layer: 1 });
    proxy.setLayer(3);
    proxy.setMenu(true);
    const real = recorder();
    proxy.attach(real);
    expect(real.log).toEqual(['start b 3 true']);
  });

  it('forwards calls to the attached player', () => {
    const proxy = new MusicProxy();
    const real = recorder();
    proxy.attach(real);
    proxy.start({ variant: 'a', layer: 1 });
    proxy.setLayer(2);
    proxy.setMenu(false);
    proxy.stop();
    expect(real.log).toEqual(['start a 1 -', 'layer 2', 'menu false', 'stop']);
  });

  it('stops while the music is off and restarts with the remembered state when it is on', () => {
    const proxy = new MusicProxy();
    const real = recorder();
    proxy.attach(real);
    proxy.start({ variant: 'c', layer: 2 });
    proxy.setEnabled(false);
    proxy.setLayer(4);
    expect(real.log).toEqual(['start c 2 -', 'stop']);
    proxy.setEnabled(true);
    expect(real.log.at(-1)).toBe('start c 4 -');
  });

  it('remembers the mix before a player exists and passes it on, also while the music is off', () => {
    const proxy = new MusicProxy();
    proxy.setMix({ reverb: false });
    proxy.setMix({ drums: 0.5 });
    const real = recorder();
    proxy.attach(real);
    expect(real.log).toEqual(['mix {"reverb":false,"drums":0.5}']);
    proxy.setEnabled(false);
    proxy.setMix({ tape: 0 });
    expect(real.log.at(-1)).toBe('mix {"tape":0}');
  });

  it('does not restart a tune that was stopped', () => {
    const proxy = new MusicProxy();
    const real = recorder();
    proxy.attach(real);
    proxy.start({ variant: 'a', layer: 1 });
    proxy.stop();
    proxy.setEnabled(false);
    proxy.setEnabled(true);
    expect(real.log.filter((l) => l.startsWith('start'))).toHaveLength(1);
  });

  it('swallows errors of the player', () => {
    const proxy = new MusicProxy();
    proxy.attach({
      start: () => {
        throw new Error('boom');
      },
      stop: () => undefined,
      setLayer: () => undefined,
      setMenu: () => undefined,
      setMix: () => {
        throw new Error('boom');
      },
    });
    expect(() => proxy.setMix({ reverb: false })).not.toThrow();
    expect(() => proxy.start({ variant: 'a', layer: 1 })).not.toThrow();
  });
});
