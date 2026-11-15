// The pixel effect spots over the /stats chapters. Each spot names the element it decorates (a `data-fx-spot` key or a
// selector), what starts its effect, the effect (`play`) and a small teaser (`tease`) that hints at it once, when the
// element first comes fully into view. page-effects.ts finds the elements, wires the triggers and runs the recipes on
// one page stage (page-stage.ts). Effect ids are pixelfx's (pixelfx/registry.js).
import type { FxId } from "./pixelfx/registry.js"

/** A box in document CSS px. */
export type Box = {
	x: number
	y: number
	w: number
	h: number
	cx: number
	cy: number
}

export type Trigger =
	/** The pointer moving onto it (desktop), or a tap (touch). */
	| "hover"
	/** A click or tap on it: a control that changes something on the page (a decade bar, a line that recounts). */
	| "tap"
	/** Its trivia card's answer shown (or the quiz card's first answer picked). */
	| "reveal"
	/** Like hover, and again after its card's switch (Christmas, Zombies, Sharks), for the side now showing. */
	| "switch"

export interface Ctx {
	el: HTMLElement
	/** The element's box. */
	r: Box
	/** The box of the first visible descendant matching `sel` (or of `el`). */
	box(sel?: string): Box | null
	/** Every visible descendant matching `sel`. */
	all(sel: string): Box[]
	play(
		id: FxId,
		x: number,
		y: number,
		opts?: Record<string, unknown>,
		how?: { wait?: number; hold?: number },
	): void
	/** How often this spot has played, for seeds. */
	n: number
	/** For `switch`: the side now showing ("christmas", "zombies", "sharks"). For `tap`: the element's text. */
	detail: string
}

export type Recipe = (c: Ctx) => void

export interface Spot {
	key: string
	trigger: Trigger
	/** Defaults to `[data-fx-spot="<key>"]`. */
	sel?: string
	play: Recipe
	/** Once per page view, when the first of its elements is fully in view. */
	tease?: Recipe
}

/** CSS px per effect pixel, as the hero's die. */
export const PX = 3
const e = (cssPx: number) => Math.max(4, Math.round(cssPx / PX))
const T = { tease: 1 }

const GOLD = [
	"#1e1206",
	"#4a2c08",
	"#86520c",
	"#c48412",
	"#f0b424",
	"#ffe066",
	"#fff6c4",
	"#ffffff",
]
const GOLD5 = ["#7a4a12", "#c48412", "#f0b424", "#fff6c4", "#ffffff"]

const glint = (c: Ctx, x: number, y: number, wait = 0) =>
	c.play("cinema/glint", x, y, { palette: GOLD5, seed: c.n + 1 }, { wait })

/** A trope chip's effect: anchored at the chip's top-left, told the chip's size. */
const chip = (id: FxId) => ({
	trigger: "hover" as const,
	play: (c: Ctx) =>
		c.play(id, c.r.x, c.r.y, { w: e(c.r.w), h: e(c.r.h), seed: c.n + 1 }),
	tease: (c: Ctx) =>
		c.play(id, c.r.x, c.r.y, { w: e(c.r.w), h: e(c.r.h), seed: 1, ...T }),
})

