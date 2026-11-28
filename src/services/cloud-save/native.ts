import { CLOUD } from '../../data/app/cloud';
import type { CloudSaveService } from './types';

/** What the cloud save needs of the app's own plugin `TippyGames` (`ios/App/App/TippyGamesPlugin.swift`). */
export interface CloudPlugin {
  cloudAvailable(): Promise<{ available: boolean }>;
  cloudRead(options: { key: string }): Promise<{ text?: string | null }>;
  cloudWrite(options: {
    key: string;
    text: string;
    previousKey?: string;
    previous?: string;
  }): Promise<{ ok: boolean }>;
  addListener(
    event: 'cloudChange',
    listener: (data: { reason?: string }) => void,
  ): Promise<{ remove: () => Promise<void> }>;
}

/** Reasons of the plugin's `cloudChange` that mean new data from the servers. */
const REMOTE_REASONS = new Set(['server', 'initial']);

/**
 * iCloud key-value storage through `TippyGames`. A missing plugin or a failed call counts as no
 * iCloud for `available` and as a failed write; a failed read rejects, so the caller can tell
 * it from an empty cloud.
 */
export class NativeCloudSave implements CloudSaveService {
  constructor(private readonly plugin: CloudPlugin) {}

  async available(): Promise<boolean> {
    try {
      return (await this.plugin.cloudAvailable()).available === true;
    } catch {
      return false;
    }
  }

  async read(): Promise<string | null> {
    const { text } = await this.plugin.cloudRead({ key: CLOUD.keys.copy });
    return typeof text === 'string' ? text : null;
  }

  async write(text: string, previous?: string): Promise<boolean> {
    try {
      const options =
        previous === undefined
          ? { key: CLOUD.keys.copy, text }
          : { key: CLOUD.keys.copy, text, previousKey: CLOUD.keys.previous, previous };
      return (await this.plugin.cloudWrite(options)).ok === true;
    } catch {
      return false;
    }
  }

  onRemoteChange(listener: () => void): () => void {
    let removed = false;
    let handle: { remove: () => Promise<void> } | null = null;
    try {
      this.plugin
        .addListener('cloudChange', (data) => {
          // Only data that came from the servers counts: an account change is read again on the
          // return to the foreground, and it must not open the first write early.
          if (!removed && REMOTE_REASONS.has(data.reason ?? '')) listener();
        })
        .then((h) => {
          handle = h;
          if (removed) void h.remove().catch(() => undefined);
        })
        .catch(() => undefined);
    } catch {
      // No plugin: no remote changes.
    }
    return () => {
      removed = true;
      void handle?.remove().catch(() => undefined);
    };
  }
}
