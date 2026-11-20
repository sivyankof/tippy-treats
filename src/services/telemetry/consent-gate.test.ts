import { describe, expect, it } from 'vitest';
import { analyticsDecision, regionOfStatus } from './consent-gate';

const tcf = (gdprApplies: boolean | null, purposeConsents = '') => ({
  gdprApplies,
  purposeConsents,
});

describe('analyticsDecision', () => {
  it('follows the TCF answer where GDPR applies: purpose 1 given → on, refused → off', () => {
    expect(analyticsDecision(tcf(true, '1111111111'), 'required')).toBe('on');
    expect(analyticsDecision(tcf(true, '1000000000'), 'unknown')).toBe('on');
    expect(analyticsDecision(tcf(true, '0111111111'), 'required')).toBe('off');
    expect(analyticsDecision(tcf(true, ''), 'required')).toBe('off');
  });

  it('is on where GDPR does not apply', () => {
    expect(analyticsDecision(tcf(false), 'unknown')).toBe('on');
    expect(analyticsDecision(tcf(false), 'required')).toBe('on');
  });

  it('without the TCF strings follows the region UMP reported', () => {
    expect(analyticsDecision(null, 'not_required')).toBe('on');
    expect(analyticsDecision(tcf(null), 'not_required')).toBe('on');
    expect(analyticsDecision(null, 'required')).toBe('off');
    expect(analyticsDecision(null, 'unknown')).toBe('unknown');
  });
});

describe('regionOfStatus', () => {
  it('maps the UMP consent status', () => {
    expect(regionOfStatus('NOT_REQUIRED')).toBe('not_required');
    expect(regionOfStatus('REQUIRED')).toBe('required');
    expect(regionOfStatus('OBTAINED')).toBe('required');
    expect(regionOfStatus('UNKNOWN')).toBe('unknown');
  });
});
