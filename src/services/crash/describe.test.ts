import { describe, expect, it } from 'vitest';
import { describeError, parseStack } from './describe';

describe('parseStack', () => {
  it('reads the V8 format and keeps the file name only', () => {
    const stack = [
      'Error: boom',
      '    at drawTower (capacitor://localhost/assets/index-ab12.js:10:5)',
      '    at capacitor://localhost/assets/index-ab12.js:20:7',
    ].join('\n');
    expect(parseStack(stack)).toEqual([
      { functionName: 'drawTower', fileName: 'index-ab12.js', lineNumber: 10 },
      { functionName: '<anonymous>', fileName: 'index-ab12.js', lineNumber: 20 },
    ]);
  });

  it('reads the JavaScriptCore format', () => {
    const stack = 'drawTower@capacitor://localhost/assets/index-ab12.js:10:5\n@file:///x/y.js:3:1';
    expect(parseStack(stack)).toEqual([
      { functionName: 'drawTower', fileName: 'index-ab12.js', lineNumber: 10 },
      { functionName: '<anonymous>', fileName: 'y.js', lineNumber: 3 },
    ]);
  });

  it('returns nothing for an empty stack and caps the length', () => {
    expect(parseStack(undefined)).toEqual([]);
    const long = Array.from({ length: 40 }, (_, i) => `    at f${i} (a.js:${i + 1}:1)`).join('\n');
    expect(parseStack(long)).toHaveLength(12);
  });
});

describe('describeError', () => {
  it('describes an Error with its name and frames', () => {
    const error = new TypeError('bad');
    const described = describeError(error);
    expect(described.message).toBe('TypeError: bad');
  });

  it('describes strings and objects that were thrown', () => {
    expect(describeError('plain').message).toBe('plain');
    expect(describeError({ code: 5 }).message).toBe('{"code":5}');
    expect(describeError(undefined).message).toBe('undefined');
  });

  it('cuts a long message', () => {
    expect(describeError('x'.repeat(1000)).message).toHaveLength(300);
  });
});
