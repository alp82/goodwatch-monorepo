import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { Window } from "happy-dom";
import { card, entity, gti, hydration, page, token, viewOutputPage } from "./fixtures/synthetic.mjs";

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
	window.__goodwatchPrimeObserverArgs = ["nonce-test"];
	window.eval(read("observer.js"));
	const flush = () => new Promise((r) => setTimeout(r, 20));
	return {
		window,
		document: window.document,
		command: (action, extra = {}) => plain(window.__goodwatchPrimeCommand({ action, nonce: "nonce-test", ...extra })),
		// Simulates the page loading its next Watchlist page and rendering it.
		async load(path, { show = [], hide = [] } = {}) {
			await window.fetch(path);
			await flush();
			const grid = window.document.getElementById("grid");
			for (const n of hide) grid.querySelector(`a[href*="${token(n)}"]`)?.closest("li").remove();
			grid.insertAdjacentHTML("beforeend", show.map((n) => card(n)).join(""));
			await flush();
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
const routes = { "/region/eu/api/watchlist/page2": p2, "/region/eu/api/watchlist/page3": p3 };

async function fullRun(w) {
	assert.equal(w.command("start").state, "capturing");
	await w.load("/region/eu/api/watchlist/page2", { show: [3, 4], hide: [1, 2] });
	await w.load("/region/eu/api/watchlist/page3", { show: [5], hide: [3] });
	return w.command("stop");
}

test("mixed two-page-plus-terminal Watchlist is complete, keeps native IDs and excludes library, recommendations and nav", async () => {
	const w = world(page({ state: hydration({ page: p1 }), grid: [1, 2] }), EU, routes);
	try {
		const r = await fullRun(w);
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
		assert.equal(rep.pagination.pages.length, 3);
		assert.deepEqual(rep.pagination.reportedTotals, [5]);
		assert.equal(rep.profileGuard, "state");
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

test("stopping before the terminal page is partial with continuation_pending", async () => {
	const w = world(page({ state: hydration({ page: p1 }), grid: [1, 2] }), EU, routes);
	try {
		w.command("start");
		await w.load("/region/eu/api/watchlist/page2", { show: [3, 4] });
		const r = w.command("stop");
		assert.equal(r.completeness, "partial");
		assert.ok(r.reasons.includes("continuation_pending"));
		assert.equal(r.envelope.items.length, 4);
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
	const w = world(page({ state: hydration({ page: p1 }), grid: [1, 2] }), EU, { "/region/eu/api/watchlist/page2": loop });
	try {
		w.command("start");
		await w.load("/region/eu/api/watchlist/page2", { show: [3] });
		const r = w.command("stop");
		assert.ok(r.reasons.includes("cursor_repeated"));
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
		assert.equal(r.report.pagination.duplicateStatePages, 1);
	} finally {
		w.close();
	}
});

test("a missed response leaves visible cards outside the structured set: partial", async () => {
	const w = world(page({ state: hydration({ page: p1 }), grid: [1, 2] }), EU, routes);
	try {
		w.command("start");
		// Page 2 rendered without its response being observed (requested before Start).
		w.document.getElementById("grid").insertAdjacentHTML("beforeend", card(3) + card(4));
		await w.load("/region/eu/api/watchlist/page3", { show: [5] });
		const r = w.command("stop");
		assert.equal(r.completeness, "partial");
		assert.ok(r.reasons.includes("visible_not_in_structured"));
		assert.ok(r.reasons.includes("total_mismatch"));
		assert.equal(r.envelope.items.length, 5, "visible members are still offered");
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
		w.document.querySelector('[data-testid="pv-nav-profile-button"] img').setAttribute("src", "/avatar-b.png");
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
		assert.equal(r.envelope.items.length, 2, "the recommendation row is not taken as membership");
		assert.ok(r.envelope.items.every((i) => i.sourceId.startsWith("0SYNTH")), "card-only items keep the detail token");
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

test("an unreadable Watchlist response marks the capture unknown", async () => {
	const w = world(page({ state: hydration({ page: viewOutputPage([1], { next: 1, total: 1 }) }), grid: [1] }), EU, {
		"/region/eu/api/watchlist/odd": { something: { else: [1, 2, 3] } },
	});
	try {
		w.command("start");
		await w.load("/region/eu/api/watchlist/odd");
		const r = w.command("stop");
		assert.ok(r.reasons.includes("unknown_response_schema"));
		assert.equal(r.report.responses[0].parsed, true);
		assert.ok(r.report.responses[0].shape.something, "response shape is kept for offline fixes");
	} finally {
		w.close();
	}
});

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
		assert.equal(c.command("status", { report: true }).report.responses.length, 0);
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
	const state = hydration({ page: { viewOutput: { features: { "legacy-watchlist": { content: { items: [entity(2), withParent], nextPageStartIndex: 2, totalItems: 2 } } } } } });
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
