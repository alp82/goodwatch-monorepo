// The streaming services as they are drawn: home's two tiles after the apps, "On <service>" with the service's
// mark and its titles in a row that pages, and both Remotes' two keys. The items in the markup are the machine's,
// in its order, in both editions; a service the Remote has a drawn mark for shows it, any other the catalog's
// logo, and one without either its name.
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { test } from "node:test"

type Drawn = { desktop: string; phone: string; items: string[] }
type Remotes = { desktop: string; hand: string; table: string }
const rendered = JSON.parse(
	execFileSync(
		"node_modules/.bin/vite-node",
		[
			"--config",
			"app/ui/imports/source-import-test-vite.config.ts",
			"app/ui/living-room/tv/tv-service-render.test-support.tsx",
		],
		{ encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
	)
		.split("__TV_SERVICE_RENDER__")
		.at(-1) ?? "",
) as {
	home: Record<
		| "guest"
		| "customServices"
		| "withPool"
		| "onNetflix"
		| "onDisney"
		| "onPlain"
		| "none",
		Drawn
	>
	service: Record<
		| "netflix"
		| "prime"
		| "disney"
		| "plain"
		| "linked"
		| "unknown"
		| "second"
		| "long"
		| "last"
		| "one"
		| "waiting"
		| "unreported"
		| "stale"
		| "none",
		Drawn
	>
	phones: {
		phone: string
		scale: number
		h: number
		list: string
		logo: string
	}[]
	first: string
	remotes: Record<"drawn" | "logos" | "open" | "other" | "one", Remotes> & {
		old: string
	}
}

/** The item ids in the markup, in its order. */
const ids = (html: string) =>
	[...html.matchAll(/data-tv-item="([^"]+)"/g)].map((match) => match[1])
const focused = (html: string) =>
	[...html.matchAll(/data-tv-item="([^"]+)" aria-current="true"/g)].map(
		(match) => match[1],
	)
const count = (html: string, part: string) => html.split(part).length - 1
/** A screen's own items and its bar's, without the Expand key: for the lists written out here. */
const drawn = (items: string[]) => items.filter((item) => item !== "expand")
/** An item with what is in it. */
const item = (html: string, id: string) =>
	new RegExp(`<button[^>]*data-tv-item="${id}"[^>]*>.*?</button>`).exec(
		html,
	)?.[0] ?? ""
/** The marks in a piece of markup: "drawn" or "logo", in its order. */
const marks = (html: string) =>
	[...html.matchAll(/data-service-mark="([a-z]+)"/g)].map((match) => match[1])
const BAR = ["bar:back", "bar:search", "bar:menu"]
const EDITIONS = ["desktop", "phone"] as const
const NETFLIX_RED = "#e50914"
const PRIME_BLUE = "#1a98ff"

// ---- Home.

test("home's items in the markup are the machine's: the apps, then a tile per service, then the bar", () => {
	for (const screen of Object.values(rendered.home))
		for (const edition of EDITIONS)
			assert.deepEqual(ids(screen[edition]), screen.items)
	assert.deepEqual(rendered.home.guest.items, [
		"app:tonight",
		"app:discover",
		"app:taste",
		"service:8",
		"service:337",
		"bar:search",
		"bar:menu",
	])
	assert.deepEqual(rendered.home.customServices.items.slice(3, 5), [
		"service:337",
		"service:99",
	])
	// Without services home is the apps alone.
	assert.deepEqual(ids(rendered.home.none.desktop), [
		"app:tonight",
		"app:discover",
		"app:taste",
		"bar:search",
		"bar:menu",
	])
})

