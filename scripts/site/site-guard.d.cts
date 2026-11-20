export const UNPUBLISHED: readonly string[];
export function readSupportEmail(source: string): string | null;
export function publishedDate(html: string | null | undefined): string | null;
export function fillSite(
  files: Readonly<Record<string, string>>,
  fill: { email: string | null; date: string },
): Record<string, string>;
export function findProblems(
  files: Readonly<Record<string, string>>,
  email: string | null,
): string[];
export function publishable(names: readonly string[]): string[];
