import type { StorageService } from './types';

/**
 * Storage whose keys carry a prefix. Dev only (`?device=b`): a second tab keeps its own save
 * while sharing the cloud stub, so two tabs play two devices.
 */
export class PrefixedStorage implements StorageService {
  constructor(
    private readonly inner: StorageService,
    private readonly prefix: string,
  ) {}

  get(key: string): Promise<string | null> {
    return this.inner.get(this.prefix + key);
  }

  set(key: string, value: string): Promise<void> {
    return this.inner.set(this.prefix + key, value);
  }

  remove(key: string): Promise<void> {
    return this.inner.remove(this.prefix + key);
  }
}
