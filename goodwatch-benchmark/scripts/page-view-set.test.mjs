import assert from "node:assert/strict";
import { test } from "node:test";
import { buildSet } from "./page-view-set.mjs";

const origin = "https://example.com";
const staticOrigin = "https://static.example.com";
const set = { name: "test", entries: [{ route: "title_movie", path: "/movie/1", client: "browser", weight: 3 }, { route: "og_title", path: "/og/movie/1.png", client: "bot", weight: 1 }] };
const row = (path, type, connection, from = origin) => ({ path, type, connection, origin: from, own: from === origin, method: "GET", status: 200, transfer_bytes: 100 });
const capture = (staticFiles = false) => ({ origin, pages: [{ path: "/movie/1", static_origin: staticFiles ? staticOrigin : null, requests: [
  row("/movie/1", "Document", 1),
  row("/assets/a.js", "Script", staticFiles ? 3 : 1, staticFiles ? staticOrigin : origin),
  row("/assets/b.js", "Script", staticFiles ? 3 : 1, staticFiles ? staticOrigin : origin),
  row("/assets/font.woff2", "Font", staticFiles ? 3 : 1, staticFiles ? staticOrigin : origin),
  row("/assets/a.css", "Stylesheet", staticFiles ? 4 : 1, staticFiles ? staticOrigin : origin),
  row("/images/a.png", "Image", staticFiles ? 4 : 1, staticFiles ? staticOrigin : origin),
  row("/site.webmanifest", "Manifest", 2, staticFiles ? staticOrigin : origin),
  row("/api/search-config", "Fetch", 1),
  { ...row("/api/living-room/picks?view=pool", "Fetch", 1), method: "POST", body: "{}" },
  { ...row("/api/e", "Fetch", 1), method: "POST", body: "{}" },
  row("/x.jpg", "Image", 5, "https://images.example"),
] }] });
const sent = (view) => [...view.requests, ...view.side.flatMap((group) => group.requests)];

test("a capture without static rows keeps its main requests and one manifest connection", () => {
  const old = capture();
  for (const r of old.pages[0].requests) delete r.origin;
  delete old.origin;
  const { set: result } = buildSet(set, old);
  const view = result.entries[0].view;
  assert.deepEqual(view.requests.map((r) => r.path), ["/assets/a.js", "/assets/b.js", "/assets/font.woff2", "/assets/a.css", "/images/a.png", "/api/search-config", "/api/living-room/picks?view=pool"]);
  assert.deepEqual(view.side, [{ host: "site", requests: [{ method: "GET", path: "/site.webmanifest", type: "manifest", host: "site" }] }]);
  assert.equal(view.connections, 2);
  assert.equal(view.skipped.length, 1);
  assert.equal(result.requests_per_visit, 7);
  assert.equal(result.connections_per_visit, 1.75);
  assert.equal(result.static_url, null);
  assert.equal(result.page_names, "origin");
});

test("page files keep the largest static connection with the main visitor and group further connections", () => {
  const { set: result } = buildSet(set, capture(true));
  const view = result.entries[0].view;
  assert.deepEqual(view.requests.filter((r) => r.host === "static").map((r) => r.path), ["/assets/a.js", "/assets/b.js", "/assets/font.woff2"]);
  assert.deepEqual(view.side.map((group) => [group.host, group.requests.map((r) => r.path)]), [["static", ["/assets/a.css", "/images/a.png"]], ["static", ["/site.webmanifest"]]]);
  assert.equal(view.connections, 4);
  assert.equal(result.static_url, staticOrigin);
  assert.equal(result.page_names, "static");
  assert.equal(result.files, "page");
  assert.equal(result.requests_per_visit, 7);
  assert.equal(result.connections_per_visit, 3.25);
  assert.deepEqual(result.per_visit, {
    site: { requests: 2.5, transfer_bytes: 300, connections: 1 },
    static: { requests: 4.5, transfer_bytes: 450, connections: 2.25 },
    other: { requests: 0.75, transfer_bytes: 75, connections: 0 },
  });
});

test("origin files rewrite static rows, leaving only the manifest in a site side group", () => {
  const { set: result } = buildSet(set, capture(true), { files: "origin" });
  const view = result.entries[0].view;
  assert.equal(view.requests.length, 7);
  assert.deepEqual(view.side.map((group) => [group.host, group.requests.map((r) => r.path)]), [["site", ["/site.webmanifest"]]]);
  assert(sent(view).every((r) => r.host === "site"));
  assert.equal(result.requests_per_visit, 7);
  assert.equal(result.connections_per_visit, 1.75);
  assert.deepEqual(result.per_visit.site, { requests: 7, transfer_bytes: 750, connections: 1.75 });
  assert.deepEqual(result.per_visit.static, { requests: 0, transfer_bytes: 0, connections: 0 });
  assert.equal(result.page_names, "static");
});

test("other hosts and unsafe POSTs never appear in a request list in either mode", () => {
  for (const files of ["page", "origin"]) {
    const { set: result } = buildSet(set, capture(true), { files });
    assert(sent(result.entries[0].view).every((r) => !["/x.jpg", "/api/e"].includes(r.path)));
    assert.equal(result.requests_per_visit, result.per_visit.site.requests + result.per_visit.static.requests);
    assert.equal(result.connections_per_visit, result.per_visit.site.connections + result.per_visit.static.connections);
  }
});

test("the setting only identifies a static origin that the capture requested", () => {
  const input = capture(true);
  delete input.pages[0].static_origin;
  assert.equal(buildSet(set, input).set.static_url, null);
  assert.equal(buildSet(set, input, { staticHost: "static.example.com" }).set.static_url, staticOrigin);
  assert.equal(buildSet(set, capture(), { staticHost: "static.example.com" }).set.static_url, null);
  assert.throws(() => buildSet(set, input, { files: "invalid" }), /PAGE_FILES/);
});

test("two static connections keep scripts and font in the visitor and styles and images in a side group", () => {
  const input = capture(true);
  const manifest = input.pages[0].requests.find((r) => r.type === "Manifest");
  manifest.origin = origin;
  manifest.own = true;
  const { set: result } = buildSet(set, input);
  const view = result.entries[0].view;
  assert.deepEqual(view.requests.filter((r) => r.host === "static").map((r) => r.path), ["/assets/a.js", "/assets/b.js", "/assets/font.woff2"]);
  assert.deepEqual(view.side.map((group) => [group.host, group.requests.map((r) => r.path)]), [["static", ["/assets/a.css", "/images/a.png"]], ["site", ["/site.webmanifest"]]]);
  assert.equal(view.connections, 4);
  const rewritten = buildSet(set, input, { files: "origin" }).set.entries[0].view;
  assert.deepEqual(rewritten.side.map((group) => [group.host, group.requests.map((r) => r.path)]), [["site", ["/site.webmanifest"]]]);
});

test("both file modes preserve a capture without static rows", () => {
  const page = buildSet(set, capture(), { files: "page" }).set;
  const originMode = buildSet(set, capture(), { files: "origin" }).set;
  assert.deepEqual(originMode.entries, page.entries);
  assert.deepEqual(originMode.per_visit, page.per_visit);
  assert.equal(originMode.requests_per_visit, page.requests_per_visit);
  assert.equal(originMode.connections_per_visit, page.connections_per_visit);
});
