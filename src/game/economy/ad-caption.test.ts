import { describe, expect, it } from 'vitest';
import { adCaptionFor } from './ad-caption';

describe('adCaptionFor', () => {
  it('says "no internet" with the icon when offline', () => {
    expect(adCaptionFor('offline')).toEqual({ key: 'continue.noInternet', offline: true });
  });

  it('keeps the old caption without the icon when there is nothing to show', () => {
    expect(adCaptionFor('no_fill')).toEqual({ key: 'continue.adUnavailable', offline: false });
  });

  it('says "Loading…" without an icon while the next ad loads', () => {
    expect(adCaptionFor('loading')).toEqual({ key: 'continue.adLoading', offline: false });
  });
});
