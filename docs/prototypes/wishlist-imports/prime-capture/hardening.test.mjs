// Reproductions from the second independent review (of 1216b309 + e4939330).
// Each test was written to fail on e4939330 before its fix.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { Window } from "happy-dom";
import { card, entity, gti, hydration, nextHref, page, token, viewOutputPage } from "./fixtures/synthetic.mjs";

const read = (name) => readFileSync(new URL(`./${name}`, import.meta.url), "utf8");
const plain = (v) => (v === undefined ? v : JSON.parse(JSON.stringify(v)));
const EU = "https://www.primevideo.com/region/eu/mystuff/watchlist";
const ALL = { "view-filter": { filters: [{ viewType: "all", active: true }, { viewType: "movie", active: false }] } };

/**
 * A page whose fetch returns instrumented responses: every clone() and body
 * read is counted, so a test can prove which responses were never read.
 */
function world(html, url = EU, routes = {}) {
	const window = new Window({ url });
	window.document.write(html);
	const reads = { clones: 0, texts: 0, bodies: 0, byUrl: new Map() };
	const respond = (u, body, type = "application/json") => {
		const text = typeof body === "string" ? body : JSON.stringify(body);
		const make = () => {
			const r = new window.Response(text, { status: 200, headers: { "content-type": type } });
			const track = (name) => {
				reads[name]++;
				reads.byUrl.set(u, (reads.byUrl.get(u) || 0) + 1);
			};
			const realText = r.text.bind(r);
			Object.defineProperty(r, "url", { value: u });
			r.text = () => (track("texts"), realText());
			const body = r.body;
			Object.defineProperty(r, "body", { get: () => (track("bodies"), body) });
			r.clone = () => (track("clones"), make());
			return r;
		};
		return make();
	};
	const original = async (input) => {
		const u = new URL(String(input instanceof window.Request ? input.url : input), window.location.href);
		const route = routes[u.href] ?? routes[u.pathname + u.search] ?? routes[u.pathname];
		if (route === undefined) throw new TypeError("blocked in test");
		return typeof route === "function" ? route(u.href, respond) : respond(u.href, route);
	};
	window.fetch = original;
	window.eval(read("extract.js"));
	window.eval(read("collector.js"));
	window.__goodwatchPrimeObserverArgs = ["nonce-test"];
	window.eval(read("observer.js"));
	const messages = [];
	window.addEventListener("message", (e) => {
		if (e.data?.goodwatchPrime) messages.push(e.data);
	});
	const flush = () => new Promise((r) => setTimeout(r, 25));
	return {
		window,
		document: window.document,
		reads,
		messages,
		original,
		command: (action, extra = {}) => plain(window.__goodwatchPrimeCommand({ action, nonce: "nonce-test", ...extra })),
		async load(path, { show = [], hide = [] } = {}) {
			try {
				await window.fetch(path);
			} catch {}
			await flush();
			const grid = window.document.getElementById("grid");
			for (const n of hide) grid.querySelector(`a[href*="${token(n)}"]`)?.closest("li").remove();
			grid.insertAdjacentHTML("beforeend", show.map((n) => card(n)).join(""));
			await flush();
		},
		flush,
		post(message) {
			window.postMessage({ goodwatchPrime: "nonce-test", message }, "https://www.primevideo.com");
		},
		close() {
			window.happyDOM.abort();
			window.close();
		},
	};
}

const p1 = viewOutputPage([1, 2], { next: 2, total: 5, cursor: "c1" });
const p2 = viewOutputPage([3, 4], { next: 4, total: 5, cursor: "c2" });
const p3 = viewOutputPage([5], { next: 5, total: 5 });
const routes = { [nextHref(2, "c1")]: p2, [nextHref(4, "c2")]: p3 };
const base = (extra) => page({ state: hydration({ page: p1 }), grid: [1, 2], ...extra });

// 1. Interception scope and lifetime

test("1a: unrelated and cross-origin responses are never cloned or read", async () => {
	const w = world(base(), EU, {
		"https://cdn.example.org/private.json": { secret: "x" },
		"/region/eu/account/settings.json": { secret: "y" },
		"/region/eu/mystuff/watchlist/data.css": "body{}",
	});
	try {
		w.command("start");
		await w.load("https://cdn.example.org/private.json");
		await w.load("/region/eu/account/settings.json");
		assert.equal(w.reads.clones, 0, "no clone of an unrelated response");
		assert.equal(w.reads.texts + w.reads.bodies, 0, "no read of an unrelated response");
	} finally {
		w.close();
	}
});

