import assert from "node:assert/strict";
import { test } from "node:test";
import { buildFilesInHtml, isSiteFamily, staticOriginFromSetting, staticOriginInHtml } from "./static-host.mjs";

const site = "https://example.com";
const staticOrigin = "https://static.example.com";

test("static settings accept hostnames and local origins, and reject paths and credentials", () => {
  assert.equal(staticOriginFromSetting("static.example.com"), staticOrigin);
  assert.equal(staticOriginFromSetting("http://127.0.0.1:3112"), "http://127.0.0.1:3112");
  assert.equal(staticOriginFromSetting(""), null);
  assert.equal(staticOriginFromSetting(undefined), null);
  for (const value of ["https://static.example.com/assets/a.js", "https://user:secret@static.example.com", "ftp://static.example.com", "https://static.example.com?x=1", "https://static.example.com/#x"])
    assert.throws(() => staticOriginFromSetting(value), /HTTP\(S\) origin/);
});

test("HTML discovery reads script and preload addresses, including relative addresses", () => {
  for (const html of ['<script type="module" src="/assets/a.js"></script>', '<link rel="modulepreload" href="https://example.com/assets/a.js">'])
    assert.equal(staticOriginInHtml(html, site), null);
  for (const html of [`<script type="module" src='${staticOrigin}/assets/a.js'></script>`, '<link rel="modulepreload" href=//static.example.com/assets/a.js>', `<script src="${staticOrigin}/assets/a.js?v=1&amp;b=2"></script>`])
    assert.equal(staticOriginInHtml(html, site), staticOrigin);
  assert.equal(buildFilesInHtml('<script src="/assets/a.js?v=1&amp;b=2"></script>', site)[0].search, "?v=1&b=2");
  assert.equal(staticOriginInHtml(`<!-- <script src="${staticOrigin}/assets/a.js"> --><script>const x = '<link href="${staticOrigin}/assets/a.js">'</script><img src="${staticOrigin}/assets/a.js">`, site), null);
});

test("site family requires a full hostname boundary and ignores ports", () => {
  assert.equal(isSiteFamily(staticOrigin, site), true);
  assert.equal(isSiteFamily("http://example.com:3112", site), true);
  assert.equal(isSiteFamily("https://images.example", site), false);
  assert.equal(isSiteFamily(site, staticOrigin), false);
});
