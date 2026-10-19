import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { Window } from "happy-dom";
import { card, entity, gti, hydration, nextHref, page, token, viewOutputPage } from "./fixtures/synthetic.mjs";

const ALL = { "view-filter": { filters: [{ viewType: "all", active: true }, { viewType: "movie", active: false }] } };

const read = (name) => readFileSync(new URL(`./${name}`, import.meta.url), "utf8");
const plain = (v) => (v === undefined ? v : JSON.parse(JSON.stringify(v)));
const EU = "https://www.primevideo.com/region/eu/mystuff/watchlist";

function world(html, url = EU, routes = {}) {
	const window = new Window({ url });
	window.document.write(html);
	// The page's own requests. Unknown paths fail like a network error.
	window.fetch = async (input) => {
		const u = new URL(String(input), window.location.href);
		const body = routes[u.pathname + u.search] ?? routes[u.pathname];
		if (body === undefined) throw new TypeError("blocked in test");
		return new window.Response(typeof body === "string" ? body : JSON.stringify(body), {
			status: 200,
			headers: { "content-type": "application/json" },
		});
	};
	window.eval(read("extract.js"));
	window.eval(read("collector.js"));
	// Up to 0.2.0 Start also injected a page-world response reader.
	if (existsSync(new URL("./observer.js", import.meta.url))) {
		window.__goodwatchPrimeObserverArgs = ["nonce-test"];
		window.eval(read("observer.js"));
	}
	const flush = () => new Promise((r) => setTimeout(r, 20));
	return {
		window,
		document: window.document,
		command: (action, extra = {}) => plain(window.__goodwatchPrimeCommand({ action, nonce: "nonce-test", ...extra })),
		// Simulates the page loading its next Watchlist page and rendering it.
		async load(path, { show = [], hide = [] } = {}) {
			if (path) await window.fetch(path).catch(() => {});
			await flush();
			const grid = window.document.getElementById("grid");
			for (const n of hide) grid.querySelector(`a[href*="${token(n)}"]`)?.closest("li").remove();
			grid.insertAdjacentHTML("beforeend", show.map((n) => card(n)).join(""));
			// Scans are throttled to one per 100 ms after a mutation.
			await new Promise((r) => setTimeout(r, 150));
		},
		flush,
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

async function fullRun(w) {
	assert.equal(w.command("start").state, "capturing");
	await w.load(nextHref(2, "c1"), { show: [3, 4], hide: [1, 2] });
	await w.load(nextHref(4, "c2"), { show: [5], hide: [3] });
	return w.command("stop");
}

test("mixed movie, show and season list held in page data is complete; virtualized cards accumulate; library, recommendations and nav stay out", async () => {
	const all = viewOutputPage([1, 2, 3, 4, 5], { next: 5, total: 5 });
	const w = world(page({ state: hydration({ page: all }), grid: [1, 2] }));
	try {
		assert.equal(w.command("start").state, "capturing");
		// Scrolling: the grid drops earlier cards and renders later ones.
		await w.load(null, { show: [3, 4], hide: [1, 2] });
		await w.load(null, { show: [5], hide: [3] });
		const r = w.command("stop");
		assert.equal(r.completeness, "complete", JSON.stringify(r.reasons));
		const items = r.envelope.items;
		assert.deepEqual(
			items.map((i) => [i.title, i.mediaType, i.year, i.sourceId, i.sourceUrl]),
			[
				["Synthetic Movie", "movie", 2001, gti(1), `https://www.primevideo.com/region/eu/detail/${token(1)}`],
				["Synthetic Show", "show", 2015, gti(2), `https://www.primevideo.com/region/eu/detail/${token(2)}`],
				["Synthetic Show – Season 2", "show", 2017, gti(3), `https://www.primevideo.com/region/eu/detail/${token(3)}`],
				["Remake Title", "movie", 1984, gti(4), `https://www.primevideo.com/region/eu/detail/${token(4)}`],
				["Remake Title", "movie", 2024, gti(5), `https://www.primevideo.com/region/eu/detail/${token(5)}`],
			],
		);
		assert.equal(r.envelope.source, "prime-video");
		assert.ok(items.every((i) => !("tmdbId" in i) && !("imdbId" in i)));
		const rep = r.report;
		assert.equal(rep.counts.structuredUnique, 5);
		assert.equal(rep.counts.visibleUnique, 5);
		assert.equal(rep.counts.inBoth, 5);
		assert.equal(rep.counts.seasons, 1);
		assert.equal(rep.counts.sameTitleDistinctIds, 2);
		assert.equal(rep.counts.withGti, 5);
		assert.equal(rep.pagination.pages.length, 1);
		assert.deepEqual(rep.pagination.reportedTotals, [5]);
		assert.equal(rep.profileGuard, "state+dom");
		assert.equal(rep.responsesRead, 0);
		assert.equal(rep.primaryGroupChosenBy, "structured_overlap");
		assert.ok(rep.otherCollections.some((c) => c.classification === "excluded" && c.path.includes("recommendations")));
		assert.ok(rep.otherCollections.some((c) => c.classification === "excluded" && c.path.includes("library")));
	} finally {
		w.close();
	}
});

test("report carries no titles, native IDs, cursors or profile values", async () => {
	const w = world(page({ state: hydration({ page: p1 }), grid: [1, 2] }), EU, routes);
	try {
		const text = JSON.stringify((await fullRun(w)).report);
		for (const secret of ["Synthetic", "Remake", "Recommended", "amzn1.dv.gti.0", "0SYNTH", "synthetic-profile", "c1", "token=", "Invented", "avatar"])
			assert.ok(!text.includes(secret), `report leaks ${secret}`);
	} finally {
		w.close();
	}
});

test("a list longer than the page data's first page is partial with continuation_pending", async () => {
	const w = world(page({ state: hydration({ page: p1 }), grid: [1, 2] }));
	try {
		w.command("start");
		await w.load(null, { show: [3, 4] });
		const r = w.command("stop");
		assert.equal(r.completeness, "partial");
		assert.ok(r.reasons.includes("continuation_pending"));
		assert.ok(r.reasons.includes("visible_not_in_structured"));
		assert.equal(r.envelope.items.length, 2, "only page-data entries are in the file");
	} finally {
		w.close();
	}
});

test("state without pagination evidence stays unknown", async () => {
	const w = world(page({ state: hydration({ page: viewOutputPage([1, 2]) }), grid: [1, 2] }));
	try {
		w.command("start");
		const r = w.command("stop");
		assert.equal(r.completeness, "unknown");
		assert.ok(r.reasons.includes("no_terminal_evidence"));
	} finally {
		w.close();
	}
});

test("a repeated cursor on a different page is partial", async () => {
	const loop = viewOutputPage([3], { next: 2, total: 5, cursor: "c1" });
	const html = page({ state: hydration({ page: p1 }), grid: [1, 2] }).replace("</body>", `<script type="text/template">${JSON.stringify({ props: loop })}</script></body>`);
	const w = world(html);
	try {
		w.command("start");
		const r = w.command("stop");
		assert.ok(r.reasons.includes("cursor_repeated"), JSON.stringify(r.reasons));
		assert.equal(r.completeness, "partial");
	} finally {
		w.close();
	}
});

test("the same page embedded in two hydration scripts is not a repeated cursor", async () => {
	const html = page({ state: hydration({ page: viewOutputPage([1, 2, 3, 4, 5], { next: 5, total: 5 }) }), grid: [1, 2, 3, 4, 5] }).replace(
		"</body>",
		`<script type="text/template">${JSON.stringify({ props: viewOutputPage([1, 2, 3, 4, 5], { next: 5, total: 5 }) })}</script></body>`,
	);
	const w = world(html);
	try {
		w.command("start");
		const r = w.command("stop");
		assert.equal(r.completeness, "complete", JSON.stringify(r.reasons));
		assert.equal(r.report.pagination.duplicatePages, 1);
	} finally {
		w.close();
	}
});

test("cards that aren't in the page data make the capture partial and stay out of the file", async () => {
	const w = world(page({ state: hydration({ page: viewOutputPage([1, 2], { next: 2, total: 2 }) }), grid: [1, 2] }));
	try {
		w.command("start");
		w.document.getElementById("grid").insertAdjacentHTML("beforeend", card(3) + card(4));
		await w.flush();
		const r = w.command("stop");
		assert.equal(r.completeness, "partial");
		assert.ok(r.reasons.includes("visible_not_in_structured"));
		assert.equal(r.envelope.items.length, 2);
	} finally {
		w.close();
	}
});

test("structured members never seen as cards make the capture partial", async () => {
	const w = world(page({ state: hydration({ page: viewOutputPage([1, 2, 3], { next: 3, total: 3 }) }), grid: [1, 2] }));
	try {
		w.command("start");
		const r = w.command("stop");
		assert.ok(r.reasons.includes("structured_not_seen_visible"));
		assert.equal(r.completeness, "partial");
	} finally {
		w.close();
	}
});

test("a reported total that the capture doesn't reach is partial", async () => {
	const w = world(page({ state: hydration({ page: viewOutputPage([1, 2], { next: 6, total: 6 }) }), grid: [1, 2] }));
	try {
		w.command("start");
		assert.ok(w.command("stop").reasons.includes("total_mismatch"));
	} finally {
		w.close();
	}
});

test("profile change discards everything; state-free pages fall back to the header marker", async () => {
	const state = { props: viewOutputPage([1, 2], { next: 2, total: 2 }) };
	const w = world(page({ state, grid: [1, 2] }));
	try {
		const r = w.command("start");
		assert.equal(r.profileGuard, "dom");
		// An avatar URL change alone is no evidence (lazy loading, cache-busting).
		w.document.querySelector('[data-testid="pv-nav-profile-button"] img').setAttribute("src", "/avatar-b.png");
		await w.flush();
		assert.equal(w.command("status").state, "capturing");
		w.document.querySelector('[data-testid="pv-nav-profile-button"]').setAttribute("aria-label", "Profile: Other");
		await w.flush();
		const after = w.command("status");
		assert.equal(after.code, "terminated_profile");
		assert.equal(after.envelope, undefined);
	} finally {
		w.close();
	}
});

test("no profile evidence at all is reported as unknown completeness", async () => {
	const html = page({ state: { props: viewOutputPage([1], { next: 1, total: 1 }) }, grid: [1] }).replace(/<button[^]*?<\/button>/, "");
	const w = world(html);
	try {
		w.command("start");
		const r = w.command("stop");
		assert.equal(r.completeness, "unknown");
		assert.ok(r.reasons.includes("profile_unconfirmed"));
	} finally {
		w.close();
	}
});

test("changing the Watchlist filter during capture is partial; starting on a filter is unknown", async () => {
	const w = world(page({ state: hydration({ page: viewOutputPage([1, 2], { next: 2, total: 2 }) }), grid: [1, 2] }));
	try {
		w.command("start");
		w.window.history.pushState({}, "", "/region/eu/mystuff/watchlist/movie");
		await w.flush();
		const r = w.command("stop");
		assert.ok(r.reasons.includes("filter_changed"));
	} finally {
		w.close();
	}
	const f = world(page({ state: hydration({ page: viewOutputPage([1], { next: 1, total: 1 }) }), grid: [1] }), `${EU}/movie`);
	try {
		f.command("start");
		const r = f.command("stop");
		assert.ok(r.reasons.includes("filtered_view"));
		assert.equal(r.report.filter, "/movie");
	} finally {
		f.close();
	}
});

test("leaving the Watchlist ends the capture as partial but keeps the members read so far", async () => {
	const w = world(page({ state: hydration({ page: p1 }), grid: [1, 2] }), EU, routes);
	try {
		w.command("start");
		w.window.history.pushState({}, "", "/region/eu/detail/0SYNTH000001X/");
		await w.flush();
		const r = w.command("stop");
		assert.equal(r.code, "terminated_navigation");
		assert.equal(r.completeness, "partial");
		assert.equal(r.envelope.items.length, 2);
	} finally {
		w.close();
	}
});

test("containers layout without a Watchlist key: membership comes from cards only and stays unknown", async () => {
	const state = {
		props: {
			content: { baseOutput: { containers: [{ entities: [entity(1), entity(2)], paginationTargetId: "t1" }] } },
			profiles: { activeProfile: { id: "p" } },
		},
	};
	const w = world(page({ state, grid: [1, 2] }));
	try {
		w.command("start");
		const r = w.command("stop");
		assert.equal(r.completeness, "unknown");
		assert.ok(r.reasons.includes("no_structured_watchlist"));
		assert.ok(r.reasons.includes("visible_group_guessed"));
		assert.equal(r.envelope.items.length, 0, "cards that can't be tied to the Watchlist stay out of the file");
		assert.equal(r.report.counts.visibleOnly, 2);
		const other = r.report.otherCollections.find((c) => c.classification === "unclassified");
		assert.equal(other.path, "props.content.baseOutput.containers.[].entities");
		assert.equal(other.overlapWithVisible, 2);
		assert.deepEqual(other.paginationKeys, ["paginationTargetId"]);
	} finally {
		w.close();
	}
});

test("amazon.de /gp/video origin and German locale keep their own detail URLs", async () => {
	const prefix = "/gp/video";
	const state = hydration({ page: viewOutputPage([1, 2], { next: 2, total: 2, opts: { prefix } }) });
	const w = world(page({ state, grid: [], lang: "de-de", prefix }).replace('<ul role="list" data-testid="watchlist-grid" id="grid"></ul>', `<ul role="list" id="grid">${card(1, { prefix })}${card(2, { prefix })}</ul>`), "https://www.amazon.de/gp/video/mystuff/watchlist");
	try {
		w.command("start");
		const r = w.command("stop");
		assert.equal(r.completeness, "complete", JSON.stringify(r.reasons));
		assert.equal(r.envelope.items[0].sourceUrl, `https://www.amazon.de/gp/video/detail/${token(1)}`);
		assert.equal(r.report.host, "www.amazon.de");
		assert.equal(r.report.lang, "de-de");
	} finally {
		w.close();
	}
});

test("live entries in the Watchlist collection are excluded and counted", async () => {
	const w = world(page({ state: hydration({ page: viewOutputPage([1, 70], { next: 2, total: 2 }) }), grid: [1] }));
	try {
		w.command("start");
		const r = w.command("stop");
		assert.equal(r.report.counts.liveExcluded, 1);
		assert.deepEqual(r.envelope.items.map((i) => i.title), ["Synthetic Movie"]);
	} finally {
		w.close();
	}
});

test("conflicting card titles for one ID quarantine it and make the capture partial", async () => {
	const w = world(page({ state: hydration({ page: viewOutputPage([1], { next: 1, total: 1 }) }), grid: [1] }));
	try {
		w.command("start");
		w.document.getElementById("grid").insertAdjacentHTML("beforeend", card(1).replaceAll("Synthetic Movie", "Other Name"));
		await w.flush();
		const r = w.command("stop");
		assert.ok(r.reasons.includes("conflicting_identity"));
		assert.equal(r.envelope.items.length, 0);
	} finally {
		w.close();
	}
});

// "An unreadable Watchlist response" tested the 0.2.0 response reader.
// Version 0.3.0 reads no responses; see r3-1.

test("a recommendation row larger than the grid doesn't become the membership group", async () => {
	const w = world(page({ state: hydration({ page: viewOutputPage([1], { next: 1, total: 1 }) }), grid: [1], recs: [60, 61, 62] }));
	try {
		w.command("start");
		const r = w.command("stop");
		assert.deepEqual(r.envelope.items.map((i) => i.title), ["Synthetic Movie"]);
		assert.equal(r.completeness, "complete", JSON.stringify(r.reasons));
	} finally {
		w.close();
	}
});

test("wrong page, cancel and messages with another nonce", async () => {
	const w = world(page({ state: hydration({ page: p1 }), grid: [1, 2] }), "https://www.primevideo.com/region/eu/storefront");
	try {
		assert.equal(w.command("start").code, "wrong_page");
	} finally {
		w.close();
	}
	const c = world(page({ state: hydration({ page: p1 }), grid: [1, 2] }));
	try {
		c.command("start");
		c.window.postMessage({ goodwatchPrime: "forged", message: { kind: "response", path: "/x/watchlist", parsed: true, collections: [] } }, "*");
		await c.flush();
		assert.equal(c.command("status", { report: true }).report.responsesRead, 0, "nothing listens for page messages");
		const r = c.command("cancel");
		assert.equal(r.state, "cancelled");
		assert.equal(r.envelope, undefined);
	} finally {
		c.close();
	}
});

test("detail links: credential-free, query-free, provider hosts only", () => {
	const w = new Window({ url: EU });
	try {
		w.eval(read("extract.js"));
		const X0 = w.__goodwatchPrimeExtract;
		const X = { detailLink: (...a) => plain(X0.detailLink(...a)), mediaType: (...a) => plain(X0.mediaType(...a)) };
		const base = EU;
		assert.deepEqual(X.detailLink("/detail/0ABCDEF12/ref=x?a=1#b", base), { token: "0ABCDEF12", url: "https://www.primevideo.com/detail/0ABCDEF12" });
		assert.equal(X.detailLink("https://user:pw@www.primevideo.com/detail/0ABCDEF12/", base), null);
		assert.equal(X.detailLink("https://evil.example/detail/0ABCDEF12/", base), null);
		assert.equal(X.detailLink("http://www.primevideo.com/detail/0ABCDEF12/", base), null);
		assert.equal(X.detailLink("/detail/short/", base), null);
		assert.equal(X.detailLink("https://www.amazon.co.uk/gp/video/detail/B0ABCDEF12/ref=1", base).url, "https://www.amazon.co.uk/gp/video/detail/B0ABCDEF12");
		assert.deepEqual(X.mediaType("TV Show"), { mediaType: "show", season: false });
		assert.deepEqual(X.mediaType("SEASON"), { mediaType: "show", season: true });
		assert.equal(X.mediaType("Event").mediaType, "unknown");
	} finally {
		w.happyDOM.abort();
		w.close();
	}
});

test("a duplicate listing inside one page becomes one item", async () => {
	const w = world(page({ state: hydration({ page: viewOutputPage([1, 1, 2], { next: 3, total: 3 }) }), grid: [1, 2] }));
	try {
		w.command("start");
		const r = w.command("stop");
		assert.equal(r.envelope.items.length, 2);
		assert.equal(r.report.counts.structuredSightings, 3);
		assert.ok(r.reasons.includes("total_mismatch"), "a total that counts the duplicate can't be reached");
	} finally {
		w.close();
	}
});

test("an unavailable title without a detail link keeps its GTI but can't join a card: partial", async () => {
	const state = hydration({ page: { viewOutput: { features: { "legacy-watchlist": { content: { items: [entity(1), entity(6, { link: false })], nextPageStartIndex: 2, totalItems: 2 } } } } } });
	const html = page({ state, grid: [1] }).replace("</ul>", '<li><article data-card-title="Unavailable Synthetic Film"><span>Unavailable</span></article></li></ul>');
	const w = world(html);
	try {
		w.command("start");
		const r = w.command("stop");
		const unavailable = r.envelope.items.find((i) => i.title === "Unavailable Synthetic Film");
		assert.equal(unavailable.sourceId, gti(6));
		assert.equal(unavailable.sourceUrl, undefined);
		assert.ok(r.reasons.includes("structured_not_seen_visible"));
		assert.equal(r.report.counts.withoutDetailLink, 1);
	} finally {
		w.close();
	}
});

test("seasons report whether an explicit show parent was present", async () => {
	const withParent = { ...entity(3), showId: gti(2) };
	const state = hydration({ page: { viewOutput: { features: { "legacy-watchlist": { content: { items: [entity(2), withParent], nextPageStartIndex: 2, totalItems: 2 } }, ...ALL } } } });
	const w = world(page({ state, grid: [2, 3] }));
	try {
		w.command("start");
		const r = w.command("stop");
		assert.equal(r.report.counts.seasons, 1);
		assert.equal(r.report.counts.seasonsWithParent, 1);
		assert.equal(r.completeness, "complete", JSON.stringify(r.reasons));
	} finally {
		w.close();
	}
});

test("a reload loses the capture: a fresh page reports idle, never a stale file", async () => {
	const w = world(page({ state: hydration({ page: p1 }), grid: [1, 2] }));
	try {
		w.command("start");
	} finally {
		w.close();
	}
	const fresh = new Window({ url: EU });
	try {
		assert.equal(typeof fresh.__goodwatchPrimeCommand, "undefined", "nothing survives a reload; the popup probe shows idle");
	} finally {
		fresh.happyDOM.abort();
		fresh.close();
	}
});

// Regressions from the 2026-10-19 review of version 0.1.0.

test("review: a terminal flag on a second Watchlist collection doesn't end the main chain", async () => {
	const state = hydration({
		page: { watchlist: { items: [entity(1), entity(2)], hasMoreItems: true }, watchlistRecent: { recentlyAddedItems: [entity(1)], pagination: null } },
	});
	const w = world(page({ state, grid: [1, 2] }));
	try {
		w.command("start");
		const r = w.command("stop");
		assert.notEqual(r.completeness, "complete");
		assert.ok(r.reasons.includes("continuation_pending"));
	} finally {
		w.close();
	}
});

test("review: a null paginator is no evidence of the end", () => {
	const w = new Window({ url: EU });
	try {
		w.eval(read("extract.js"));
		assert.equal(w.__goodwatchPrimeExtract.pagination([{ pagination: null }]).terminal, null);
	} finally {
		w.happyDOM.abort();
		w.close();
	}
});

test("review: dotted Amazon IDs, slugs and title keys are redacted in the report", async () => {
	const odd = { byTitle: { "the-synthetic-movie": { a: 1 }, "Synthetic Movie": { a: 1 }, B0SHORT1: 1, okKey: 1 } };
	const w = world(page({ state: hydration({ page: viewOutputPage([1], { next: 1, total: 1 }) }), grid: [1] }), EU, {
		"/region/eu/api/amzn1.dv.gti.00000000-0000-4000-8000-000000000009/watchlist": odd,
	});
	try {
		w.command("start");
		await w.load("/region/eu/api/amzn1.dv.gti.00000000-0000-4000-8000-000000000009/watchlist");
		const rep = w.command("stop").report;
		const text = JSON.stringify(rep);
		for (const leak of ["amzn1.dv.gti.0", "synthetic-movie", "Synthetic", "B0SHORT1"]) {
			const at = text.indexOf(leak);
			assert.equal(at, -1, `${leak} leaks: ${text.slice(Math.max(0, at - 120), at + 40)}`);
		}
		assert.ok(!text.includes("okKey"), "keys outside the report vocabulary are counted, not named");
		assert.equal(w.window.__goodwatchPrimeExtract.redactPath("/region/eu/api/amzn1.dv.gti.00000000-0000-4000-8000-000000000009/watchlist"), "/region/eu/api/<seg>/watchlist");
		assert.equal(w.window.__goodwatchPrimeExtract.redactPath("/gp/video/detail/B0ABCDEF12/"), "/gp/video/detail/<seg>/");
	} finally {
		w.close();
	}
});

test("review: a card with a play link and a title link is read once with its card-level title", async () => {
	const html = page({ state: hydration({ page: viewOutputPage([1], { next: 1, total: 1 }) }), grid: [] }).replace(
		'<ul role="list" data-testid="watchlist-grid" id="grid"></ul>',
		`<ul role="list" id="grid"><li><article><a href="/region/eu/detail/${token(1)}/ref=play" aria-label="Play Synthetic Movie"><img alt="Synthetic Movie"></a><a href="/region/eu/detail/${token(1)}/" aria-label="Synthetic Movie">Synthetic Movie</a></article></li></ul>`,
	);
	const w = world(html);
	try {
		w.command("start");
		const r = w.command("stop");
		assert.equal(r.completeness, "complete", JSON.stringify(r.reasons));
		assert.equal(r.report.counts.quarantined, 0);
		assert.equal(r.report.counts.titleDisagreements, 0);
	} finally {
		w.close();
	}
});

test("review: a card linking to two different titles is skipped, not merged", async () => {
	const html = page({ state: hydration({ page: viewOutputPage([1], { next: 1, total: 1 }) }), grid: [1] }).replace(
		"</ul>",
		`<li><article data-card-title="Mixed"><a href="/region/eu/detail/${token(2)}/"></a><a href="/region/eu/detail/${token(4)}/"></a></article></li></ul>`,
	);
	const w = world(html);
	try {
		w.command("start");
		const r = w.command("stop");
		assert.ok(r.report.counts.rejectedCardSightings.card_conflicting_links >= 1);
		assert.deepEqual(r.envelope.items.map((i) => i.title), ["Synthetic Movie"]);
	} finally {
		w.close();
	}
});

test("review: a Watchlist nested under a profile key is still the Watchlist", async () => {
	// The Watchlist filter sits beside the Watchlist, inside the profile object.
	const state = { props: { profiles: { "synthetic-profile-a": { watchlist: { items: [entity(1)], hasMoreItems: false }, ...ALL } }, cerberus: { activeProfile: { id: "p" } } } };
	const w = world(page({ state, grid: [1] }));
	try {
		w.command("start");
		const r = w.command("stop");
		assert.equal(r.counts.structured, 1);
		assert.equal(r.completeness, "complete", JSON.stringify(r.reasons));
	} finally {
		w.close();
	}
});

// "A retried response" tested the 0.2.0 response reader; see r3-1.

test("review: a live entry counted in the reported total isn't a total mismatch", async () => {
	const w = world(page({ state: hydration({ page: viewOutputPage([1, 70], { next: 2, total: 2 }) }), grid: [1] }));
	try {
		w.command("start");
		const r = w.command("stop");
		assert.ok(!r.reasons.includes("total_mismatch"), JSON.stringify(r.reasons));
	} finally {
		w.close();
	}
});

test("review: with a state profile marker, a header label change still discards the capture", async () => {
	const w = world(page({ state: hydration({ page: p1 }), grid: [1, 2] }));
	try {
		assert.equal(w.command("start").profileGuard, "state+dom");
		w.document.querySelector('[data-testid="pv-nav-profile-button"]').setAttribute("aria-label", "Profile: Other");
		await w.flush();
		assert.equal(w.command("status").code, "terminated_profile");
	} finally {
		w.close();
	}
});

test("review: a later group overlapping the page data better than the chosen one is flagged", async () => {
	// At Start only a recommendation row is rendered; the grid arrives later.
	const html = page({ state: hydration({ page: viewOutputPage([1, 2], { next: 2, total: 2 }) }), grid: [] });
	const w = world(html);
	try {
		w.command("start");
		w.document.getElementById("grid").insertAdjacentHTML("beforeend", card(1) + card(2));
		await w.flush();
		const r = w.command("stop");
		assert.ok(r.reasons.includes("visible_group_contested") || r.reasons.includes("visible_group_unconfirmed"), JSON.stringify(r.reasons));
		assert.notEqual(r.completeness, "complete");
	} finally {
		w.close();
	}
});
