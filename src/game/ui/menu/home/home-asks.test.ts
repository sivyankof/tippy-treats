import { describe, expect, it, vi } from 'vitest';
import type * as Phaser from 'phaser';
import { runHomeAsks, type HomeAsk } from './home-asks';

// The real questions open Phaser windows; the runner is tested with its own list.
vi.mock('./notif-ask', () => ({
  notifAsk: { name: 'notifications', due: () => false, run: vi.fn() },
}));

const scene = {} as Phaser.Scene;

function ask(name: string, due: boolean, log: string[]): HomeAsk {
  return {
    name,
    due: () => due,
    run: (_scene, done) => {
      log.push(name);
      done();
      done();
    },
  };
}

describe('runHomeAsks', () => {
  it('goes on at once when nothing is due', () => {
    const then = vi.fn();
    runHomeAsks(scene, then, []);
    expect(then).toHaveBeenCalledOnce();
  });

  it('asks only the first due question, then goes on once', () => {
    const log: string[] = [];
    const then = vi.fn();
    runHomeAsks(scene, then, [ask('a', false, log), ask('b', true, log), ask('c', true, log)]);
    expect(log).toEqual(['b']);
    expect(then).toHaveBeenCalledOnce();
  });
});
