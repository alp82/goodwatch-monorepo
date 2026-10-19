// Reproductions from the fourth review (of 541b346a). Each was committed
// failing on 541b346a before its fix.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { Window } from "happy-dom";
import { entity, hydration, page, viewOutputPage } from "./fixtures/synthetic.mjs";

const read = (name) => readFileSync(new URL(`./${name}`, import.meta.url), "utf8");
const plain = (v) => (v === undefined ? v : JSON.parse(JSON.stringify(v)));
const EU = "https://www.primevideo.com/region/eu/mystuff/watchlist";
const VIEW_ALL = { "view-filter": { filters: [{ viewType: "all", active: true }, { viewType: "movie", active: false }] } };

function world(html) {
	const window = new Window({ url: EU });
	window.document.write(html);
	window.eval(read("extract.js"));
	window.eval(read("collector.js"));
	return {
		window,
		document: window.document,
		command: (action, extra = {}) => plain(window.__goodwatchPrimeCommand({ action, ...extra })),
		flush: (ms = 150) => new Promise((r) => setTimeout(r, ms)),
		close() {
			window.happyDOM.abort();
			window.close();
		},
	};
}

/** A one-page Watchlist whose own object carries the given pagination fields. */
function watchlist(ids, pagination, filters = VIEW_ALL) {
	return { viewOutput: { features: { "legacy-watchlist": { content: { items: ids.map((n) => entity(n)), ...pagination } }, ...filters } } };
}

test("r4-1a: a script changed in place from a last page to hasMoreItems:true withholds complete", async () => {
	const w = world(page({ state: hydration({ page: watchlist([1], { hasMoreItems: false, totalItems: 1 }) }), grid: [1] }));
	try {
		assert.equal(w.command("start").completeness, "complete");
		const script = w.document.querySelector('script[type="text/template"]');
		script.textContent = script.textContent.replace('"hasMoreItems":false', '"hasMoreItems":true');
		await w.flush();
		const r = w.command("stop");
		assert.notEqual(r.completeness, "complete", JSON.stringify(r.reasons));
	} finally {
		w.close();
	}
});

test("r4-1b: a total changed in place is noticed", async () => {
	const w = world(page({ state: hydration({ page: watchlist([1], { hasMoreItems: false, totalItems: 1 }) }), grid: [1] }));
	try {
		w.command("start");
		const script = w.document.querySelector('script[type="text/template"]');
		script.textContent = script.textContent.replace('"totalItems":1', '"totalItems":2');
		await w.flush();
		const r = w.command("stop");
		assert.notEqual(r.completeness, "complete", JSON.stringify(r.reasons));
	} finally {
		w.close();
	}
});

test("r4-2: an unrelated filter beside the Watchlist doesn't confirm the All view", async () => {
	const audio = { audioLanguage: { filters: [{ id: "all", selected: true }, { id: "de", selected: false }] } };
	const w = world(page({ state: hydration({ page: watchlist([1, 2], { hasMoreItems: false, totalItems: 2 }, audio) }), grid: [1, 2] }));
	try {
		w.command("start");
		const r = w.command("stop");
		assert.ok(r.reasons.includes("all_view_unconfirmed"), JSON.stringify(r.reasons));
	} finally {
		w.close();
	}
});

test("r4-3: a last page without a reported total withholds complete", async () => {
	const w = world(page({ state: hydration({ page: watchlist([1, 2], { hasMoreItems: false }) }), grid: [1, 2] }));
	try {
		w.command("start");
		const r = w.command("stop");
		assert.notEqual(r.completeness, "complete", JSON.stringify(r.reasons));
		assert.ok(r.reasons.includes("no_reported_total"), JSON.stringify(r.reasons));
	} finally {
		w.close();
	}
});

test("r4: a last page with a matching total, the view filter and cards is still complete", async () => {
	const w = world(page({ state: hydration({ page: viewOutputPage([1, 2], { next: 2, total: 2 }) }), grid: [1, 2] }));
	try {
		w.command("start");
		const r = w.command("stop");
		assert.equal(r.completeness, "complete", JSON.stringify(r.reasons));
	} finally {
		w.close();
	}
});
