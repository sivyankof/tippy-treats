import { beforeEach, describe, expect, it } from 'vitest';
import type { ConsentService, TrackingStatus } from '../../services/consent/types';
import {
  consentDue,
  resetConsentSession,
  runConsentFlow,
  type ConsentFlowDeps,
} from './consent-flow';

function setup(
  options: { tracking?: TrackingStatus; attAsked?: boolean; explained?: boolean } = {},
) {
  const log: string[] = [];
  const consent: ConsentService = {
    gather: () => {
      log.push('ump');
      return Promise.resolve();
    },
    privacyOptionsRequired: () => false,
    showPrivacyOptions: () => Promise.resolve(),
    trackingStatus: () => Promise.resolve(options.tracking ?? 'not_determined'),
    requestTracking: () => {
      log.push('att');
      return Promise.resolve();
    },
  };
  const deps: ConsentFlowDeps = {
    consent,
    ads: {
      init: () => {
        log.push('ads');
        return Promise.resolve();
      },
    },
    attAsked: options.attAsked ?? false,
    markAttAsked: () => log.push('marked'),
    explain: () => {
      log.push('explain');
      return Promise.resolve(options.explained ?? true);
    },
  };
  return { deps, log };
}

beforeEach(resetConsentSession);

describe('consentDue', () => {
  it('waits for the first finished run and runs once per launch', async () => {
    expect(consentDue(0)).toBe(false);
    expect(consentDue(1)).toBe(true);
    await runConsentFlow(setup().deps);
    expect(consentDue(5)).toBe(false);
  });
});

describe('runConsentFlow', () => {
  it('on iOS goes UMP, explainer, tracking question, ads', async () => {
    const { deps, log } = setup();
    await runConsentFlow(deps);
    expect(log).toEqual(['ump', 'explain', 'att', 'marked', 'ads']);
  });

  it('on Android (no tracking question) goes UMP then ads, no explainer', async () => {
    const { deps, log } = setup({ tracking: 'unavailable' });
    await runConsentFlow(deps);
    expect(log).toEqual(['ump', 'ads']);
  });

  it('does not ask the tracking question again once asked or decided', async () => {
    const asked = setup({ attAsked: true });
    await runConsentFlow(asked.deps);
    expect(asked.log).toEqual(['ump', 'ads']);
    const decided = setup({ tracking: 'decided' });
    await runConsentFlow(decided.deps);
    expect(decided.log).toEqual(['ump', 'ads']);
  });

  it('skips the question when the explainer could not be shown, and still starts the ads', async () => {
    const { deps, log } = setup({ explained: false });
    await runConsentFlow(deps);
    expect(log).toEqual(['ump', 'explain', 'ads']);
  });

  it('starts the ads even when every consent step throws', async () => {
    const { deps, log } = setup();
    deps.consent.gather = () => Promise.reject(new Error('blocked'));
    await expect(runConsentFlow(deps)).resolves.toBe(false);
    expect(log).toEqual(['ads']);
  });

  it('never rejects when the ads fail to start', async () => {
    const { deps } = setup();
    deps.ads.init = () => Promise.reject(new Error('x'));
    await expect(runConsentFlow(deps)).resolves.toBe(true);
  });

  it('reports whether the explainer was shown', async () => {
    expect(await runConsentFlow(setup().deps)).toBe(true);
    expect(await runConsentFlow(setup({ tracking: 'unavailable' }).deps)).toBe(false);
  });
});
