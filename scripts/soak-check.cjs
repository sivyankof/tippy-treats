/* global process, console, window, require */
/*
 * Short soak check for the end of a code task: plays the dev build by itself through
 * window.tippySoak and fails if the console shows any error or warning.
 *
 *   PLAYWRIGHT_PATH=<path to the playwright package> node scripts/soak-check.cjs \
 *     --url http://localhost:5173/ --minutes 10 [--rich]
 *   ... --url <dev> --smoke     one fast lap through every screen and run kind (tippySoak.smoke())
 *
 * Without PLAYWRIGHT_PATH it tries `require('playwright')`. Memory sampling with a forced garbage
 * collection is a separate, longer harness kept outside the repository (docs/08, section 9).
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');

const IPHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

/** Time for the first page load of a cold dev server. */
const COLD_LOAD_MS = 120000;

// Expected noise of a headless run on a fresh profile, not defects of the game.
const EXPECTED = [/Blocked call to navigator\.vibrate/, /^Save loaded from: new$/];

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  if (i < 0) return fallback;
  const next = process.argv[i + 1];
  return next === undefined || next.startsWith('--') ? true : next;
}

/** Prints the smoke result and returns the exit code: 0 only with every step done, equal counts and no messages. */
function smokeVerdict(report, problems) {
  const done = report.steps.filter((step) => step.ok).length;
  const { before: b, after: a } = report;
  // Equality of the counts is decided once, in the game (`differing` in soak-driver.ts).
  const total = report.steps.length;
  const ok = report.ok && done === total && total > 0 && problems.length === 0;
  if (!report.ok) console.log(`  report: ${JSON.stringify(report)}`);
  for (const step of report.steps) if (!step.ok) console.log(`  unfinished step: ${step.name}`);
  for (const line of problems.slice(0, 20)) console.log(`  ${line}`);
  const pair = (name, x, y) => `${name} ${x}${report.differing.includes(name) ? '!=' : '='}${y}`;
  console.log(
    `smoke: ${ok ? 'ok' : 'FAIL'}, steps ${done}/${total}, ${problems.length} messages, ` +
      `${pair('objects', b.objects, a.objects)}, ${pair('listeners', b.listeners, a.listeners)}, ` +
      `${pair('audioNodes', b.audioNodes, a.audioNodes)}, ` +
      `${pair('tweens', b.tweens, a.tweens)}, jokes ${report.status.jokes}, arcs ${report.status.arcs}, ${report.seconds} s`,
  );
  return ok ? 0 : 1;
}

async function main() {
  const url = String(arg('url', 'http://localhost:5173/'));
  const minutes = Number(arg('minutes', 10));
  const rich = arg('rich', false) === true;
  const browser = await chromium.launch({
    args: [
      '--use-angle=d3d11',
      '--ignore-gpu-blocklist',
      '--autoplay-policy=no-user-gesture-required',
    ],
  });
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
  // A vite server soak:auto has just started serves every module unbundled and uncached on the
  // first load, which can take longer than the default 30 s.
  await page.goto(`${url}${url.includes('?') ? '&' : '?'}bot=120`, { timeout: COLD_LOAD_MS });
  await page.waitForFunction(() => window.tippySoak !== undefined, null, { timeout: 60000 });
  if (arg('smoke', false) === true) {
    const report = await page.evaluate(() => window.tippySoak.smoke());
    await browser.close();
    process.exit(smokeVerdict(report, problems));
  }
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
  // A soak that did nothing proves nothing: fail it instead of reporting a clean pass.
  // A short soak may end before the first lap closes, so only a soak with no runs is idle.
  const idle = status.runs === 0;
  if (idle)
    console.error(
      `FAIL: the soak played no runs (runs ${status.runs}, laps ${status.laps}, stuck at stage "${status.stage}"); the result says nothing about leaks`,
    );
  process.exit(problems.length === 0 && !idle ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(2);
});
