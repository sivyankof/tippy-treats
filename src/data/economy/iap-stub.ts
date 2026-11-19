import type { ProductKey } from './shop';

/** Prices the browser purchase stub shows (stub data, US store tiers of docs/05, section 5). */
export const STUB_PRICES: Record<ProductKey, string> = {
  remove_ads: '$3.99',
  starter_pack: '$1.99',
  berries_80: '$0.99',
  berries_500: '$4.99',
  berries_1200: '$9.99',
  berries_2800: '$19.99',
};

/** The browser stand-in of the store: where it remembers purchases and how its confirm window looks. */
export const STUB_IAP = {
  /** Owned non-consumables live under this key, apart from the save (the store keeps them, not the game). */
  storageKey: 'stub_store_owned',
  zIndex: 10000,
  dimColor: 'rgba(30, 20, 40, 0.72)',
  panelColor: '#ffffff',
  textColor: '#2b2b2b',
  priceColor: '#1a7f4b',
  buyColor: '#2f9e5f',
  cancelColor: '#9a8fa8',
  buttonTextColor: '#ffffff',
  fontFamily: 'sans-serif',
  titleSizePx: 22,
  productSizePx: 18,
  priceSizePx: 26,
  buttonSizePx: 18,
  panelWidthPx: 300,
  panelRadiusPx: 18,
  panelPaddingPx: 22,
  gapPx: 12,
  buttonRadiusPx: 12,
  buttonPaddingPx: 12,
} as const;
