/**
 * The parts of `navigator` the game reads to tell devices apart (the perf benchmark, the audio
 * session); one shape for every such check.
 */
export interface BrowserInfo {
  webdriver?: boolean;
  userAgent?: string;
  platform?: string;
  userAgentData?: { platform?: string };
  maxTouchPoints?: number;
  /** The page's audio session (Safari and WKWebView from iOS 16.4). */
  audioSession?: { type: string };
}

/** An iPhone, iPod or iPad (an iPad reports itself as a Mac with a touch screen). */
export function isAppleTouch(nav: BrowserInfo): boolean {
  if (/iPhone|iPad|iPod/.test(nav.userAgent ?? '')) return true;
  return nav.platform === 'MacIntel' && (nav.maxTouchPoints ?? 0) > 1;
}