test("a service's tile shows the Remote's own mark, the catalog's logo with the name, or the name alone", () => {
	for (const edition of EDITIONS) {
		const netflix = item(rendered.home.guest[edition], "service:8")
		assert.deepEqual(marks(netflix), ["drawn"])
		assert.match(netflix, /class="tv-mark tv-mark-8 /)
		// The drawn mark's shape is the stylesheet's: no file's address and no data URL is in the markup.
		assert.ok(!/url\(|\.svg|mask/.test(netflix))
		// The drawn mark says the name: it is not written beside it.
		assert.equal(count(netflix, ">Netflix<"), 0)
		assert.match(netflix, /aria-label="On Netflix"/)
		const disney = item(rendered.home.guest[edition], "service:337")
		assert.deepEqual(marks(disney), ["logo"])
		assert.match(disney, /image\.tmdb\.org\/t\/p\/w92\/disney\.jpg/)
		assert.equal(count(disney, ">Disney+<"), 1)
		const plain = item(rendered.home.customServices[edition], "service:99")
		assert.deepEqual(marks(plain), [])
		assert.equal(count(plain, ">Kanopy<"), 1)
		assert.match(plain, /aria-label="On Kanopy"/)
	}
})

test("before the pool a service's tile is its own colour, or the dark of the room; with it, a picture from that service", () => {
	for (const edition of EDITIONS) {
		const before = rendered.home.guest[edition]
		assert.match(item(before, "service:8"), new RegExp(NETFLIX_RED))
		assert.ok(!/<img[^>]*backdrop/.test(item(before, "service:8")))
		assert.ok(
			!new RegExp(NETFLIX_RED).test(
				item(before, "service:337").replace(/data-service-mark.*/, ""),
			),
		)
		const after = rendered.home.withPool[edition]
		// The pool's second title streams on both; Disney+ takes the next one that streams there.
		assert.match(item(after, "service:8"), /backdrop-2\.jpg/)
		assert.match(item(after, "service:337"), /backdrop-3\.jpg/)
	}
})

test("with the focus on a service's tile, home shows the service large: its name, what it opens, its picture", () => {
	for (const edition of EDITIONS) {
		const netflix = rendered.home.onNetflix[edition]
		assert.deepEqual(focused(netflix), ["service:8"])
		assert.equal(count(netflix, ">Netflix</div>"), 1)
		assert.equal(count(netflix, "What to watch on Netflix."), 1)
		// The picture behind everything is the tile's, in the size of the whole picture.
		assert.match(
			netflix,
			edition === "desktop"
				? /w1280\/backdrop-2\.jpg/
				: /w780\/backdrop-2\.jpg/,
		)
		const disney = rendered.home.onDisney[edition]
		assert.equal(count(disney, "What to watch on Disney+."), 1)
		const plain = rendered.home.onPlain[edition]
		assert.equal(count(plain, "What to watch on Kanopy."), 1)
		// One H1, the start page's, whatever has the focus.
		assert.equal(count(netflix, "<h1"), 1)
	}
})

test("the server's HTML of a guest's home has nothing of the guest but the country's two services", () => {
	// Drawn twice from the same data, it is the same.
	const { guest } = rendered.home
	assert.ok(guest.desktop.includes('data-tv-item="service:8"'))
	assert.ok(!/backdrop-\d/.test(item(guest.desktop, "service:8")))
})

// ---- "On <service>".

test("the service screen's items in the markup are the machine's, in reading order, in both editions", () => {
	for (const screen of Object.values(rendered.service))
		for (const edition of EDITIONS)
			assert.deepEqual(ids(screen[edition]), screen.items)
	const { netflix } = rendered.service
	assert.equal(netflix.items.length, 12 + 1 + 3)
	assert.deepEqual(netflix.items.slice(0, 4), [
		"title:movie-161",
		"title:movie-388",
		"title:show-1399",
		"title:movie-120",
	])
	assert.deepEqual(netflix.items.slice(12), ["expand", ...BAR])
	// Twelve posters in one row that pages.
	for (const edition of EDITIONS) {
		assert.equal(count(netflix[edition], "data-tv-row"), 1)
		assert.equal(count(netflix[edition], "/poster-"), 12)
	}
})

test("the screen leads with the service's mark and has a line of its colour along the top", () => {
	const head = (html: string) =>
		/<span data-tv-service-mark="\d+".*?<\/span>(<\/span>)?/.exec(html)?.[0] ??
		""
	const edge = (html: string) =>
		/data-tv-edge[^>]*style="background:([^"]+)"/.exec(html)?.[1]
	for (const edition of EDITIONS) {
		const { netflix, prime, disney, plain } = rendered.service
		assert.deepEqual(marks(head(netflix[edition])), ["drawn"])
		assert.match(head(netflix[edition]), /tv-mark-8 /)
		assert.equal(edge(netflix[edition]), NETFLIX_RED)
		assert.match(head(prime[edition]), /tv-mark-9 /)
		assert.equal(edge(prime[edition]), PRIME_BLUE)
		// Any other service: the catalog's logo, and a quiet line.
		assert.deepEqual(marks(head(disney[edition])), ["logo"])
		assert.match(head(disney[edition]), /w92\/disney\.jpg/)
		assert.equal(edge(disney[edition]), "rgba(255,255,255,.3)")
		// A service without a logo is named in words alone.
		assert.equal(head(plain[edition]), "")
		assert.equal(count(plain[edition], "On Kanopy"), 1)
	}
})

