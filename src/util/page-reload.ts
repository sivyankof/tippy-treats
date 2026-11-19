/**
 * Reloads the page with this query (no `?` needed; empty for a normal start). The path is kept, so
 * it works on the dev server and on the local origin of the apps alike.
 */
export function reloadWithQuery(query: string): void {
  window.location.assign(window.location.pathname + (query === '' ? '' : `?${query}`));
}
