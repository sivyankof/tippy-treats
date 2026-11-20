import { describe, expect, it } from 'vitest';
import { checkEvent, checkProperty } from './validate';

describe('checkEvent', () => {
  it('passes a good event unchanged', () => {
    expect(checkEvent('run_start', { mode: 'classic', run_index: 3 })).toEqual({
      name: 'run_start',
      params: { mode: 'classic', run_index: 3 },
      problems: [],
    });
  });

  it('drops an event whose name is not snake_case, too long or reserved', () => {
    expect(checkEvent('RunStart').name).toBeNull();
    expect(checkEvent('run-start').name).toBeNull();
    expect(checkEvent('a'.repeat(41)).name).toBeNull();
    expect(checkEvent('a'.repeat(40)).name).toBe('a'.repeat(40));
    expect(checkEvent('firebase_thing').name).toBeNull();
    expect(checkEvent('google_thing').name).toBeNull();
  });

  it('drops a parameter with a bad name and keeps the others', () => {
    const checked = checkEvent('x', { good_one: 1, 'Bad Name': 2 });
    expect(checked.params).toEqual({ good_one: 1 });
    expect(checked.problems).toHaveLength(1);
  });

  it('turns booleans into 1 and 0 and drops numbers that are not finite', () => {
    const checked = checkEvent('x', { yes: true, no: false, nan: Number.NaN, inf: Infinity });
    expect(checked.params).toEqual({ yes: 1, no: 0 });
    expect(checked.problems).toHaveLength(2);
  });

  it('cuts a long text value', () => {
    const checked = checkEvent('x', { text: 'a'.repeat(150) });
    expect(String(checked.params.text)).toHaveLength(100);
    expect(checked.problems).toHaveLength(1);
  });

  it('keeps at most 25 parameters', () => {
    const many: Record<string, number> = {};
    for (let i = 0; i < 30; i++) many[`p${i}`] = i;
    const checked = checkEvent('x', many);
    expect(Object.keys(checked.params)).toHaveLength(25);
    expect(checked.problems).toHaveLength(1);
  });
});

describe('checkProperty', () => {
  it('keeps a good property and cuts a long value', () => {
    expect(checkProperty('payer', '1')).toEqual({ name: 'payer', value: '1', problems: [] });
    expect(checkProperty('payer', 'v'.repeat(40)).value).toHaveLength(36);
  });

  it('refuses a name over 24 characters or not snake_case', () => {
    expect(checkProperty('a_name_of_twenty_five_chs', '1').name).toBeNull();
    expect(checkProperty('install_age_bucket', '1').name).toBe('install_age_bucket');
    expect(checkProperty('Payer', '1').problems[0]).toContain('snake_case');
  });
});
