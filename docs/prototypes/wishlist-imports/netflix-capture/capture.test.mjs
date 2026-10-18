import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { test } from "node:test";
import { Window } from "happy-dom";
const source = () =>
	readFileSync(new URL("./capture.js", import.meta.url), "utf8");
const fixture = readFileSync(
	new URL("./fixtures/my-list.html", import.meta.url),
	"utf8",
);
function world(
	html = fixture,
	url = "https://www.netflix.com/browse/my-list?view=grid",
) {
	const window = new Window({ url });
	window.document.write(html);
	const callbacks = new Map();
	let id = 0;
	let now = 1000;
	const context = vm.createContext({
		document: window.document,
		location: window.location,
		MutationObserver: window.MutationObserver,
		URL,
		Date: class extends Date {
			static now() {
				return now;
			}
		},
		setInterval: (fn) => {
			callbacks.set(++id, fn);
			return id;
		},
		clearInterval: (key) => callbacks.delete(key),
		setTimeout: (fn) => {
			callbacks.set(++id, fn);
			return id;
		},
		clearTimeout: (key) => callbacks.delete(key),
	});
	vm.runInContext(source(), context);
	return {
		window,
		context,
		command: (args) => context.__goodwatchWishlistCaptureCommand(args),
		tick(ms = 500) {
			now += ms;
			for (const fn of [...callbacks.values()]) fn();
		},
		close() {
			window.happyDOM.abort();
			window.close();
		},
	};
}
test("captures explicit card identity only inside one My List boundary with unknown type and sanitized URLs", () => {
	const w = world();
	try {
		const result = w.command({ action: "start" });
		assert.equal(result.state, "capturing");
		const items = result.envelope.items;
		assert.deepEqual(
			Array.from(items, (x) => [x.title, x.sourceId, x.sourceUrl, x.mediaType]),
			[
				[
					"Synthetic movie",
					"1001",
					"https://www.netflix.com/title/1001",
					"unknown",
				],
				[
					"Synthetic show",
					"1002",
					"https://www.netflix.com/title/1002",
					"unknown",
				],
			],
		);
		assert.equal(result.envelope.completeness, "unknown");
		assert.ok(items.every((x) => !("tmdbId" in x) && !("imdbId" in x)));
		assert.equal(result.profileGuard, true);
	} finally {
		w.close();
	}
});
function card(id, title, extra = "") {
	return `<div class="ptrack-content" data-ui-tracking-context='{"video_id":"${id}"}'><a href="/title/${id}"><span class="fallback-text">${title}</span></a>${extra}</div>`;
}
const settle = () => new Promise((resolve) => setTimeout(resolve, 10));
test("incrementally retains recycled cards and keeps same-title distinct IDs", async () => {
	const w = world();
	try {
		w.command({ action: "start" });
		w.window.document.querySelector(".gallery").innerHTML = card(
			"1003",
			"Synthetic movie",
		);
		await settle();
		const result = w.command({ action: "status" });
		assert.equal(result.observedCount, 3);
		assert.deepEqual(
			Array.from(result.envelope.items, (x) => x.sourceId),
			["1001", "1002", "1003"],
		);
		assert.equal(
			result.envelope.items.filter((x) => x.title === "Synthetic movie").length,
			2,
		);
	} finally {
		w.close();
	}
});
test("rejects conflicting, malformed, external and playback-only identity without guessing", () => {
	const w = world(
		`<main class="mainView"><section class="gallery">${card("1001", "Conflict", '<a href="/title/2222">Other identity</a>')}${card("1002", "External").replace("/title/1002", "https://evil.test/title/1002")}${card("1003", "Bad numeric").replace("/title/1003", "/title/1003junk")}<div class="ptrack-content"><a href="/watch/4004"><span class="fallback-text">Playback only</span></a></div><div class="ptrack-content" data-ui-tracking-context="invalid"><a href="/title/5005"><span class="fallback-text">Malformed</span></a></div></section></main>`,
	);
	try {
		const result = w.command({ action: "start" });
		assert.equal(result.observedCount, 0);
		assert.equal(result.rejectedCount, 5);
		assert.equal(w.command({ action: "status" }).rejectedCount, 5);
	} finally {
		w.close();
	}
});
test("excludes nested recommendations and overlays from the selected list", () => {
	const w = world(
		fixture.replace(
			'</section><section class="recommendations">',
			`<aside class="recommendations">${card("3333", "Nested recommendation")}</aside><div role="dialog">${card("4444", "Overlay")}</div></section><section class="recommendations">`,
		),
	);
	try {
		const result = w.command({ action: "start" });
		assert.equal(result.observedCount, 2);
	} finally {
		w.close();
	}
});
test("terminates and discards capture when navigation or profile changes", async () => {
	for (const change of [
		(w) => (w.window.location.href = "https://www.netflix.com/browse"),
		(w) =>
			w.window.document
				.querySelector(".profile-icon")
				.setAttribute("alt", "Another profile"),
	]) {
		const w = world();
		try {
			w.command({ action: "start" });
			change(w);
			w.tick();
			await settle();
			const result = w.command({ action: "status" });
			assert.equal(result.state, "terminated");
			assert.equal(result.observedCount, 0);
			assert.equal(result.envelope, undefined);
		} finally {
			w.close();
		}
	}
});
test("fails closed for unsupported pages and absent or ambiguous boundaries", () => {
	for (const [html, url, code] of [
		[fixture, "https://netflix.com/browse/my-list", "wrong_page"],
		[fixture, "https://www.netflix.com/browse/my-list/extra", "wrong_page"],
		[
			"<main></main>",
			"https://www.netflix.com/browse/my-list",
			"boundary_missing",
		],
		[
			fixture.replace("</main>", '<section class="gallery"></section></main>'),
			"https://www.netflix.com/browse/my-list",
			"boundary_ambiguous",
		],
	]) {
		const w = world(html, url);
		try {
			assert.equal(w.command({ action: "start" }).code, code);
		} finally {
			w.close();
		}
	}
});
test("keeps a bounded partial receipt on list-boundary loss and lifetime limit; cancel discards", () => {
	for (const reason of ["boundary", "time"]) {
		const w = world();
		try {
			w.command({ action: "start" });
			if (reason === "boundary")
				w.window.document.querySelector(".gallery").remove();
			else w.tick(600001);
			const result = w.command({ action: "status" });
			assert.equal(result.state, "terminated");
			assert.equal(result.envelope.completeness, "partial");
			assert.equal(result.observedCount, 2);
			assert.equal(w.command({ action: "cancel" }).envelope, undefined);
			assert.equal(w.command({ action: "status" }).observedCount, 0);
		} finally {
			w.close();
		}
	}
});
test("reinjecting the script preserves singleton capture and stop returns download-ready envelope", () => {
	const w = world();
	try {
		w.command({ action: "start" });
		const original = w.context.__goodwatchWishlistCaptureCommand;
		vm.runInContext(source(), w.context);
		assert.equal(original, w.context.__goodwatchWishlistCaptureCommand);
		const result = w.command({ action: "stop" });
		assert.equal(result.state, "stopped");
		assert.equal(result.envelope.format, "goodwatch-wishlist");
		assert.equal(result.envelope.version, 1);
		assert.equal(result.envelope.source, "netflix");
		assert.equal(result.envelope.completeness, "unknown");
	} finally {
		w.close();
	}
});
test("conflicting later identity evidence quarantines IDs for the whole capture", async () => {
	const w = world();
	try {
		w.command({ action: "start" });
		w.window.document.querySelector(".gallery").innerHTML = card(
			"1001",
			"Changed title",
		);
		await settle();
		assert.equal(
			w
				.command({ action: "status" })
				.envelope.items.some((x) => x.sourceId === "1001"),
			false,
		);
		w.window.document.querySelector(".gallery").innerHTML = card(
			"1001",
			"Synthetic movie",
		);
		await settle();
		assert.equal(
			w
				.command({ action: "status" })
				.envelope.items.some((x) => x.sourceId === "1001"),
			false,
		);
	} finally {
		w.close();
	}
});
test("accepts raw and once URI-encoded bounded tracking JSON; retains strongest source URL", async () => {
	const w = world();
	try {
		w.window.document
			.querySelector(".ptrack-content")
			.setAttribute(
				"data-ui-tracking-context",
				encodeURIComponent('{"video_id":"1001"}'),
			);
		assert.equal(w.command({ action: "start" }).observedCount, 2);
		w.window.document.querySelector(".gallery").innerHTML =
			'<div class="ptrack-content" data-ui-tracking-context=\'{"video_id":"1001"}\'><span class="fallback-text">Synthetic movie</span></div>';
		await settle();
		assert.equal(
			w
				.command({ action: "status" })
				.envelope.items.find((x) => x.sourceId === "1001").sourceUrl,
			"https://www.netflix.com/title/1001",
		);
	} finally {
		w.close();
	}
});
test("quarantines both IDs after contradictory card evidence and rejects raw URL controls/backslashes", async () => {
	const w = world();
	try {
		w.command({ action: "start" });
		w.window.document.querySelector(".gallery").innerHTML = card(
			"1001",
			"Synthetic movie",
			'<a href="/title/1002">Contradictory ID</a>',
		);
		await settle();
		assert.equal(w.command({ action: "status" }).observedCount, 0);
		w.window.document.querySelector(".gallery").innerHTML =
			card("1001", "Synthetic movie") + card("1002", "Synthetic show");
		await settle();
		assert.equal(w.command({ action: "status" }).observedCount, 0);
	} finally {
		w.close();
	}
	for (const href of [
		"https:\\www.netflix.com/title/1001",
		"https://www.net\nflix.com/title/1001",
		"/title/1001\t",
	]) {
		const w = world();
		try {
			w.window.document
				.querySelector(".ptrack-content a")
				.setAttribute("href", href);
			const result = w.command({ action: "start" });
			assert.equal(result.observedCount, 1);
			assert.ok(
				Array.from(result.issues).some((x) => x.code === "card_invalid_link"),
			);
		} finally {
			w.close();
		}
	}
});

