import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  giftOpenParams,
  logGiftOpen,
  logIapResult,
  logIapStart,
  logShopOpen,
} from './economy-telemetry';

const logEvent = vi.hoisted(() => vi.fn());
vi.mock('../../services', () => ({ services: { telemetry: { logEvent } } }));

describe('economy events', () => {
  beforeEach(() => logEvent.mockClear());

  it('builds the parameters of gift_open', () => {
    expect(giftOpenParams(true)).toEqual({ doubled: true });
  });

  it('logs each event with its parameters', () => {
    logGiftOpen(false);
    logShopOpen('home');
    logIapStart('remove_ads');
    logIapResult('remove_ads', 'cancelled');
    expect(logEvent.mock.calls).toEqual([
      ['gift_open', { doubled: false }],
      ['shop_open', { source: 'home' }],
      ['iap_start', { product: 'remove_ads' }],
      ['iap_result', { product: 'remove_ads', result: 'cancelled' }],
    ]);
  });
});
