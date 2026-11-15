import { STUB_IAP } from '../../data/iap-stub';
import { t } from '../../i18n';
import type { IapService } from './types';

/** One product of the stub store. */
export interface StubProduct {
  id: string;
  priceString: string;
  /** Translated name of the product. */
  title: () => string;
  consumable: boolean;
}

/** Asks "buy (test)?" for a product; resolves true on Buy and false on Cancel. */
export type ConfirmPurchase = (product: { title: string; price: string }) => Promise<boolean>;

function styled<T extends HTMLElement>(el: T, style: Partial<CSSStyleDeclaration>): T {
  Object.assign(el.style, style);
  return el;
}

function stubButton(label: string, color: string, onClick: () => void): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.addEventListener('click', onClick);
  return styled(button, {
    flex: '1',
    border: '0',
    cursor: 'pointer',
    background: color,
    color: STUB_IAP.buttonTextColor,
    font: `bold ${STUB_IAP.buttonSizePx}px ${STUB_IAP.fontFamily}`,
    padding: `${STUB_IAP.buttonPaddingPx}px`,
    borderRadius: `${STUB_IAP.buttonRadiusPx}px`,
  });
}

function textLine(text: string, size: number, color: string, bold: boolean): HTMLDivElement {
  const el = document.createElement('div');
  el.textContent = text;
  return styled(el, { font: `${bold ? 'bold ' : ''}${size}px ${STUB_IAP.fontFamily}`, color });
}

/**
 * The store's confirm window imitated by a DOM overlay (never `window.confirm`): the product, its
 * price and two buttons. Resolves false at once where there is no DOM (tests).
 */
export const showConfirmOverlay: ConfirmPurchase = (product) => {
  if (typeof document === 'undefined') return Promise.resolve(false);
  return new Promise((resolve) => {
    const dim = styled(document.createElement('div'), {
      position: 'fixed',
      inset: '0',
      zIndex: String(STUB_IAP.zIndex),
      background: STUB_IAP.dimColor,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    });
    const panel = styled(document.createElement('div'), {
      width: `${STUB_IAP.panelWidthPx}px`,
      maxWidth: '90%',
      boxSizing: 'border-box',
      background: STUB_IAP.panelColor,
      textAlign: 'center',
      padding: `${STUB_IAP.panelPaddingPx}px`,
      borderRadius: `${STUB_IAP.panelRadiusPx}px`,
      display: 'flex',
      flexDirection: 'column',
      gap: `${STUB_IAP.gapPx}px`,
    });
    const done = (answer: boolean): void => {
      dim.remove();
      resolve(answer);
    };
    const row = styled(document.createElement('div'), {
      display: 'flex',
      gap: `${STUB_IAP.gapPx}px`,
    });
    row.append(
      stubButton(t('iap.stub.cancel'), STUB_IAP.cancelColor, () => done(false)),
      stubButton(t('iap.stub.buy'), STUB_IAP.buyColor, () => done(true)),
    );
    panel.append(
      textLine(t('iap.stub.confirm'), STUB_IAP.titleSizePx, STUB_IAP.textColor, true),
      textLine(product.title, STUB_IAP.productSizePx, STUB_IAP.textColor, false),
      textLine(product.price, STUB_IAP.priceSizePx, STUB_IAP.priceColor, true),
      row,
    );
    dim.append(panel);
    document.body.appendChild(dim);
  });
};

/** Gives the browser storage, or null when there is none (the access itself may throw). */
export type OwnedStorageSource = () => Storage | null;

const browserStorage: OwnedStorageSource = () =>
  typeof window === 'undefined' ? null : window.localStorage;

/**
 * Browser stand-in for the store. It asks "Buy (test)?" in a DOM overlay and imitates what a
 * store remembers: owned non-consumables live under their own storage key, not in the save, so
 * `restore()` and `ownedNonConsumables()` still know them after the progress was reset.
 */
export class WebIap implements IapService {
  private memory: string[] = [];
  private busy = false;

  constructor(
    private readonly catalog: readonly StubProduct[],
    private readonly confirm: ConfirmPurchase = showConfirmOverlay,
    private readonly source: OwnedStorageSource = browserStorage,
  ) {}

  init(): Promise<void> {
    return Promise.resolve();
  }

  getProducts(): Promise<Array<{ id: string; priceString: string; title: string }>> {
    return Promise.resolve(
      this.catalog.map(({ id, priceString, title }) => ({ id, priceString, title: title() })),
    );
  }

  async purchase(id: string): Promise<'purchased' | 'cancelled' | 'failed' | 'pending'> {
    const product = this.catalog.find((entry) => entry.id === id);
    if (!product || this.busy) return 'failed';
    // A store never sells a non-consumable twice.
    if (!product.consumable && this.owned().includes(id)) return 'failed';
    this.busy = true;
    try {
      const bought = await this.confirm({ title: product.title(), price: product.priceString });
      if (!bought) return 'cancelled';
      if (!product.consumable) this.remember(id);
      return 'purchased';
    } finally {
      this.busy = false;
    }
  }

  restore(): Promise<string[]> {
    return Promise.resolve(this.owned());
  }

  ownedNonConsumables(): Promise<string[]> {
    return Promise.resolve(this.owned());
  }

  /** Forgets every purchase of this stub store, in the page and in the storage. Debug panel only. */
  resetPurchases(): void {
    this.memory = [];
    try {
      this.source()?.removeItem(STUB_IAP.storageKey);
    } catch {
      // Blocked storage: the page memory above is already cleared.
    }
  }

  private owned(): string[] {
    try {
      const text = this.source()?.getItem(STUB_IAP.storageKey);
      if (text) {
        const parsed: unknown = JSON.parse(text);
        return Array.isArray(parsed)
          ? parsed.filter((value): value is string => typeof value === 'string')
          : [];
      }
    } catch {
      // Blocked or damaged storage: fall back to what this page remembers.
    }
    return [...this.memory];
  }

  private remember(id: string): void {
    const next = [...new Set([...this.owned(), id])];
    this.memory = next;
    try {
      this.source()?.setItem(STUB_IAP.storageKey, JSON.stringify(next));
    } catch {
      // The page memory above still holds it.
    }
  }
}
