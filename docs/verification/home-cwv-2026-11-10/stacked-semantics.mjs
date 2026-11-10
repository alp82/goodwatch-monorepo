// Offline functional check in the pinned benchmark Chromium. Input contains production-minified reference/candidate
// CSS and real SplitFrame SSR markup. This makes no HTTP requests and measures no interaction performance.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import puppeteer from '/usr/local/lib/node_modules/lighthouse/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
const input = JSON.parse(await readFile('/data/input.json', 'utf8'));
const browser = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-background-networking'] });
const results = {};
const blocked = [];
try {
  for (const variant of ['reference', 'candidate']) {
    const page = await browser.newPage();
    await page.setRequestInterception(true);
    page.on('request', request => { blocked.push(request.url()); void request.abort(); });
    await page.setContent(`<!doctype html><html><head><style>${input.css[variant]}</style></head><body><main id="fixture"></main></body></html>`);
    results[variant] = [];
    for (const viewport of [390, 1023, 1024, 1365]) {
      await page.setViewport({ width: viewport, height: 900 });
      results[variant].push(...await page.evaluate(({ markup, viewport }) => {
        const host = document.getElementById('fixture');
        const properties = ['display', 'flex-direction', 'height', 'width', 'padding-top', 'padding-right',
          'padding-bottom', 'padding-left', 'border-top-left-radius', 'border-top-right-radius',
          'border-bottom-left-radius', 'border-bottom-right-radius', 'row-gap', 'column-gap', 'flex-grow', 'flex-shrink'];
        const capture = frame => [frame, ...frame.querySelectorAll('*')].map(element => {
          const style = getComputedStyle(element);
          return properties.map(property => [property, style.getPropertyValue(property)]);
        });
        const cases = [];
        for (const [face, html] of Object.entries(markup)) for (const big of [false, true]) {
          for (const width of [200, 335, 336, 343, 375, 383, 384, 500]) {
            host.innerHTML = `<div class="@container/seen" style="width:${width}px">${html}</div>`;
            const frame = host.querySelector('[data-seen-score]');
            frame.toggleAttribute('data-big', big);
            frame.classList.toggle('lg:h-14', big);
            const stacked = face === 'status' && (width < 336 || big && viewport >= 1024 && width < 384);
            if (getComputedStyle(frame).flexDirection !== (stacked ? 'column' : 'row')) {
              throw new Error(`Wrong stacking for ${face}, big=${big}, width=${width}, viewport=${viewport}`);
            }
            cases.push({ face, big, width, viewport, state: 'rest', styles: capture(frame) });
            if (face === 'status' && width === 200) {
              const status = frame.querySelector('[data-status-face]');
              const parent = status.parentElement;
              status.remove();
              parent.textContent = 'Seen';
              if (getComputedStyle(frame).flexDirection !== 'row') throw new Error('Failed tracking fallback still stacks');
              cases.push({ face, big, width, viewport, state: 'status-removed', styles: capture(frame) });
              parent.textContent = '';
              parent.append(status);
              if (getComputedStyle(frame).flexDirection !== 'column') throw new Error('Restored status does not stack');
              cases.push({ face, big, width, viewport, state: 'status-restored', styles: capture(frame) });
            }
          }
        }
        return cases;
      }, { markup: input.markup, viewport }));
      // Hover the real frame after a fresh render; compare its native style calculation too.
      await page.hover('[data-seen-score]');
      const hovered = await page.evaluate(() => ({ viewport: innerWidth, state: 'hover',
        styles: [...document.querySelector('[data-seen-score]').querySelectorAll('*')].map(element => {
          const style = getComputedStyle(element); return [style.display, style.flexDirection, style.height, style.padding, style.borderRadius];
        }) }));
      results[variant].push(hovered);
    }
    await page.close();
  }
  assert.deepEqual(results.candidate, results.reference);
  assert.equal(blocked.length, 0);
  const output = { browser: await browser.version(), source: input.source, productionMinifiers: input.productionMinifiers,
    markup: 'actual SplitFrame SSR output; compact/big flags, status/Seen faces, asynchronous status removal/restoration',
    viewportWidths: [390, 1023, 1024, 1365], containerWidths: [200, 335, 336, 343, 375, 383, 384, 500],
    comparedStates: results.candidate.length, identicalComputedStyles: true, zeroNetworkRequests: true,
    performanceMeasurement: false };
  await writeFile('/data/result.json', `${JSON.stringify(output, null, 2)}\n`);
  console.log(JSON.stringify(output));
} finally { await browser.close(); }
