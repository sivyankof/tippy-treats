export const UNPUBLISHED: readonly string[];
export const LEGAL_PAGES: readonly string[];
export const PLACEHOLDER_RE: RegExp;
export function readSupportEmail(source: string): string | null;
export function readField(source: string, name: string): string | null;
export function repoOfBase(base: string): string;
export function slugOfRepo(repo: string): string;
export function publishedDate(html: string | null | undefined): string | null;
export function isText(name: string): boolean;
export function fillSite(
  files: Readonly<Record<string, string>>,
  fill: { email: string | null; date: string },
): Record<string, string>;
export function changedLegal(
  filled: Readonly<Record<string, string>>,
  published: Readonly<Record<string, string>>,
): string[];
export function findProblems(
  files: Readonly<Record<string, string>>,
  email: string | null,
): string[];
export function publishable(names: readonly string[]): string[];
