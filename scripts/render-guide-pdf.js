/**
 * Re-render public/iboga-guide-free.pdf from the live /iboga-guide page.
 *
 * Usage:
 *   1. In one terminal:  npm run dev
 *   2. In another:       npm install --no-save playwright@1.56.0 && \
 *                        npx playwright install chromium && \
 *                        node scripts/render-guide-pdf.js
 *
 * The script bypasses the sessionStorage gate, force-reveals all .reveal
 * sections (which are normally faded in by IntersectionObserver), waits for
 * webfonts, and writes a Letter-size PDF with no page margins (the page CSS
 * supplies its own padding).
 */

const { chromium } = require('playwright');
const path = require('path');

const URL = process.env.GUIDE_URL || 'http://localhost:3000/iboga-guide';
const OUT = path.resolve(process.cwd(), 'public/iboga-guide-free.pdf');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1280, height: 1800 },
  });
  await context.addInitScript(() => {
    try {
      window.sessionStorage.setItem('guide_access', 'true');
    } catch (_) {}
  });
  const page = await context.newPage();
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 90000 });
  await page.evaluate(() => {
    document.querySelectorAll('.hidden').forEach((el) => {
      el.classList.remove('hidden');
      el.classList.add('visible');
    });
    return document.fonts.ready;
  });
  await page.waitForTimeout(500);

  await page.pdf({
    path: OUT,
    format: 'Letter',
    printBackground: true,
    margin: { top: '0', right: '0', bottom: '0', left: '0' },
  });

  console.log('wrote', OUT);
  await browser.close();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