test("the top bar says On <service> and how many titles; the phone has room for the mark and a few words", () => {
	const { netflix, disney, one, waiting } = rendered.service
	assert.equal(count(netflix.desktop, ">On Netflix</div>"), 1)
	assert.equal(count(netflix.desktop, ">4,812 titles</div>"), 1)
	assert.equal(count(one.desktop, ">1 title</div>"), 1)
	// No count until Discover has answered.
	assert.equal(count(waiting.desktop, "titles</div>"), 0)
	// The phone: a drawn mark says the name; a logo does not.
	assert.equal(count(netflix.phone, ">To watch</div>"), 1)
	assert.equal(count(netflix.phone, "On Netflix"), 0)
	assert.equal(count(netflix.phone, "4,812"), 0)
	assert.equal(count(disney.phone, ">On Disney+</div>"), 1)
})

test("the list names the focused title with its facts, without where it streams", () => {
	for (const edition of EDITIONS) {
		const { netflix, second, long, last } = rendered.service
		assert.deepEqual(focused(netflix[edition]), ["title:movie-161"])
		assert.match(netflix[edition], /Ocean&#x27;s Eleven<\/div>/)
		assert.equal(
			count(netflix[edition], "2001 · Movie · 1h 56m · 82 score<"),
			1,
		)
		assert.equal(count(netflix[edition], "· On Netflix"), 0)
		assert.equal(
			count(second[edition], "2001 · Movie · 1h 56m · 82 score · 91% match"),
			1,
		)
		assert.match(second[edition], /backdrop-388\.jpg/)
		assert.match(
			long[edition],
			/The Lord of the Rings: The Fellowship of the Ring<\/div>/,
		)
		// The twelfth title.
		assert.deepEqual(focused(last[edition]), ["title:movie-507"])
		assert.match(last[edition], />Title 507<\/div>/)
	}
})

test("a service a link names is named by its titles, and one nobody knows is not named", () => {
	for (const edition of EDITIONS) {
		const { linked, unknown } = rendered.service
		assert.match(linked[edition], /w92\/hulu\.jpg/)
		assert.equal(count(linked[edition], "On Hulu"), 1)
		assert.equal(
			ids(linked[edition]).filter((id) => id.startsWith("title:")).length,
			4,
		)
		assert.equal(marks(unknown[edition]).length, 0)
		assert.equal(count(unknown[edition], "Nothing to watch here right now."), 1)
	}
	assert.equal(count(rendered.service.linked.desktop, ">4 titles</div>"), 1)
	assert.equal(
		count(rendered.service.unknown.desktop, ">On this service</div>"),
		1,
	)
})

test("without titles the list says so, under the service's mark, with the bar", () => {
	for (const edition of EDITIONS) {
		const { waiting, unreported, stale, none } = rendered.service
		for (const screen of [waiting, unreported]) {
			assert.equal(count(screen[edition], "Titles are on their way."), 1)
			assert.deepEqual(ids(screen[edition]), ["expand", ...BAR])
			assert.deepEqual(marks(screen[edition]), ["drawn"])
		}
		// The other service's titles are never shown as this one's.
		assert.equal(count(stale[edition], "Titles are on their way."), 1)
		assert.deepEqual(ids(stale[edition]), ["expand", ...BAR])
		assert.equal(count(stale[edition], "/poster-"), 0)
		assert.match(stale[edition], /w92\/disney\.jpg/)
		assert.equal(
			count(none[edition], "Nothing to watch on Netflix right now."),
			1,
		)
		assert.deepEqual(ids(none[edition]), ["expand", ...BAR])
	}
})

test("the Expand key stands in its corner, and the desktop keeps the band under the posters for it", () => {
	const { netflix } = rendered.service
	for (const edition of EDITIONS) {
		assert.match(
			netflix[edition],
			/<div data-tv-expand-place="true"[^>]*><button type="button" data-tv-item="expand"[^>]*>.*?Expand<\/button><\/div>/,
		)
		assert.equal(count(netflix[edition], 'data-tv-item="expand"'), 1)
	}
	assert.match(netflix.desktop, /pb-\[120px\]/)
	// The phone's last row ends before the corner.
	assert.match(netflix.phone, /pr-\[158px\]/)
})

test("on every phone of the room's table the bar's keys are touch targets and the posters fit the row", () => {
	for (const { phone, scale, list, logo } of rendered.phones) {
		for (const html of [list, logo]) {
			// The bar's keys take their size from `keySize`: 44 px or more on the phone's screen.
			const sides = [
				...html.matchAll(
					/data-tv-item="bar:[a-z]+"[^>]*style="width:(\d+)px;height:(\d+)px"/g,
				),
			]
			assert.equal(sides.length, 3, phone)
			for (const [, w, h] of sides) {
				assert.ok(Number(w) * scale >= 44, `${phone} bar ${w}`)
				assert.ok(Number(h) * scale >= 44, `${phone} bar ${h}`)
			}
			// A poster is as tall as the row and no taller than lets four stand side by side.
			assert.equal(count(html, "aspect-[2/3] h-full max-h-[156px]"), 12, phone)
		}
		// The mark's plate is a picture, not a key, and stands in the bar's row.
		assert.match(list, /data-tv-service-mark="8"[^>]*h-\[46px\]/)
	}
})

test("the server draws the bar and the Expand key alone for a link to a service, and nothing of its titles", () => {
	assert.deepEqual(ids(rendered.first), ["expand", ...BAR])
	assert.equal(count(rendered.first, "/poster-"), 0)
	assert.equal(count(rendered.first, "tv-mark"), 0)
	// The screen is read out by the service's name.
	assert.match(rendered.first, /aria-live="polite"[^>]*>On Netflix</)
})

// ---- The Remotes' streaming keys.

/** The streaming keys of a Remote's markup: the service's id, its label, whether it is pressed, and its mark. */
const keys = (html: string) =>
	[
		...html.matchAll(
			/<button[^>]*data-service-key="(\d+)"[^>]*>.*?<\/button>/g,
		),
	].map(([tag, id]) => ({
		id: Number(id),
		label: /aria-label="([^"]+)"/.exec(tag)?.[1],
		pressed: /aria-pressed="true"/.test(tag),
		marks: marks(tag),
		tag,
	}))