test("stopped captures discard their receipt if profile or navigation changes before download", () => {
	const w = world();
	try {
		w.command({ action: "start" });
		w.command({ action: "stop" });
		w.window.location.href = "https://www.netflix.com/browse";
		const result = w.command({ action: "status" });
		assert.equal(result.state, "terminated");
		assert.equal(result.observedCount, 0);
		assert.equal(result.envelope, undefined);
	} finally {
		w.close();
	}
});
test("stops at the row cap with a partial envelope rather than claiming completeness", () => {
	const w = world(
		'<main class="mainView"><section class="gallery">' +
			Array.from({ length: 5001 }, (_, i) =>
				card(String(i + 1), "Synthetic " + i),
			).join("") +
			"</section></main>",
	);
	try {
		const result = w.command({ action: "start" });
		assert.equal(result.code, "limit_rows");
		assert.equal(result.observedCount, 5000);
		assert.equal(result.envelope.completeness, "partial");
	} finally {
		w.close();
	}
});

const hubFixture = readFileSync(new URL('./fixtures/my-netflix-hub.html', import.meta.url), 'utf8');
test('captures only the exact Meine Liste semantic row inside a synthetic multi-row hub', () => {
 const w = world(hubFixture);
 try {
  const result = w.command({action:'start'});
  assert.equal(result.state, 'capturing');
  assert.deepEqual(Array.from(result.envelope.items, item => item.sourceId), ['1001','1002']);
  assert.equal(result.envelope.completeness, 'unknown');
 } finally { w.close(); }
});

