// Reproductions from the third review (of 24e412f1). Each was committed
// failing on 24e412f1 before its fix.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { Window } from "happy-dom";
import { card, entity, gti, hydration, page, token, viewOutputPage } from "./fixtures/synthetic.mjs";

const read = (name) => readFileSync(new URL(`./${name}`, import.meta.url), "utf8");
const plain = (v) => (v === undefined ? v : JSON.parse(JSON.stringify(v)));
const EU = "https://www.primevideo.com/region/eu/mystuff/watchlist";

/**
 * Loads what the popup injects on Start. Up to 0.2.0 that included the
 * page-world observer; this helper loads it only while the file exists.
 */
function world(html, url = EU, routes = {}) {
	const window = new Window({ url });
	window.document.write(html);
	const reads = { clones: 0 };
	const original = async (input) => {
		const u = new URL(String(input), window.location.href);
		const body = routes[u.pathname + u.search] ?? routes[u.pathname];
		if (body === undefined) throw new TypeError("blocked in test");
		const make = () => {
			const r = new window.Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
			r.clone = () => (reads.clones++, make());
			return r;
		};
		return make();
	};
	window.fetch = original;
	window.eval(read("extract.js"));
	window.eval(read("collector.js"));
	if (existsSync(new URL("./observer.js", import.meta.url))) {
		window.__goodwatchPrimeObserverArgs = ["nonce-test"];
		window.eval(read("observer.js"));
	}
	const flush = (ms = 25) => new Promise((r) => setTimeout(r, ms));
	return {
		window,
		document: window.document,
		reads,
		original,
		command: (action, extra = {}) => plain(window.__goodwatchPrimeCommand({ action, nonce: "nonce-test", ...extra })),
		flush,
		close() {
			window.happyDOM.abort();
			window.close();
		},
	};
}

const onePage = (ids) => viewOutputPage(ids, { next: ids.length, total: ids.length });

test("r3-1: no response is read during a capture and the page keeps its own fetch", async () => {
	const w = world(page({ state: hydration({ page: onePage([1, 2]) }), grid: [1, 2] }), EU, {
		"/region/eu/api/account/settings": { secret: true },
		"/region/eu/api/watchlist": onePage([3]),
	});
	try {
		w.command("start");
		assert.equal(w.window.fetch, w.original, "fetch is never wrapped");
		await w.window.fetch("/region/eu/api/account/settings");
		await w.window.fetch("/region/eu/api/watchlist");
		await w.flush();
		assert.equal(w.reads.clones, 0, "no response copied or read");
	} finally {
		w.close();
	}
});

test("r3-2: a rejected Start leaves nothing running", async () => {
	const w = world(page({ state: hydration({ page: onePage([1]) }), grid: [1] }), "https://www.primevideo.com/region/eu/storefront");
	try {
		assert.equal(w.command("start").code, "wrong_page");
		assert.equal(w.window.fetch, w.original, "nothing wrapped after a rejected Start");
		w.window.history.pushState({}, "", "/region/eu/mystuff/watchlist");
		await w.flush(600);
		assert.equal(w.command("status").state, "idle", "no scan or observer was installed");
	} finally {
		w.close();
	}
});

test("r3-3: a shared query value can't link pages into a complete chain", async () => {
	const first = viewOutputPage([1, 2], { next: 2, total: 3 });
	first.viewOutput.features["legacy-watchlist"].content.seeMoreHref = "/region/eu/api/watchlist?cursor=expected-page-2&locale=en";
	const last = viewOutputPage([3], { next: 3, total: 3 });
	const w = world(page({ state: hydration({ page: first }), grid: [1, 2] }), EU, {
		"/region/eu/api/watchlist?cursor=actual-page-3&locale=en": last,
	});
	try {
		w.command("start");
		await w.window.fetch("/region/eu/api/watchlist?cursor=actual-page-3&locale=en");
		await w.flush();
		w.document.getElementById("grid").insertAdjacentHTML("beforeend", card(3));
		await w.flush();
		const r = w.command("stop");
		assert.notEqual(r.completeness, "complete", JSON.stringify(r.reasons));
	} finally {
		w.close();
	}
});