const REMOTES = ["desktop", "hand", "table"] as const

test("both Remotes have a key for each of the person's two services, in their order, in every form", () => {
	for (const form of REMOTES) {
		assert.deepEqual(
			keys(rendered.remotes.drawn[form]).map(({ id, label }) => [id, label]),
			[
				[8, "On Netflix"],
				[9, "On Prime"],
			],
			form,
		)
		assert.deepEqual(
			keys(rendered.remotes.logos[form]).map(({ id, label }) => [id, label]),
			[
				[337, "On Disney+"],
				[99, "On Kanopy"],
			],
			form,
		)
		// With one service there is one key.
		assert.equal(keys(rendered.remotes.one[form]).length, 1, form)
	}
})

test("a key shows the Remote's own mark where it has one, the catalog's logo otherwise, or the name", () => {
	for (const form of REMOTES) {
		const [netflix, prime] = keys(rendered.remotes.drawn[form])
		assert.deepEqual(netflix.marks, ["drawn"])
		assert.match(netflix.tag, /tv-mark-8 /)
		assert.deepEqual(prime.marks, ["drawn"])
		assert.match(prime.tag, /tv-mark-9 /)
		const [disney, plain] = keys(rendered.remotes.logos[form])
		assert.deepEqual(disney.marks, ["logo"])
		assert.match(disney.tag, /w92\/disney\.jpg/)
		assert.deepEqual(plain.marks, [])
		assert.match(plain.tag, />Kanopy</)
	}
})

