import { CLOUD } from '../../data/app/cloud';
import type { CloudSaveService } from './types';

/**
 * Modes of the browser stub (`?cloud=` on the dev server and the internal build): `none` (no
 * cloud on this platform: the default, and Android in 1.1), `on`, `off` (iCloud turned off),
 * `fail` (reads reject, writes fail) and `slow` (reads answer after `SLOW_MS`, past the timeout).
 */
export type WebCloudMode = 'none' | 'on' | 'off' | 'fail' | 'slow';

export function isWebCloudMode(value: string | null | undefined): value is WebCloudMode {
  return (
    value === 'none' || value === 'on' || value === 'off' || value === 'fail' || value === 'slow'
  );
}

/** The read of `?cloud=slow` answers this late. */
export const SLOW_MS = 5000;

/** The `localStorage` keys of the stub: not the save's keys, so the two never mix. */
export const STUB_KEYS = {
  copy: `stub_cloud_${CLOUD.keys.copy}`,
  previous: `stub_cloud_${CLOUD.keys.previous}`,
} as const;

/** What the stub needs of the page; tests pass their own. */
export interface StubPage {
  storage: Pick<Storage, 'getItem' | 'setItem'> | null;
  /** Subscribes to changes of `localStorage` made by other tabs; returns the unsubscribe. */
  onStorage(listener: (key: string | null) => void): () => void;
  wait(ms: number): Promise<void>;
}

function browserPage(): StubPage {
  const storage = (() => {
    try {
      return typeof localStorage === 'undefined' ? null : localStorage;
    } catch {
      return null;
    }
  })();
  return {
    storage,
    onStorage: (listener) => {
      if (typeof window === 'undefined') return () => undefined;
      const handler = (event: StorageEvent): void => listener(event.key);
      window.addEventListener('storage', handler);
      return () => window.removeEventListener('storage', handler);
    },
    wait: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  };
}

/**
 * The browser has no iCloud: without a debug mode the cloud is not there at all. In a debug mode
 * the copy lives under the stub's own `localStorage` keys; a write from another tab comes as a
 * remote change, so two tabs play two devices. Every call is written to `log`.
 */
export class WebCloudSave implements CloudSaveService {
  private readonly copy = new Map<string, string>();

  constructor(
    readonly mode: WebCloudMode = 'none',
    private readonly log: ((line: string) => void) | null = null,
    private readonly page: StubPage = browserPage(),
  ) {}

  available(): Promise<boolean> {
    const on = this.mode === 'on' || this.mode === 'fail' || this.mode === 'slow';
    this.note(`available → ${on}`);
    return Promise.resolve(on);
  }

  async read(): Promise<string | null> {
    if (this.mode === 'slow') await this.page.wait(SLOW_MS);
    if (this.mode === 'fail') {
      this.note('read → failed');
      throw new Error('cloud stub: read failed');
    }
    const text = this.get(STUB_KEYS.copy);
    this.note(`read → ${text === null ? 'empty' : `${text.length} chars`}`);
    return text;
  }

  write(text: string, previous?: string): Promise<boolean> {
    if (this.mode !== 'on' && this.mode !== 'slow') {
      this.note('write → failed');
      return Promise.resolve(false);
    }
    if (previous !== undefined) this.set(STUB_KEYS.previous, previous);
    this.set(STUB_KEYS.copy, text);
    this.note(`write ${text.length} chars${previous === undefined ? '' : ', previous kept'}`);
    return Promise.resolve(true);
  }

  onRemoteChange(listener: () => void): () => void {
    if (this.mode === 'none') return () => undefined;
    return this.page.onStorage((key) => {
      if (key !== STUB_KEYS.copy) return;
      this.note('remote change');
      listener();
    });
  }

  private get(key: string): string | null {
    try {
      return this.page.storage ? this.page.storage.getItem(key) : (this.copy.get(key) ?? null);
    } catch {
      return this.copy.get(key) ?? null;
    }
  }

  private set(key: string, value: string): void {
    this.copy.set(key, value);
    try {
      this.page.storage?.setItem(key, value);
    } catch {
      // The page memory keeps it.
    }
  }

  private note(line: string): void {
    if (this.mode !== 'none') this.log?.(`[cloud] ${line}`);
  }
}
