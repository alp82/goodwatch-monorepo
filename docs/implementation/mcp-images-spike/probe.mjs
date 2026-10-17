import assert from "node:assert/strict";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";

// Start server.mjs and the reference host first; see README.md.
const client = new Client({ name: "no-ui-probe", version: "0.0.1" });
try {
  await client.connect(new StreamableHTTPClientTransport(new URL("http://127.0.0.1:3001/mcp")));
  const result = await client.callTool({ name: "poster_spike", arguments: {} });
  assert.match(result.content[0].text, /\[The Matrix \(1999\)\]\(https:\/\/goodwatch.app\//);
  assert.equal(result.structuredContent.items.length, 2);
  const resource = await client.readResource({ uri: "ui://goodwatch/posters-v1.html" });
  assert.equal(resource.contents[0].mimeType, "text/html;profile=mcp-app");
  console.log("PASS: no-UI client receives text and structured data; UI resource readable");
} finally { await client.close(); }

// Use a locally available Playwright installation without adding it to the spike lockfile.
if (process.env.PLAYWRIGHT_MODULE) {
  const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1000, height: 800 } });
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.goto("http://localhost:18080/?server=goodwatch-posters-local-spike&tool=poster_spike&call=true");
    let view;
    await page.waitForFunction(() => document.querySelector("iframe"));
    for (let attempt = 0; attempt < 100; attempt++) {
      view = page.frames().find((frame) => frame.url() === "about:blank");
      if (view && await view.locator("#grid a").count() === 2) break;
      await page.waitForTimeout(100);
    }
    assert.ok(view, "Widget frame must initialize through AppBridge");
    await view.waitForFunction(() => [...document.images].length === 2 && [...document.images].every((img) => img.complete && img.naturalWidth > 0));
    assert.equal(await view.locator("#grid a").count(), 2);
    const popupPromise = page.waitForEvent("popup");
    await view.locator("#grid a").first().click();
    const popup = await popupPromise;
    await popup.waitForURL("https://goodwatch.app/movie/603-the-matrix");
    await popup.close();
    // Break an image: its title link must remain visible and usable.
    await view.locator("img").first().evaluate((img) => { img.src = "https://image.tmdb.org/t/p/w185/missing-goodwatch-spike.jpg"; });
    await view.waitForFunction(() => document.querySelector("img").hidden);
    assert.equal(await view.locator("#grid a").first().innerText(), "The Matrix (1999)");
    assert.deepEqual(pageErrors, []);
    console.log("PASS: AppBridge renders external posters, opens title via host, preserves label on image failure");
  } finally { await browser.close(); }
}