test("1b: an oversized list response is read only up to the cap and not parsed", async () => {
	const huge = JSON.stringify({ viewOutput: { features: { "legacy-watchlist": { content: { items: [], pad: "x".repeat(9 * 1024 * 1024) } } } } });
	const w = world(base(), EU, { "/region/eu/api/watchlist/huge": huge });
	try {
		w.command("start");
		await w.load("/region/eu/api/watchlist/huge");
		const rep = w.command("status", { report: true }).report;
		assert.equal(rep.responses.length, 1);
		assert.equal(rep.responses[0].tooLarge, true);
		assert.equal(rep.responses[0].parsed, false);
		assert.equal(w.reads.texts, 0, "no unbounded text() read");
	} finally {
		w.close();
	}
});

for (const exit of ["stop", "cancel", "navigation"]) {
	test(`1c: observation ends on ${exit} and the page's own fetch is restored`, async () => {
		const w = world(base(), EU, routes);
		try {
			w.command("start");
			assert.notEqual(w.window.fetch, w.original, "wrapped while capturing");
			if (exit === "navigation") {
				w.window.history.pushState({}, "", "/region/eu/storefront");
				await w.flush();
				w.command("status");
			} else w.command(exit);
			await w.flush();
			assert.equal(w.window.fetch, w.original, "fetch restored");
			const before = w.messages.length;
			const clones = w.reads.clones;
			await w.load(nextHref(2, "c1"));
			assert.equal(w.messages.length, before, "no messages after the capture ended");
			assert.equal(w.reads.clones, clones, "no reads after the capture ended");
		} finally {
			w.close();
		}
	});
}

// 2. Report anonymity and message validation

test("2a: names, script IDs, classes and test IDs never reach the report", async () => {
	const state = hydration({ page: p1, extra: { Alice: { favourites: { Bob: 1 } } } });
	const html = page({ state, grid: [1, 2] })
		.replace('<script type="text/template">', '<script type="text/template" id="alice-hydration">')
		.replace('data-testid="watchlist-grid"', 'data-testid="alice-grid" class="AliceList list"');
	const w = world(html, EU, routes);
	try {
		w.command("start");
		await w.load(nextHref(2, "c1"), { show: [3, 4] });
		const text = JSON.stringify(w.command("stop").report);
		for (const leak of ["Alice", "alice", "Bob", "favourites"]) assert.ok(!text.includes(leak), `${leak} leaks`);
	} finally {
		w.close();
	}
});

test("2b: forged messages can't plant private strings in the report or exhaust memory", async () => {
	const w = world(base());
	try {
		w.command("start");
		const items = Array.from({ length: 20000 }, (_, i) => ({ gti: null, token: `0FORGED${String(i).padStart(6, "0")}`, url: "javascript:alert(1)", title: "Planted Secret", mediaType: "movie" }));
		w.post({ kind: "response", path: "/Alice/watchlist", status: "Alice", parsed: true, shape: { Alice: "Alice" }, collections: [{ path: "Alice", chain: "Alice", classification: "watchlist", objects: 1, items, pagination: { terminal: true, keys: ["Alice"], cursor: "Alice", totalItems: 2 } }] });
		for (let i = 0; i < 1500; i++) w.post({ kind: "response", path: `/x${i}/watchlist`, status: 200, parsed: false, collections: [] });
		await w.flush();
		await w.flush();
		const r = w.command("stop");
		const text = JSON.stringify(r.report);
		assert.ok(!text.includes("Alice") && !text.includes("Planted"), "no planted strings in the report");
		assert.ok(r.report.responses.length <= 100, "bounded response log");
		assert.ok(!r.envelope.items.some((i) => i.title === "Planted Secret" && !/^https:/.test(i.sourceUrl || "https:")), "invalid URLs never pass");
		assert.ok(r.envelope.items.filter((i) => i.title === "Planted Secret").length <= 1000, "bounded items per message");
	} finally {
		w.close();
	}
});

// 3. Pagination evidence must come from the page itself and form a chain

test("3a: an ancestor's hasMoreItems:false doesn't end a page that has no own evidence", async () => {
	const state = { props: { viewOutput: { features: { "legacy-watchlist": { hasMoreItems: false, content: { items: [entity(1), entity(2)] } }, ...ALL } }, profiles: { activeProfile: { id: "p" } } } };
	const w = world(page({ state, grid: [1, 2] }));
	try {
		w.command("start");
		const r = w.command("stop");
		assert.notEqual(r.completeness, "complete", JSON.stringify(r.reasons));
	} finally {
		w.close();
	}
});

