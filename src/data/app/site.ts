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
   * The support mailbox (public, the owner's decision of 2026-11-20): the only e-mail address the
   * site and the game may show. The pages carry `[SUPPORT_EMAIL]`, filled in from here at
   * publication, so the address lives in this one place. Never a personal address.
   */
  supportEmail: 'tippy.games@icloud.com',
} as const;

export type SitePage = keyof typeof SITE.pages;

/** The full address of a page of the site. */
export function siteUrl(page: SitePage): string {
  return SITE.base + SITE.pages[page];
}

/** A page of the site in the game's language (the site switches by `?lang=`). */
export function sitePageIn(page: SitePage, lang: string): string {
  return `${siteUrl(page)}?lang=${encodeURIComponent(lang)}`;
}
