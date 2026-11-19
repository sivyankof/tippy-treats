import { describe, expect, it } from 'vitest';
import { countDisplayObjects, countTextureCanvases, musicSoak } from './soak-metrics';

describe('countDisplayObjects', () => {
  it('counts a flat list', () => {
    expect(countDisplayObjects([{}, {}, {}])).toBe(3);
  });

  it('counts the children of containers at any depth, and the containers themselves', () => {
    const inner = { list: [{}, {}] };
    const outer = { list: [inner, {}] };
    expect(countDisplayObjects([outer, {}])).toBe(6);
  });

  it('counts nothing for an empty list', () => {
    expect(countDisplayObjects([])).toBe(0);
  });
});

describe('countTextureCanvases', () => {
  const canvas = { getContext: () => null };

  it('counts the sources backed by a canvas, in every texture', () => {
    const textures = [
      { source: [{ source: canvas }] },
      { source: [{ source: {} }, { source: canvas }, { source: canvas }] },
      { source: [] },
      {},
    ];
    expect(countTextureCanvases(textures)).toBe(3);
  });

  it('counts nothing without textures', () => {
    expect(countTextureCanvases([])).toBe(0);
  });
});

describe('musicSoak', () => {
  it('reports the music nodes, decoded bytes and buffers', () => {
    expect(musicSoak({ musicNodes: 7 }, { decodedBytes: 1234, buffers: 2 })).toEqual({
      musicNodes: 7,
      musicDecodedBytes: 1234,
      musicBuffers: 2,
    });
  });

  it('reports zero memory when no music state is there', () => {
    expect(musicSoak({ musicNodes: 0 }, null)).toEqual({
      musicNodes: 0,
      musicDecodedBytes: 0,
      musicBuffers: 0,
    });
  });
});