test("3b: hasMoreItems:false next to a continuation token is a contradiction", async () => {
	const state = { props: { viewOutput: { features: { "legacy-watchlist": { content: { items: [entity(1), entity(2)], hasMoreItems: false, nextToken: "more" } }, ...ALL } }, profiles: { activeProfile: { id: "p" } } } };
	const w = world(page({ state, grid: [1, 2] }));
	try {
		w.command("start");
		const r = w.command("stop");
		assert.notEqual(r.completeness, "complete");
		assert.ok(r.reasons.includes("pagination_contradiction"), JSON.stringify(r.reasons));
	} finally {
		w.close();
	}
});

test("3c: a terminal page that doesn't follow the previous page leaves a gap", async () => {
	const lastWithoutLink = viewOutputPage([3, 4, 5], { next: 5, total: 5 });
	const w = world(base(), EU, { "/region/eu/api/watchlist/other": lastWithoutLink });
	try {
		w.command("start");
		await w.load("/region/eu/api/watchlist/other", { show: [3, 4, 5] });
		const r = w.command("stop");
		assert.notEqual(r.completeness, "complete");
		assert.ok(r.reasons.includes("chain_gap"), JSON.stringify(r.reasons));
	} finally {
		w.close();
	}
});

test("3d: the linked chain still completes", async () => {
	const w = world(base(), EU, routes);
	try {
		w.command("start");
		await w.load(nextHref(2, "c1"), { show: [3, 4], hide: [1] });
		await w.load(nextHref(4, "c2"), { show: [5], hide: [2] });
		const r = w.command("stop");
		assert.equal(r.completeness, "complete", JSON.stringify(r.reasons));
		assert.deepEqual(r.report.pagination.pages.map((p) => p.link), ["start", "cursor", "cursor"]);
	} finally {
		w.close();
	}
});

// 4. All view and profile

test("4a: a Movies filter held in page state on an unchanged URL is a filtered view", async () => {
	const movies = viewOutputPage([1, 2], { next: 2, total: 2 });
	movies.viewOutput.features["view-filter"].filters = [{ viewType: "all", active: false }, { viewType: "movie", active: true }];
	const w = world(page({ state: hydration({ page: movies }), grid: [1, 2] }));
	try {
		w.command("start");
		const r = w.command("stop");
		assert.notEqual(r.completeness, "complete");
		assert.ok(r.reasons.includes("filtered_view"), JSON.stringify(r.reasons));
	} finally {
		w.close();
	}
});

test("4b: without positive All-view evidence the capture isn't complete", async () => {
	const noFilter = viewOutputPage([1, 2], { next: 2, total: 2 });
	delete noFilter.viewOutput.features["view-filter"];
	const w = world(page({ state: hydration({ page: noFilter }), grid: [1, 2] }));
	try {
		w.command("start");
		const r = w.command("stop");
		assert.equal(r.completeness, "unknown");
		assert.ok(r.reasons.includes("all_view_unconfirmed"), JSON.stringify(r.reasons));
	} finally {
		w.close();
	}
});

test("4c: a profile change seen only in new page state discards the capture", async () => {
	const html = base().replace(/<button[^]*?<\/button>/, "");
	const w = world(html);
	try {
		assert.equal(w.command("start").profileGuard, "state");
		const other = hydration({ page: viewOutputPage([4], { next: 1, total: 1 }), profile: "synthetic-profile-b" });
		w.document.body.insertAdjacentHTML("beforeend", `<script type="text/template">${JSON.stringify(other)}</script>`);
		w.document.getElementById("grid").insertAdjacentHTML("beforeend", card(4));
		await w.flush();
		const r = w.command("status");
		assert.equal(r.code, "terminated_profile");
		assert.equal(r.envelope, undefined);
	} finally {
		w.close();
	}
});

test("4d: a profile change seen only in a list response discards the capture", async () => {
	const html = base().replace(/<button[^]*?<\/button>/, "");
	const other = { ...p2, profiles: { activeProfile: { id: "synthetic-profile-b" } } };
	const w = world(html, EU, { [nextHref(2, "c1")]: other });
	try {
		w.command("start");
		await w.load(nextHref(2, "c1"), { show: [3, 4] });
		assert.equal(w.command("status").code, "terminated_profile");
	} finally {
		w.close();
	}
});

// 5. Card groups by element identity; unresolved cards stay out of the file

test("5a: two lists with identical attributes don't merge", async () => {
	const html = base().replace('<ul class="carousel" aria-label="Because you watched Synthetic Movie">', '<ul role="list" data-testid="watchlist-grid">');
	const w = world(html);
	try {
		w.command("start");
		const r = w.command("stop");
		assert.ok(!r.envelope.items.some((i) => /Recommend/.test(i.title)), JSON.stringify(r.envelope.items.map((i) => i.title)));
	} finally {
		w.close();
	}
});

