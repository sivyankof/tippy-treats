import { describe, expect, it } from 'vitest';
import { NO_MUSIC, type MusicControl } from './music-control';
import { MusicProxy } from './music-proxy';

function recorder(): MusicControl & { log: string[] } {
  const log: string[] = [];
  return {
    ...NO_MUSIC,
    log,
    play: (track) => log.push(`play ${track}`),
    stop: () => log.push('stop'),
    hold: (on) => log.push(`hold ${on}`),
  };
}

describe('MusicProxy', () => {
  it('remembers the last track asked before a player exists and plays it on attach', () => {
    const proxy = new MusicProxy();
    proxy.play('menu');
    proxy.play('kitchen');
    const real = recorder();
    proxy.attach(real);
    expect(real.log).toEqual(['play kitchen']);
    expect(proxy.asked).toBe('kitchen');
  });

  it('plays nothing on attach after a stop', () => {
    const proxy = new MusicProxy();
    proxy.play('menu');
    proxy.stop();
    const real = recorder();
    proxy.attach(real);
    expect(real.log).toEqual([]);
    expect(proxy.asked).toBeNull();
  });

  it('a hold asked before the player exists reaches it', () => {
    const proxy = new MusicProxy();
    proxy.hold(true);
    proxy.play('roof');
    const real = recorder();
    proxy.attach(real);
    expect(real.log).toEqual(['hold true', 'play roof']);
  });

  it('the switch off stops the player and keeps the track; on plays it again', () => {
    const proxy = new MusicProxy();
    const real = recorder();
    proxy.attach(real);
    proxy.play('stars');
    proxy.setEnabled(false);
    proxy.play('space');
    proxy.setEnabled(true);
    expect(real.log).toEqual(['play stars', 'stop', 'play space']);
  });

  it('a failing player never throws into the game', () => {
    const proxy = new MusicProxy();
    const broken: MusicControl = {
      ...NO_MUSIC,
      play: () => {
        throw new Error('boom');
      },
      state: () => {
        throw new Error('boom');
      },
    };
    proxy.attach(broken);
    expect(() => proxy.play('menu')).not.toThrow();
    expect(proxy.state().track).toBeNull();
  });
});