/** The spots, in page order. */
export const SPOTS: Spot[] = [
	// 1. The catalog
	// The Trailers tile: a clapperboard claps.
	{
		key: "catalog-trailers",
		trigger: "hover",
		sel: '[data-fx-tile="Trailers"]',
		play: (c) =>
			c.play("stats-page/clapper", c.r.x + c.r.w - 27, c.r.cy, {
				seed: c.n + 1,
			}),
		tease: (c) => c.play("stats-page/clapper", c.r.x + c.r.w - 27, c.r.cy, T),
	},
	// The Posters tile: a bookmark ribbon drops in.
	{
		key: "catalog-posters",
		trigger: "hover",
		sel: '[data-fx-tile="Posters"]',
		play: (c) =>
			c.play("cinema/bookmark", c.r.x + c.r.w - 20, c.r.y + 26, {
				seed: c.n + 1,
			}),
		tease: (c) => glint(c, c.r.x + c.r.w - 10, c.r.y + 8),
	},
	// A tap on a decade bar: a projector lights up the decade, the old ones in sepia with film scratches.
	{
		key: "catalog-decade",
		trigger: "tap",
		sel: "[data-decades] button",
		play: (c) => {
			const bar = c.box("[data-bar]")
			if (bar)
				c.play("stats-page/projector", bar.cx, bar.y, {
					w: e(bar.w),
					h: e(bar.h),
					sepia: /^(18|19[0-5])/.test(c.detail) ? 1 : 0,
					seed: c.n + 2,
				})
		},
		tease: (c) => {
			const on = c.el
				.closest("[data-decades]")
				?.querySelector('[aria-pressed="true"] [data-bar]')
			const bar = on ? toDoc(on.getBoundingClientRect()) : c.box("[data-bar]")
			if (bar)
				c.play("stats-page/projector", bar.cx, bar.y, {
					w: e(bar.w),
					h: e(bar.h),
					...T,
				})
		},
	},
	// A face in Most cast credits: press flashbulbs.
	{
		key: "catalog-faces",
		trigger: "hover",
		sel: '[data-fx-spot="catalog-faces"] li',
		play: (c) => {
			const face = c.box("[data-face]") ?? c.r
			c.play("stats-page/flashbulb", face.cx, face.cy, {
				r: e(face.w) / 2,
				seed: c.n + 3,
			})
		},
		tease: (c) => {
			const face = c.box("[data-face]") ?? c.r
			c.play("stats-page/flashbulb", face.cx, face.cy, {
				r: e(face.w) / 2,
				...T,
			})
		},
	},

	// 2. The crowd
	// A source card: an admission ticket comes out of it, punched and torn.
	{
		key: "crowd-cards",
		trigger: "hover",
		sel: '[data-fx-spot="crowd-cards"] .stats-brand',
		play: (c) =>
			c.play("stats-page/ticket", c.r.cx, c.r.y, { w: e(c.r.w), seed: c.n }),
		tease: (c) =>
			c.play("stats-page/ticket", c.r.cx, c.r.y, { w: e(c.r.w), ...T }),
	},
	// The count of perfect 100 Metascores: a crown.
	{
		key: "crowd-perfect",
		trigger: "hover",
		play: (c) =>
			c.play("cinema/pun-crown", c.r.cx, c.r.cy - 9, {
				w: e(c.r.w) + 6,
				h: e(c.r.h) + 2,
				seed: c.n + 1,
			}),
		tease: (c) => glint(c, c.r.x + c.r.w + 4, c.r.y + 2),
	},
	// The IMDb score spread: a moon rises over the 9s.
	{
		key: "crowd-spread",
		trigger: "hover",
		play: (c) =>
			c.play("stats-page/moonrise", c.r.x + c.r.w * 0.8, c.r.y, {
				w: e(c.r.w * 0.2),
				h: e(c.r.h * 0.78),
				seed: c.n + 2,
			}),
		tease: (c) =>
			c.play("stats-page/moonrise", c.r.x + c.r.w * 0.8, c.r.y, {
				w: e(c.r.w * 0.2),
				h: e(c.r.h * 0.78),
				...T,
			}),
	},

	// 3. Said out loud
	// A tap on the runtime line under the heading: an hourglass turns.
	{
		key: "out-runtime",
		trigger: "tap",
		play: (c) =>
			c.play("stats-page/hourglass", c.r.x + c.r.w + 22, c.r.cy, {
				seed: c.n + 1,
			}),
		tease: (c) => c.play("stats-page/hourglass", c.r.x + c.r.w + 22, c.r.cy, T),
	},
	// The movie with the most Letterboxd ratings: a black hole.
	{
		key: "out-letterboxd",
		trigger: "hover",
		play: (c) =>
			c.play("stats-page/black-hole", c.r.cx, c.r.y, {
				w: e(c.r.w),
				seed: c.n + 1,
			}),
		tease: (c) =>
			c.play("stats-page/black-hole", c.r.cx, c.r.y, { w: e(c.r.w), ...T }),
	},
	// The movie with the most IMDb votes: a stamp over the end of the title, clear of the sentence that follows.
	{
		key: "out-imdb",
		trigger: "hover",
		play: (c) =>
			c.play("cinema/stamp", c.r.x + c.r.w - 18, c.r.y - 16, {
				seed: c.n + 1,
			}),
		tease: (c) => glint(c, c.r.x + c.r.w - 4, c.r.y + 6),
	},

	// 4. Extremes
	// The oldest movie's poster: a projector in sepia.
	{
		key: "ext-oldest",
		trigger: "hover",
		play: (c) =>
			c.play("stats-page/projector", c.r.cx, c.r.y, {
				w: e(c.r.w),
				h: e(c.r.h),
				sepia: 1,
				seed: c.n + 2,
			}),
		tease: (c) =>
			c.play("stats-page/projector", c.r.cx, c.r.y, {
				w: e(c.r.w),
				h: e(c.r.h),
				sepia: 1,
				...T,
			}),
	},
	// The longest movie's poster: it snores.
	{
		key: "ext-longest",
		trigger: "hover",
		play: (c) => {
			c.play("stats-page/zzz", c.r.x + c.r.w - 6, c.r.y + 10, { seed: c.n })
			c.play(
				"stats-page/zzz",
				c.r.x + c.r.w - 2,
				c.r.y + 6,
				{ seed: c.n + 5 },
				{ wait: 1.6 },
			)
		},
		tease: (c) =>
			c.play("stats-page/zzz", c.r.x + c.r.w - 6, c.r.y + 10, {
				seed: 1,
				...T,
			}),
	},
	// The show with the most episodes: TV static.
	{
		key: "ext-episodes",
		trigger: "hover",
		play: (c) =>
			c.play("stats-page/tv-static", c.r.x, c.r.y, {
				w: e(c.r.w),
				h: e(c.r.h),
				seed: c.n + 1,
			}),
		tease: (c) =>
			c.play("stats-page/tv-static", c.r.x, c.r.y, {
				w: e(c.r.w),
				h: e(c.r.h),
				...T,
			}),
	},
	// The most-voted episode: flashbulbs.
	{
		key: "ext-voted",
		trigger: "hover",
		play: (c) =>
			c.play("stats-page/flashbulb", c.r.cx, c.r.cy, {
				w: e(c.r.w),
				h: e(c.r.h),
				seed: c.n,
			}),
		tease: (c) =>
			c.play("stats-page/flashbulb", c.r.cx, c.r.cy, {
				w: e(c.r.w),
				h: e(c.r.h),
				...T,
			}),
	},
	// The highest box office: a coin shower.
	{
		key: "ext-boxoffice",
		trigger: "hover",
		play: (c) =>
			c.play("stats-page/coin-shower", c.r.x, c.r.y, {
				w: e(c.r.w),
				h: e(c.r.h),
				seed: c.n + 9,
			}),
		tease: (c) =>
			c.play("stats-page/coin-shower", c.r.x, c.r.y, {
				w: e(c.r.w),
				h: e(c.r.h),
				...T,
			}),
	},
	// The lowest-rated well-known episode: a storm cloud.
	{
		key: "ext-lowest",
		trigger: "hover",
		play: (c) =>
			c.play("stats-page/storm-cloud", c.r.x, c.r.y, {
				w: e(c.r.w),
				h: e(c.r.h),
				seed: c.n,
			}),
		tease: (c) =>
			c.play("stats-page/storm-cloud", c.r.x, c.r.y, {
				w: e(c.r.w),
				h: e(c.r.h),
				...T,
			}),
	},
	// The highest Metascore: a crown.
	{
		key: "ext-metascore",
		trigger: "hover",
		play: (c) =>
			c.play("cinema/pun-crown", c.r.cx, c.r.cy, {
				w: e(c.r.w),
				h: e(c.r.h),
				seed: c.n + 1,
			}),
		tease: (c) => glint(c, c.r.x + c.r.w - 6, c.r.y + 6),
	},

	// 5. Disagreements
	// The movie everyone agrees on: a halo.
	{
		key: "dis-top",
		trigger: "hover",
		play: (c) =>
			c.play("cinema/pun-holy", c.r.cx, c.r.cy, {
				w: e(c.r.w),
				h: e(c.r.h),
				seed: c.n + 1,
			}),
		tease: (c) => glint(c, c.r.x + c.r.w - 6, c.r.y + 6),
	},
	// A score standoff: a bolt snaps between the two scores and lands on the VS badge, which throws a shock ring.
	{
		key: "dis-row",
		trigger: "hover",
		play: (c) => {
			const v = versus(c)
			if (v)
				c.play("stats-page/clash", v.cx - v.d, v.cy, {
					dx: (2 * v.d) / PX,
					dy: 0,
					ring: v.r / PX,
					ink: "#0b0d12",
					jag: 0.09,
					palette: GOLD,
					seed: c.n + 1,
				})
		},
		tease: (c) => {
			const v = versus(c)
			if (v) glint(c, v.cx + v.r * 0.6, v.cy - v.r * 0.7)
		},
	},

	// 6. Tropes: every chip has its own effect.
	{ key: "trope-shout-out", ...chip("stats-page/trope-shout-out") },
	{ key: "trope-foreshadowing", ...chip("stats-page/trope-foreshadowing") },
	{ key: "trope-bittersweet", ...chip("stats-page/trope-bittersweet") },
	{ key: "trope-chekhov", ...chip("stats-page/trope-chekhov") },
	{ key: "trope-oh-crap", ...chip("stats-page/trope-oh-crap") },
	{ key: "trope-big-bad", ...chip("stats-page/trope-big-bad") },
	{ key: "trope-book-ends", ...chip("stats-page/trope-book-ends") },
	{
		key: "trope-meaningful-name",
		...chip("stats-page/trope-meaningful-name"),
	},
	{ key: "trope-title-drop", ...chip("stats-page/trope-title-drop") },
	{ key: "trope-downer", ...chip("stats-page/trope-downer") },
	{ key: "trope-running-gag", ...chip("stats-page/trope-running-gag") },
	{ key: "trope-deadpan", ...chip("stats-page/trope-deadpan") },

	// 7. Streaming
	// The movies streaming in every country: paper planes fly out.
	{
		key: "stream-everywhere",
		trigger: "hover",
		play: (c) =>
			c.play("stats-page/paper-planes", c.r.cx, c.r.cy, {
				w: e(c.r.w),
				h: e(c.r.h),
				seed: c.n,
			}),
		tease: (c) =>
			c.play("stats-page/paper-planes", c.r.cx, c.r.cy, {
				w: e(c.r.w),
				h: e(c.r.h),
				...T,
			}),
	},

	// 8. Awards
	// The awards number strip: spotlights sweep.
	{
		key: "award-numbers",
		trigger: "hover",
		play: (c) =>
			c.play("stats-page/spotlights", c.r.cx, c.r.y + c.r.h, {
				w: e(c.r.w),
				h: e(c.r.h),
				seed: c.n,
			}),
		tease: (c) =>
			c.play("stats-page/spotlights", c.r.cx, c.r.y + c.r.h, {
				w: e(c.r.w),
				h: e(c.r.h),
				...T,
			}),
	},
	// The most-awarded title: confetti pops.
	{
		key: "award-top",
		trigger: "hover",
		play: (c) => {
			const p = c.box("img") ?? c.r
			c.play("stats-page/confetti-pop", p.x, p.y, {
				w: e(p.w),
				h: e(p.h),
				seed: c.n,
			})
		},
		tease: (c) => {
			const p = c.box("img") ?? c.r
			c.play("stats-page/confetti-pop", p.x, p.y, {
				w: e(p.w),
				h: e(p.h),
				...T,
			})
		},
	},
	// Any title's trophy mark: it shines.
	{
		key: "award-trophy",
		trigger: "hover",
		play: (c) => {
			const mark = c.box("svg")
			if (mark)
				c.play("stats-page/trophy-shine", mark.cx, mark.cy, { seed: c.n })
		},
	},

	// 9. Trivia
	// The Friday the 13th quiz answer: a cold bolt cracks down beside it, then bats
	// scatter out of the dark. The teaser: far off, a fork flickers over the card.
	{
		key: "triv-friday",
		trigger: "reveal",
		sel: "#quiz-friday-13th",
		play: (c) => {
			const x = c.r.x + c.r.w * 0.78
			const y = floor(c) - 6
			c.play("stats-page/night-bolt", x, y, { h: 34, seed: c.n % 2 ? 7 : 4 })
			c.play(
				"stats-page/bats",
				x - 20,
				y - 20,
				{ n: 4, seed: c.n },
				{ wait: 0.3 },
			)
		},
		tease: (c) =>
			c.play("stats-page/night-bolt", c.r.x + c.r.w * 0.78, floor(c) - 6, {
				h: 34,
				...T,
			}),
	},
	// The Christmas, zombie and shark card: snow, a hand, a fin, for the side showing. The teaser hints at it: one
	// snowflake, the fin's tip, or a glint where the hand will come up.
	{
		key: "triv-seasonal",
		trigger: "switch",
		sel: "#trivia-seasonal",
		play: (c) => {
			const f = floor(c)
			if (c.detail === "christmas")
				c.play(
					"cinema/amb-snow",
					c.r.cx,
					c.r.y + c.r.h * 0.45,
					{ r: e(c.r.w) * 0.45, density: 2, seed: c.n },
					{ hold: 3.5 },
				)
			if (c.detail === "sharks")
				c.play("stats-page/shark-fin", c.r.cx, f, {
					len: e(c.r.w) * 0.8,
					seed: c.n,
				})
			if (c.detail === "zombies")
				c.play("stats-page/zombie-hand", c.r.x + c.r.w * 0.86, f, { seed: c.n })
		},
		tease: (c) => {
			const side = sideOf(c.el)
			if (side === "christmas")
				c.play("stats-page/snowflake", c.r.x + c.r.w * 0.78, c.r.y + 24, {
					w: 20,
					...T,
				})
			else if (side === "sharks")
				c.play("stats-page/shark-fin", c.r.cx, floor(c), {
					len: e(c.r.w) * 0.8,
					...T,
				})
			else glint(c, c.r.x + c.r.w * 0.86, floor(c) - 6)
		},
	},
	// The box office counter: a coin drops in.
	{
		key: "triv-meter",
		trigger: "hover",
		play: (c) =>
			c.play("stats/coin-slot", c.r.x + c.r.w - 30, c.r.y, {
				slot: false,
				w: 8,
				h: 30,
				palette: GOLD,
				seed: c.n,
			}),
		tease: (c) => glint(c, c.r.x + c.r.w - 10, c.r.y + 6),
	},
	// The highest Letterboxd answer: a moon rises.
	{
		key: "triv-letterboxd",
		trigger: "reveal",
		sel: "#trivia-highest-letterboxd",
		play: (c) => {
			const a = answer(c)
			c.play("stats-page/moonrise", a.x + a.w - 120, a.y, {
				w: 34,
				h: 26,
				seed: c.n,
			})
		},
	},
	// The lowest Metascore answer: a splat.
	{
		key: "triv-metacritic",
		trigger: "reveal",
		sel: "#trivia-lowest-metascore",
		play: (c) => {
			const a = answer(c)
			c.play("stats-page/splat", a.x + 70, a.y + 70, { seed: c.n })
		},
	},
	// The busiest year: fireworks beside it.
	{
		key: "triv-busiest",
		trigger: "hover",
		sel: "#trivia-busiest-year",
		play: (c) => {
			const at = burstBeside(c, c.box("[data-figure]"))
			c.play("stats-page/fireworks", at.x, at.y, { r: 16, seed: c.n })
		},
		tease: (c) => {
			const at = burstBeside(c, c.box("[data-figure]"))
			c.play("stats-page/fireworks", at.x, at.y, { r: 16, ...T })
		},
	},

	// 10. Members
	// A tap on the logged-time line: an hourglass, or a black hole when it counts in Interstellars.
	{
		key: "mem-logged",
		trigger: "tap",
		play: (c) =>
			/Interstellar/.test(c.detail)
				? c.play("stats-page/black-hole", c.r.x + c.r.w - 40, c.r.y, {
						w: 20,
						seed: c.n,
					})
				: c.play("stats-page/hourglass", c.r.x + c.r.w + 22, c.r.cy, {
						seed: c.n,
					}),
		tease: (c) => c.play("stats-page/hourglass", c.r.x + c.r.w + 22, c.r.cy, T),
	},
	// The title members have seen most: a projector.
	{
		key: "mem-most-seen",
		trigger: "hover",
		play: (c) =>
			c.play("stats-page/projector", c.r.cx, c.r.y, {
				w: e(c.r.w),
				h: e(c.r.h),
				seed: c.n,
			}),
		tease: (c) =>
			c.play("stats-page/projector", c.r.cx, c.r.y, {
				w: e(c.r.w),
				h: e(c.r.h),
				...T,
			}),
	},
	// The most binged show (and a tap on its count switch): popcorn pops into a little pile over its count.
	{
		key: "mem-binged",
		trigger: "hover",
		play: (c) => {
			const row = c.box("li") ?? c.r
			c.play("stats-page/popcorn-pop", row.x + row.w - 50, row.y + 6, {
				seed: c.n + 3,
			})
		},
		tease: (c) => {
			const row = c.box("li") ?? c.r
			c.play("stats-page/popcorn-pop", row.x + row.w - 50, row.y + 6, T)
		},
	},
	// A row in Members agree: the bar's two ends snap in to the average like caliper jaws, click, a glint.
	{
		key: "mem-agree",
		trigger: "hover",
		sel: '[data-fx-range="agree"] > li',
		play: (c) => {
			const at = range(c)
			if (at)
				c.play("stats-page/bar-snap", at.x, at.y, {
					w: at.w,
					x0: at.x0,
					seed: c.n + 1,
				})
		},
	},
	// A row in Members split: a bolt strikes the average and cracks the range apart, harder the wider the spread.
	{
		key: "mem-split",
		trigger: "hover",
		sel: '[data-fx-range="split"] > li',
		play: (c) => {
			const at = range(c)
			if (at)
				c.play("stats-page/split-bar", at.x, at.y, {
					w: at.w,
					x0: at.x0,
					force: at.force,
					seed: c.n,
				})
		},
		tease: (c) => {
			const at = range(c)
			if (at)
				c.play("stats-page/split-bar", at.x, at.y, {
					w: at.w,
					x0: at.x0,
					force: at.force,
					...T,
				})
		},
	},
	// The scoring day heading: a sunrise.
	{
		key: "mem-weekday",
		trigger: "hover",
		play: (c) =>
			c.play("stats-page/sunrise", c.r.x + c.r.w + 12, c.r.y + c.r.h * 0.8, {
				seed: c.n,
			}),
		tease: (c) =>
			c.play("stats-page/sunrise", c.r.x + c.r.w + 12, c.r.y + c.r.h * 0.8, T),
	},
	// The perfect 10s: fireworks.
	{
		key: "mem-tens",
		trigger: "hover",
		play: (c) => {
			const at = burstBeside(c, c.r)
			c.play("stats-page/fireworks", at.x, at.y, { r: 16, seed: c.n })
		},
		tease: (c) => {
			const at = burstBeside(c, c.r)
			c.play("stats-page/fireworks", at.x, at.y, { r: 16, ...T })
		},
	},
	// The hours waiting on Wishlists: hearts.
	{
		key: "mem-wishlist",
		trigger: "hover",
		play: (c) =>
			c.play("cinema/pun-hearts", c.r.cx, c.r.cy, {
				w: e(c.r.w),
				h: e(c.r.h),
				seed: c.n,
			}),
		tease: (c) => glint(c, c.r.x + c.r.w - 4, c.r.y + 6),
	},
]