test("5b: with no page-data Watchlist, guessed cards stay out of the file", async () => {
	const state = { props: { content: { baseOutput: { containers: [{ entities: [entity(1), entity(2)], paginationTargetId: "t1" }] } }, profiles: { activeProfile: { id: "p" } } } };
	const w = world(page({ state, grid: [1, 2] }));
	try {
		w.command("start");
		const r = w.command("stop");
		assert.equal(r.completeness, "unknown");
		assert.equal(r.envelope.items.length, 0, "no unresolved cards in the import file");
		assert.equal(r.report.counts.visibleUnresolved, 2);
	} finally {
		w.close();
	}
});

// 6. Channel disagreements block complete

test("6a: different titles for one ID in data and cards block complete", async () => {
	const one = viewOutputPage([1], { next: 1, total: 1 });
	const w = world(page({ state: hydration({ page: one }), grid: [] }).replace('id="grid"></ul>', `id="grid">${card(1).replaceAll("Synthetic Movie", "Different Name")}</ul>`));
	try {
		w.command("start");
		const r = w.command("stop");
		assert.notEqual(r.completeness, "complete");
		assert.ok(r.reasons.includes("channel_title_disagreement"), JSON.stringify(r.reasons));
	} finally {
		w.close();
	}
});

test("6b: card media types fill a missing data type, and a type conflict blocks complete", async () => {
	const untyped = viewOutputPage([1, 2], { next: 2, total: 2, opts: { type: false } });
	const w = world(page({ state: hydration({ page: untyped }), grid: [1, 2] }));
	try {
		w.command("start");
		const r = w.command("stop");
		assert.deepEqual(r.envelope.items.map((i) => i.mediaType), ["movie", "show"]);
	} finally {
		w.close();
	}
	const typed = viewOutputPage([1], { next: 1, total: 1 });
	const c = world(page({ state: hydration({ page: typed }), grid: [] }).replace('id="grid"></ul>', `id="grid">${card(1).replace('data-card-entity-type="Movie"', 'data-card-entity-type="TV Show"')}</ul>`));
	try {
		c.command("start");
		const r = c.command("stop");
		assert.ok(r.reasons.includes("channel_type_disagreement"), JSON.stringify(r.reasons));
	} finally {
		c.close();
	}
});

// 7. Reference modes in compare.mjs

test("7: compare.mjs gives exact counts for a full reference and labels a sample as sampled", () => {
	const dir = mkdtempSync(join(tmpdir(), "goodwatch-compare-"));
	try {
		const wish = { format: "goodwatch-wishlist", version: 1, source: "prime-video", completeness: "complete", items: [
			{ title: "Remake Title", year: 1984, mediaType: "movie", sourceId: gti(4), sourceUrl: `https://www.primevideo.com/region/eu/detail/${token(4)}` },
			{ title: "Remake Title", year: 2024, mediaType: "movie", sourceId: gti(5), sourceUrl: `https://www.primevideo.com/region/eu/detail/${token(5)}` },
			{ title: "Extra Title", year: 2000, mediaType: "movie", sourceId: gti(9) },
		] };
		writeFileSync(join(dir, "w.json"), JSON.stringify(wish));
		writeFileSync(join(dir, "full.json"), JSON.stringify({ members: [{ title: "Remake Title", year: 1984 }, { link: `https://www.primevideo.com/detail/${token(5)}/ref=x` }, { title: "Missing Title", year: 1990 }] }));
		writeFileSync(join(dir, "sample.json"), JSON.stringify({ counts: { movies: 3, shows: 0 }, sample: ["Remake Title"], notOnWatchlist: ["Nope"] }));
		const script = new URL("./scripts/compare.mjs", import.meta.url).pathname;
		const full = JSON.parse(execFileSync("node", [script, join(dir, "w.json"), join(dir, "full.json")], { encoding: "utf8" }));
		assert.equal(full.evidence, "full");
		assert.deepEqual([full.reference, full.matched, full.missed, full.extra, full.ambiguous], [3, 2, 1, 1, 0]);
		assert.equal(full.exactMembership, false);
		const sampled = JSON.parse(execFileSync("node", [script, join(dir, "w.json"), join(dir, "sample.json")], { encoding: "utf8" }));
		assert.equal(sampled.evidence, "sampled");
		assert.equal(sampled.exactMembership, "not established");
		assert.ok(!JSON.stringify(full).includes("Remake") && !JSON.stringify(sampled).includes("Remake"), "counts only");
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});
