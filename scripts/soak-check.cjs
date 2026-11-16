/* global process, console, window, require */
/*
 * Short soak check for the end of a code task: plays the dev build by itself through
 * window.tippySoak and fails if the console shows any error or warning.
 *
 *   PLAYWRIGHT_PATH=<path to the playwright package> node scripts/soak-check.cjs \
 *     --url http://localhost:5173/ --minutes 10 [--rich]
 *
 * Without PLAYWRIGHT_PATH it tries `require('playwright')`. Memory sampling with a forced garbage
 * collection is a separate, longer harness kept outside the repository (docs/08, section 9).
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');

const IPHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

// Expected noise of a headless run on a fresh profile, not defects of the game.
const EXPECTED = [/Blocked call to navigator\.vibrate/, /^Save loaded from: new$/];

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  if (i < 0) return fallback;
  const next = process.argv[i + 1];
  return next === undefined || next.startsWith('--') ? true : next;
}

async function main() {
  const url = String(arg('url', 'http://localhost:5173/'));
  const minutes = Number(arg('minutes', 10));
  const rich = arg('rich', false) === true;
  const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    userAgent: IPHONE_UA,
    deviceScaleFactor: 2,
    isMobile: true,
  });
  const problems = [];
  page.on('console', (msg) => {
    if (EXPECTED.some((re) => re.test(msg.text()))) return;
    if (msg.type() === 'error' || msg.type() === 'warning')
      problems.push(`${msg.type()}: ${msg.text()}`);
  });
  page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
  await page.goto(`${url}${url.includes('?') ? '&' : '?'}bot=120`);
  await page.waitForFunction(() => window.tippySoak !== undefined, null, { timeout: 60000 });
  await page.evaluate((withRich) => window.tippySoak.start(withRich), rich);
  const end = Date.now() + minutes * 60000;
  while (Date.now() < end) await page.waitForTimeout(Math.min(30000, end - Date.now()));
  const status = await page.evaluate(() => window.tippySoak.status());
  await browser.close();
  console.log(
    `soak ${minutes} min: laps ${status.laps}, runs ${status.runs}, results ${status.results}`,
  );
  console.log(`console errors and warnings: ${problems.length}`);
  for (const line of problems.slice(0, 20)) console.log(`  ${line}`);
  process.exit(problems.length === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(2);
});