test("r3-4: an All control outside the Watchlist filter doesn't confirm the All view", async () => {
	const noFilter = onePage([1, 2]);
	delete noFilter.viewOutput.features["view-filter"];
	const html = page({ state: hydration({ page: noFilter }), grid: [1, 2] })
		.replace('<ul class="carousel"', '<button aria-pressed="true">All</button><ul class="carousel"')
		.replace("<h1>Watchlist</h1>", '<h1>Watchlist</h1><select aria-label="Filter"><option>All</option><option selected>Movies</option></select>');
	const w = world(html);
	try {
		w.command("start");
		const r = w.command("stop");
		assert.notEqual(r.completeness, "complete", JSON.stringify(r.reasons));
	} finally {
		w.close();
	}
});

test("r3-4b: a filter group outside the Watchlist feature doesn't confirm the All view", async () => {
	const noFilter = onePage([1, 2]);
	delete noFilter.viewOutput.features["view-filter"];
	const state = hydration({ page: noFilter, extra: { recommendations: { "genre-filter": { filters: [{ viewType: "all", active: true }, { viewType: "drama", active: false }] }, items: [entity(60)] } } });
	const w = world(page({ state, grid: [1, 2] }));
	try {
		w.command("start");
		const r = w.command("stop");
		assert.ok(r.reasons.includes("all_view_unconfirmed"), JSON.stringify(r.reasons));
	} finally {
		w.close();
	}
});

for (const change of ["profile", "filter"]) {
	test(`r3-5: an in-place ${change} change in an existing state script is noticed`, async () => {
		const w = world(page({ state: hydration({ page: onePage([1, 2]) }), grid: [1, 2] }));
		try {
			assert.equal(w.command("start").state, "capturing");
			const script = w.document.querySelector('script[type="text/template"]');
			script.textContent =
				change === "profile"
					? script.textContent.replace("synthetic-profile-a", "synthetic-profile-b")
					: script.textContent.replace('{"viewType":"all","text":"All","active":true},{"viewType":"movie","text":"Movies","active":false}', '{"viewType":"all","text":"All","active":false},{"viewType":"movie","text":"Movies","active":true}');
			await w.flush(150);
			const r = w.command("stop");
			if (change === "profile") assert.equal(r.code, "terminated_profile");
			else assert.ok(r.reasons.includes("filtered_view"), JSON.stringify(r.reasons));
			assert.notEqual(r.completeness, "complete");
		} finally {
			w.close();
		}
	});
}

test("r3-5b: re-reading a changed script doesn't duplicate membership", async () => {
	const w = world(page({ state: hydration({ page: onePage([1, 2]) }), grid: [1, 2] }));
	try {
		w.command("start");
		const script = w.document.querySelector('script[type="text/template"]');
		script.textContent = script.textContent.replace('"Invented"', '"Invented again"');
		await w.flush(150);
		const r = w.command("stop");
		assert.equal(r.envelope.items.length, 2);
		assert.equal(r.completeness, "complete", JSON.stringify(r.reasons));
	} finally {
		w.close();
	}
});

test("r3-6: one Watchlist card in a recommendation row doesn't bring the row's other cards", async () => {
	const html = page({ state: hydration({ page: onePage([1]) }), grid: [], recs: [1, 60, 61] });
	const w = world(html);
	try {
		w.command("start");
		const r = w.command("stop");
		assert.deepEqual(r.envelope.items.map((i) => i.title), ["Synthetic Movie"]);
	} finally {
		w.close();
	}
});

test("r3-7: a title-only reference entry withholds the exact verdict", () => {
	const dir = mkdtempSync(join(tmpdir(), "goodwatch-compare-"));
	try {
		writeFileSync(join(dir, "w.json"), JSON.stringify({ format: "goodwatch-wishlist", version: 1, source: "prime-video", completeness: "complete", items: [{ title: "Remake Title", year: 2024, mediaType: "movie", sourceId: gti(5), sourceUrl: `https://www.primevideo.com/region/eu/detail/${token(5)}` }] }));
		writeFileSync(join(dir, "ref.txt"), "Remake Title\n");
		const script = new URL("./scripts/compare.mjs", import.meta.url).pathname;
		const out = JSON.parse(execFileSync("node", [script, join(dir, "w.json"), join(dir, "ref.txt")], { encoding: "utf8" }));
		assert.notEqual(out.exactMembership, true);
		assert.equal(out.exactMembership, "withheld");
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});
