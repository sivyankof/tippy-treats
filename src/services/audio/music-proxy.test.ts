import { describe, expect, it } from 'vitest';
import { NO_MUSIC, type MusicControl } from './music-control';
import { MusicProxy } from './music-proxy';

function recorder(): MusicControl & { log: string[] } {
  const log: string[] = [];
  return {
    ...NO_MUSIC,
    log,
    playlist: () => log.push('playlist'),
    play: (track) => log.push(`play ${track}`),
    next: () => log.push('next'),
    stop: () => log.push('stop'),
    hold: (reason, on) => log.push(`hold ${reason} ${on}`),
  };
}

describe('MusicProxy', () => {
  it('remembers the last track asked before a player exists and plays it on attach', () => {
    const proxy = new MusicProxy();
    proxy.play('daily');
    proxy.playlist();
    const real = recorder();
    proxy.attach(real);
    expect(real.log).toEqual(['playlist']);
    expect(proxy.asked()).toEqual({ kind: 'playlist' });
    const other = new MusicProxy();
    other.playlist();
    other.play('record');
    const real2 = recorder();
    other.attach(real2);
    expect(real2.log).toEqual(['play record']);
  });

  it('plays nothing on attach after a stop', () => {
    const proxy = new MusicProxy();
    proxy.playlist();
    proxy.stop();
    const real = recorder();
    proxy.attach(real);
    expect(real.log).toEqual([]);
    expect(proxy.asked()).toBeNull();
  });

  it('a hold asked before the player exists reaches it', () => {
    const proxy = new MusicProxy();
    proxy.hold('app', true);
    proxy.playlist();
    const real = recorder();
    proxy.attach(real);
    expect(real.log).toEqual(['hold app true', 'playlist']);
  });

  it('the switch off stops the player and keeps the track; on plays it again', () => {
    const proxy = new MusicProxy();
    const real = recorder();
    proxy.attach(real);
    proxy.playlist();
    proxy.setEnabled(false);
    proxy.play('daily');
    proxy.setEnabled(true);
    expect(real.log).toEqual(['playlist', 'stop', 'play daily']);
  });

  it('a failing player never throws into the game', () => {
    const proxy = new MusicProxy();
    const broken: MusicControl = {
      ...NO_MUSIC,
      play: () => {
        throw new Error('boom');
      },
      playlist: () => {
        throw new Error('boom');
      },
      state: () => {
        throw new Error('boom');
      },
    };
    proxy.attach(broken);
    expect(() => proxy.play('menu')).not.toThrow();
    expect(() => proxy.playlist()).not.toThrow();
    expect(proxy.state().track).toBeNull();
  });

  it('a new player in place of the old one goes on from its turn; the old one is let go', () => {
    const proxy = new MusicProxy();
    proxy.playlist();
    const old = { ...recorder(), position: () => ({ index: 3, turnSec: 40 }) };
    old.dispose = () => old.log.push('dispose');
    proxy.attach(old);
    const next = recorder();
    next.resumeAt = (at) => next.log.push(`resume ${at.index} ${at.turnSec}`);
    proxy.replace(next);
    expect(old.log).toEqual(['playlist', 'dispose']);
    expect(next.log).toEqual(['resume 3 40', 'playlist']);
  });

  it('the watchdog restart reaches the player only while the playlist is asked and the music is on', () => {
    const proxy = new MusicProxy();
    const real = recorder();
    real.restart = () => real.log.push('restart');
    proxy.attach(real);
    proxy.restart();
    proxy.play('daily');
    proxy.restart();
    proxy.playlist();
    proxy.setEnabled(false);
    proxy.restart();
    proxy.setEnabled(true);
    proxy.restart();
    expect(real.log.filter((l) => l === 'restart')).toHaveLength(1);
  });
});