/** A trivia card's answer area (under the question), in document px. */
function answer(c: Ctx): Box {
	return c.box("[data-answer]") ?? c.r
}

/**
 * A range row's marker (the average) and bar, in effect px around the marker, and how hard a split hits: the widest
 * split on the page hits hardest.
 */
function range(c: Ctx) {
	const dot = c.box("[data-range-dot]")
	const bar = c.box("[data-range-bar]") ?? dot
	if (!dot || !bar) return null
	const spreads = [
		...document.querySelectorAll<HTMLElement>('[data-fx-range="split"] > li'),
	].map((li) => Number(li.dataset.spread) || 0)
	const lo = Math.min(...spreads)
	const hi = Math.max(...spreads)
	const spread = Number(c.el.dataset.spread) || hi
	const force = 0.45 + (0.55 * (spread - lo)) / Math.max(0.01, hi - lo)
	return {
		x: dot.cx,
		y: dot.cy,
		w: e(bar.w),
		x0: Math.round((bar.x - dot.cx) / PX),
		force: Math.min(1, Math.max(0.3, force)),
	}
}

/** A standoff's VS badge (center, radius) and how far either side of it the bolt starts: at the nearer score. */
function versus(c: Ctx) {
	const badge = c.box("[data-fx-vs]")
	if (!badge) return null
	const ns = c.all("[data-vs-n]")
	const reach =
		ns.length === 2
			? Math.min(badge.cx - ns[0].cx, ns[1].cx - badge.cx)
			: badge.w * 1.6
	return {
		cx: badge.cx,
		cy: badge.cy,
		r: badge.w / 2,
		d: Math.max(badge.w * 0.9, reach),
	}
}

/** The seasonal card's side, from its data attribute. */
export function sideOf(card: Element) {
	return card.querySelector<HTMLElement>("[data-side]")?.dataset.side ?? ""
}

/** Where a burst goes beside a big number: right of it if there's room in the card, else above its right end. */
function burstBeside(c: Ctx, n: Box | null): { x: number; y: number } {
	const b = n ?? c.r
	const room = c.el.getBoundingClientRect().right + window.scrollX - (b.x + b.w)
	return room > 130
		? { x: b.x + b.w + 60, y: b.y - 8 }
		: { x: b.x + b.w - 30, y: b.y - 44 }
}

/** A card's floor: its bottom edge, a little inside. */
function floor(c: Ctx) {
	return c.r.y + c.r.h - 3
}

export function toDoc(r: DOMRect): Box {
	const x = r.left + window.scrollX
	const y = r.top + window.scrollY
	return {
		x,
		y,
		w: r.width,
		h: r.height,
		cx: x + r.width / 2,
		cy: y + r.height / 2,
	}
}