test("every drawn mark has its shape and its ink in the TV's stylesheet", () => {
	const css = readFileSync("app/ui/living-room/living-room.css", "utf8")
	const ids = [
		...new Set(
			Object.values(rendered.remotes)
				.flatMap((remote) =>
					typeof remote === "string" ? [] : Object.values(remote),
				)
				.flatMap((html) => [...html.matchAll(/tv-mark-(\d+) /g)])
				.map((match) => match[1]),
		),
	].sort()
	assert.deepEqual(ids, ["8", "9"])
	for (const id of ids) {
		const rule = new RegExp(`\\.tv-mark-${id} \\{[^}]*\\}`).exec(css)?.[0] ?? ""
		assert.match(rule, /background-color: #/, id)
		assert.match(
			rule,
			/mask-image: url\("\.\.\/\.\.\/img\/[a-z-]+\.svg"\)/,
			id,
		)
	}
	assert.match(css, /\.tv-mark \{[^}]*mask: center \/ contain no-repeat/)
})

test("the drawn marks are as large as on the Remotes' keys before: 68 and 71 px wide on the desktop, 58 and 60 in the hand, 50 and 52 on the table", () => {
	const widths = (html: string) =>
		keys(html).map(({ tag }) =>
			Math.round(Number(/style="width:([\d.]+)px/.exec(tag)?.[1])),
		)
	assert.deepEqual(widths(rendered.remotes.drawn.desktop), [68, 71])
	assert.deepEqual(widths(rendered.remotes.drawn.hand), [58, 60])
	assert.deepEqual(widths(rendered.remotes.drawn.table), [50, 52])
})

test("a key is pressed while its service's screen shows, and no key for a service that has none", () => {
	for (const form of REMOTES) {
		assert.deepEqual(
			keys(rendered.remotes.drawn[form]).map(({ pressed }) => pressed),
			[false, false],
		)
		assert.deepEqual(
			keys(rendered.remotes.open[form]).map(({ id, pressed }) => [id, pressed]),
			[
				[8, false],
				[337, true],
			],
			form,
		)
		assert.deepEqual(
			keys(rendered.remotes.other[form]).map(({ pressed }) => pressed),
			[false, false],
		)
		// Every key says whether it is on.
		for (const { tag } of keys(rendered.remotes.drawn[form]))
			assert.match(tag, /aria-pressed="(true|false)"/)
	}
})

test("the phone Remote's keys are 44 px tall in both forms, and the desktop's 52", () => {
	for (const form of ["hand", "table"] as const)
		for (const { tag } of keys(rendered.remotes.logos[form]))
			assert.match(tag, /style="height:44px"/)
	for (const { tag } of keys(rendered.remotes.logos.desktop))
		assert.match(tag, /h-\[52px\]/)
})