test('refuses a hub-shaped ancestor wrapper even when its own heading says My List', () => {
 const w=world(`<main class="mainView"><div class="rowContainer"><h2>My List</h2>${card('1001','Unbounded direct card')}<section class="lolomoRow"><h2>Continue watching</h2>${card('9001','Outside row')}</section></div></main>`);
 try { assert.notEqual(w.command({action:'start'}).state,'capturing'); } finally {w.close();}
});

test('rejects duplicate, prefixed, card-local and broad-wrapper heading evidence', () => {
 const cases = [
  `<div class="lolomoRow"><h2>My List</h2><h3>My List</h3>${card('1001','One')}</div>`,
  `<div class="rowContainer"><h2>My List</h2>${card('1001','One')}<h2>Continue watching</h2>${card('9001','Other')}</div>`,
  `<div class="lolomoRow"><h2>My List recommendations</h2>${card('1001','One')}</div>`,
  `<div class="lolomoRow">${card('1001','One')}<div class="ptrack-content"><h2>My List</h2></div></div>`,
  `<div class="lolomoRow"><h2>My List</h2>${card('1001','One')}</div><div class="rowContainer"><h2>Meine Liste</h2>${card('1002','Two')}</div>`,
 ];
 for(const html of cases) {
  const w=world(`<main class="mainView">${html}</main>`);
  try {assert.notEqual(w.command({action:'start'}).state,'capturing');} finally {w.close();}
 }
});
test('row scope excludes hard-excluded nested content and supports structural containers', () => {
 const w=world(`<main class="mainView"><div class="lolomoRow"><h2>My List</h2><div class="rowContainer">${card('1001','One')}</div><div class="recommendations"><div class="lolomoRow"><h2>My List</h2>${card('9001','Other')}</div></div><div role="dialog">${card('9002','Dialog')}</div></div></main>`);
 try {
  const result=w.command({action:'start'});
  assert.equal(result.state,'capturing');
  assert.deepEqual(Array.from(result.envelope.items,item=>item.sourceId),['1001']);
 } finally {w.close();}
});
test('row identity and exact heading are revalidated before accumulating more cards', () => {
 for(const change of [
  row=>row.remove(),
  row=>row.querySelector('.row-header-title').textContent='Continue watching',
  row=>row.insertAdjacentHTML('beforeend','<h2>My List</h2>'),
  row=>row.parentElement.insertAdjacentHTML('beforeend','<section class="lolomoRow"><h2>My List</h2></section>'),
 ]) {
  const w=world(hubFixture);
  try {
   w.command({action:'start'});
   const row=w.window.document.querySelector('#synthetic-my-list');
   change(row);
   row.insertAdjacentHTML('beforeend',card('9005','Changed context'));
   const result=w.command({action:'status'});
   assert.equal(result.code,'terminated_boundary');
   assert.equal(result.envelope.completeness,'partial');
   assert.deepEqual(Array.from(result.envelope.items,item=>item.sourceId),['1001','1002']);
  } finally {w.close();}
 }
});
test('horizontal row recycling accumulates only its own cards and keeps navigation/profile guards', () => {
 for(const guard of ['navigation','profile']) {
  const w=world(hubFixture);
  try {
   w.command({action:'start'});
   w.window.document.querySelector('#synthetic-my-list .slider').innerHTML=card('1003','Third');
   w.tick();
   assert.deepEqual(Array.from(w.command({action:'status'}).envelope.items,item=>item.sourceId),['1001','1002','1003']);
   if(guard==='navigation')w.window.location.href='https://www.netflix.com/browse';
   else w.window.document.querySelector('.profile-icon').setAttribute('src','/changed.png');
   const result=w.command({action:'status'});
   assert.equal(result.code,`terminated_${guard}`);
   assert.equal(result.envelope,undefined);
  } finally {w.close();}
 }
});

test('excludes nested semantic rows before their headings mount', () => {
 const w=world(`<main class="mainView"><section class="lolomoRow"><h2>My List</h2>${card('1001','One')}<section class="lolomoRow">${card('9001','Unrelated pending heading')}</section></section></main>`);
 try {
  const result=w.command({action:'start'});
  assert.equal(result.state,'capturing');
  assert.deepEqual(Array.from(result.envelope.items,item=>item.sourceId),['1001']);
 } finally {w.close();}
});
