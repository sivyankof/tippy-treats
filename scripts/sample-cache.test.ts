import { describe, expect, it } from 'vitest';
import { readSampleCache, sampleCacheText } from './sample-cache';

const SETS = ['mastery.caramel.goldenCoinMult=50'];
const SAMPLES = { 'strong:none': [1, 2, 3] };

describe('sample cache', () => {
  it('is empty when there is no file yet', () => {
    expect(readSampleCache(null, 30, SETS, 'x.json')).toEqual({});
  });
  it('gives back the samples played with the same runs and what-if values', () => {
    const text = sampleCacheText(30, SETS, SAMPLES);
    expect(readSampleCache(text, 30, SETS, 'x.json')).toEqual(SAMPLES);
  });
  it('refuses samples played without the what-if values', () => {
    const text = sampleCacheText(30, [], SAMPLES);
    expect(() => readSampleCache(text, 30, SETS, 'x.json')).toThrow(/--set=mastery\.caramel/);
  });
  it('refuses samples played with other what-if values or another run count', () => {
    const text = sampleCacheText(30, SETS, SAMPLES);
    expect(() => readSampleCache(text, 30, [], 'x.json')).toThrow(/x\.json/);
    expect(() =>
      readSampleCache(text, 30, ['mastery.caramel.goldenCoinMult=40'], 'x.json'),
    ).toThrow();
    expect(() => readSampleCache(text, 1000, SETS, 'x.json')).toThrow(/--runs=30/);
  });
  it('refuses a cache of the older format, which kept no runs and values', () => {
    expect(() => readSampleCache(JSON.stringify(SAMPLES), 30, [], 'x.json')).toThrow(/x\.json/);
  });
});
