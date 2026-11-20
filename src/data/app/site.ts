/**
 * The game's website: privacy policy, terms of use and support (docs/11-release-store.md, "Сайт").
 * The source is `site/`; `scripts/site/publish-site.cjs` copies it to the public repository
 * sivyankof/tippy-treats-site, whose GitHub Pages serve it at `base`. The same addresses go into
 * App Store Connect, Google Play and the game's settings.
 */
export const SITE = {
  /** Where GitHub Pages serve the site (the repository name is the path). */
  base: 'https://sivyankof.github.io/tippy-treats-site/',
  /** The pages the stores and the game link to, under `base`. */
  pages: {
    privacy: 'privacy.html',
    terms: 'terms.html',
    support: 'support.html',
  },
  /**
   * The support mailbox, the only e-mail address the site may show (it replaces
   * `[SUPPORT_EMAIL]` at publication). Null until the owner sets the mailbox up: the publication
   * refuses to run until then. Never a personal address.
   */
  supportEmail: null as string | null,
} as const;

export type SitePage = keyof typeof SITE.pages;

/** The full address of a page of the site. */
export function siteUrl(page: SitePage): string {
  return SITE.base + SITE.pages[page];
}
