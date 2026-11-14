/** Key-value storage of the game: the save and its backups live here (docs/09-services-analytics.md, section 2). */
export interface StorageService {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}
