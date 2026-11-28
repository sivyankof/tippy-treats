/**
 * The cloud copy of the save (iCloud key-value storage on iOS; docs/09-services-analytics.md,
 * section 14). One key holds the copy; a second one keeps the copy of another device it replaced.
 * `read` may reject and `write` may answer false: the caller (`game/cloud/cloud-sync.ts`) then
 * leaves the cloud alone. Nothing else throws.
 */
export interface CloudSaveService {
  /** iCloud is on and usable for this app. */
  available(): Promise<boolean>;
  /** The text of the cloud copy, or null when there is none. Rejects when the store fails. */
  read(): Promise<string | null>;
  /** Writes the copy; `previous`, when given, goes to the second key first. True when the store took it. */
  write(text: string, previous?: string): Promise<boolean>;
  /** Calls `listener` when another device changed the copy (or the first download came); returns the unsubscribe. */
  onRemoteChange(listener: () => void): () => void;
}
