// PROTOTYPE for "Prototype native-scroll carousels on title pages", twelfth round. Throwaway code: not for production.
//
// Six remixes of the four forms of the eleventh round that worked: the bars (rings1), the legend (rings5), the
// heading (rings9), and the words (rings10). The rings, the pan, the zoom, the card, and the preview of a control are
// the kit's (rings-forms.ts). What every remix shares:
// - At rest the map is the nearest titles and nothing else. Nothing changes who is on it unless the visitor asked.
// - A control is a slim chip that is also a bar: its background fills to the level of the title in the middle. What
//   a tap would add is drawn in green from that level on, what it would take away in red, faintly while the chip is
//   pointed at or held, and lasting once it is on, with a flash as it comes on.
// - Every selection that is on has a color of its own (three at most, never two alike), and the posters that are on
//   the map because of it wear that color as a thin line. Green and red only ever mean added and taken away.
//
// The forms:
// - mix1, level chips: the fingerprint of the title in the middle as six chips. A full one drops that trait, a low
//   one adds it. From the bars and the legend.
// - mix2, legend bars: the ways the titles around differ, with how many do. The legend entry is the bar. From the
//   legend and the bars.
// - mix3, one heading: one direction at a time, set with a tap and let go with a tap. It is read again against
//   every title you step onto, so "more comedy" keeps climbing. From the heading and the legend.
// - mix4, signposts: no control bends the map. Phrases say how the titles on it differ, the posters they apply to
//   are marked, and a phrase can be followed. From the words and the heading.
// - mix5, before and after: the fingerprint with a mark per bar for where the titles around sit. Pointing at a bar
//   moves the marks to where they would be. From the bars and the words.
// - mix6, keep what you found: what the walk moved toward shows up by itself, and holds the map only once it is
//   tapped. From the heading, with the visitor's consent.
//
// `mixKit` and each form are functions with no outside references, because they run as the page's inline script.
import type { PlayCore, PlayCtx, PlayForm, PlayTitle } from "~/ui/prototype-carousels/play-engine"
import type { RingsKit } from "~/ui/prototype-carousels/rings-forms"

export type MixKit = ReturnType<typeof mixKit>
type MixForm = (core: PlayCore, kit: RingsKit, mx: MixKit) => PlayForm
interface Chip {
	act: string
	arg: string
	/** What the chip stands for: a level of a trait, at least or at most. */
	token: string
	label: string
	/** The label is "more" of the trait (true) or "less" of it (false): said as a word, or as a sign where room is short. */
	more?: boolean
	/** What follows the rest text where there is room for it. */
	wide?: string
	/** The level of the title in the middle. */
	v: number
	on: boolean
	/** What the chip says at rest, after its label: a level or a count. */
	rest: string
	color?: string
	/** A mark on the bar: where the titles around sit, and where the title you came from did. */
	around?: number
	was?: number
	/** The part that is drawn as added or taken away, when it is not the way from `v` to the token's level. */
	zone?: [number, number]
	/** Whether that part reads as added ("up", green) or taken away ("dn", red), when the token does not say. */
	tone?: string
	/** What the chip says while it is looked at or on, when it is not "1 → 6+". */
	to?: string
	hint?: string
	title?: string
}

export function mixKit(core: PlayCore, kit: RingsKit) {
	const { esc, val } = core
	/** One color per selection that is on. Green and red are kept for what a selection adds or takes away. */
	const SLOTS = ["#fbbf24", "#22d3ee", "#e879f9"]
	const now = () => (core.win ? (core.win.performance.now() as number) : 0)
	const active = (ctx: PlayCtx) => (ctx.st.mem.w as string[] | undefined) ?? []
	const colorOf = (ctx: PlayCtx, token: string) => SLOTS[((ctx.st.mem.sl as Record<string, number> | undefined)?.[token] ?? 0) % SLOTS.length]
	/** The selection after a tap on a token: it goes when it was on. Otherwise it comes, one per trait and `max` in all. */
	const after = (ctx: PlayCtx, token: string, max: number) => {
		const cur = active(ctx)
		if (cur.indexOf(token) >= 0) return cur.filter((t) => t !== token)
		const key = kit.tok(token)?.key
		let out = cur.filter((t) => kit.tok(t)?.key !== key)
		while (out.length >= max) out = out.slice(1)
		return out.concat([token])
	}
	/** A tap on a token. Every selection keeps its color for as long as it is on, and a new one takes a free color. */
	const choose = (ctx: PlayCtx, token: string, max: number) => {
		const mem = ctx.st.mem
		const next = after(ctx, token, Math.min(max, SLOTS.length))
		const had = (mem.sl as Record<string, number> | undefined) ?? {}
		const sl: Record<string, number> = {}
		const used: Record<number, boolean> = {}
		for (const t of next)
			if (had[t] !== undefined) {
				sl[t] = had[t]
				used[had[t]] = true
			}
		for (const t of next)
			if (sl[t] === undefined) {
				let n = 0
				while (used[n]) n++
				sl[t] = n
				used[n] = true
			}
		mem.w = next
		mem.sl = sl
		// Where it was chosen: there its words are still about the title in the middle.
		const at = { ...((mem.at as Record<string, string> | undefined) ?? {}) }
		if (next.indexOf(token) >= 0) at[token] = ctx.c.k
		mem.at = at
		flash(ctx, next.indexOf(token) >= 0 ? token : "")
	}
	const flash = (ctx: PlayCtx, token: string) => {
		ctx.st.mem.fl = token ? { t: token, at: now() } : null
	}
	/** A token as its level: "6+" or "≤4". */
	const level = (token: string) => {
		const k = kit.tok(token)
		return k ? (k.op === ">" ? `${k.n}+` : `≤${k.n}`) : ""
	}
	const orMore = (token: string) => {
		const k = kit.tok(token)
		return k ? (k.op === ">" ? `${k.n} or more` : `${k.n} or less`) : ""
	}
	/**
	 * A slim chip that is also a bar. Its background fills to the level of the title in the middle. The way from
	 * there to the chip's own level is the part a tap adds (green) or takes away (red): faint while the chip is
	 * looked at, lasting once it is on, flashing as it comes on. The text says the same: "1 → 6+".
	 */
	const chip = (ctx: PlayCtx, o: Chip) => {
		const k = kit.tok(o.token)
		if (!k) return ""
		const up = k.op === ">"
		const zone = o.zone ?? (up ? [Math.min(o.v, k.n), k.n] : [k.n, Math.max(o.v, k.n)])
		const moved = zone[1] - zone[0] > 0
		const fl = ctx.st.mem.fl as { t: string; at: number } | null | undefined
		const since = fl && fl.t === o.token && o.on ? now() - fl.at : -1
		const flashing = since >= 0 && since < 1300
		// A chip that also says how to let it go has no room for where it started: its fill says that.
		const to = o.to ?? (o.zone ? `${zone[up ? 0 : 1]}→${zone[up ? 1 : 0]}` : moved && !o.hint ? `${o.v}→${level(o.token)}` : level(o.token))
		return `<button type="button" class="ix-c" data-pl-act="${o.act}" data-arg="${esc(o.arg)}" data-k="${k.key}" aria-pressed="${o.on}" data-d="${o.tone ?? (up ? "up" : "dn")}"${flashing ? ' data-fl=""' : ""} style="--v:${o.v};--a:${zone[0]};--b:${zone[1]};--n:${k.n}${
			o.color ? `;--c:${o.color}` : ""
		}${flashing ? `;--fa:${-Math.round(since)}ms` : ""}${o.around !== undefined ? `;--m:${Math.round(o.around * 10) / 10}` : ""}${o.was !== undefined ? `;--w:${o.was}` : ""}" aria-label="${esc(
			o.title ?? `${kit.word(k.key)}: ${o.v} of 10 here. ${o.on ? "On" : "Tap"}: titles with ${orMore(o.token)}.`,
		)}"><u class="ix-f"></u><u class="ix-z"></u><u class="ix-n"></u>${o.was !== undefined ? '<u class="ix-w"></u>' : ""}${o.around !== undefined ? '<u class="ix-k"></u>' : ""}<i>${kit.emo(k.key)}</i><b>${
			o.more === undefined ? "" : `<span class="ix-s" data-s="${o.more ? "+" : "−"}">${o.more ? "more" : "less"} </span>`
		}${esc(o.label)}</b><em><span class="ix-r">${esc(o.rest)}${o.wide ? `<span class="ix-x">${esc(o.wide)}</span>` : ""}</span><span class="ix-p">${esc(to)}</span>${o.hint ? `<small>${esc(o.hint)}</small>` : ""}</em></button>`
	}
	/**
	 * The posters that are on the map because of a selection: the ones the plain map would not show at this zoom.
	 * Each wears the color of the selection it stands out for most, as a thin line.
	 */
	const marks = (ctx: PlayCtx, tokens: string[], places: number) => {
		if (!tokens.length || !ctx.c.s) return null
		const plain: Record<string, boolean> = {}
		for (const t of kit.around(ctx, []).slice(0, places)) plain[t.k] = true
		return (t: PlayTitle) => {
			if (plain[t.k] || !t.s) return ""
			let best = tokens[0]
			let far = -1
			for (const token of tokens) {
				const k = kit.tok(token)
				const d = k ? Math.abs(val(t, k.key) - val(ctx.c, k.key)) : -1
				if (d > far) {
					far = d
					best = token
				}
			}
			return `<i class="ix-in" style="--c:${colorOf(ctx, best)}" aria-hidden="true"></i>`
		}
	}
	const mean = (list: PlayTitle[], key: string) => (list.length ? list.reduce((sum, t) => sum + val(t, key), 0) / list.length : 0)
	/** How many titles in memory would be on the map under a filter. */
	const count = (ctx: PlayCtx, tokens: string[]) => kit.around(ctx, tokens).length
	const words = (token: string) => {
		const k = kit.tok(token)
		return k ? `${k.op === ">" ? "more" : "less"} ${kit.low(k.key)}` : ""
	}
	return { SLOTS, active, colorOf, after, choose, flash, chip, marks, mean, count, level, orMore, words, now }
}

/**
 * mix1, level chips. Takes the principle of the bars (drop a trait the title is strong on, add one it has little
 * of) and the slim chips of the legend. Improves what was hard to read in the bars: before the tap the chip shows
 * the part that would go or come and the map dims what would leave; after it the part stays drawn and the posters
 * that came in are marked. Up to three chips at once, each with its own color.
 */
const mix1: MixForm = (core, kit, mx) => {
	const chips = (ctx: PlayCtx, tokens: string[]) => {
		const own = kit.rule("bars", (key) => core.val(ctx.c, key), [], kit.X.w)
		// A chip keeps its place when it is turned on. One that the walk brought along from another title goes first.
		const keys = own.map((token) => kit.tok(token)?.key)
		const here = own.map((token) => tokens.filter((t) => kit.tok(t)?.key === kit.tok(token)?.key)[0] ?? token)
		const brought = tokens.filter((t) => keys.indexOf(kit.tok(t)?.key) < 0)
		return brought.concat(here).slice(0, Math.max(6, tokens.length))
	}
	return kit.make({
		name: "mix1",
		mode: "bars",
		th: 56,
		tall: true,
		big: true,
		hint: "Its traits as chips. Tap a full one to drop it, a low one to add it.",
		tokens: (ctx) => mx.active(ctx),
		top: (ctx, tokens) => {
			if (!ctx.c.s) return '<p class="rm-say"><span>Its traits are on their way.</span></p>'
			return `<div class="ix-row ix-6" role="group" aria-label="The traits of ${core.esc(ctx.c.t)}. A tap drops a strong one or adds a weak one.">${chips(ctx, tokens)
				.map((token) => {
					const key = kit.tok(token)?.key ?? ""
					const v = core.val(ctx.c, key)
					return mx.chip(ctx, { act: "tk", arg: token, token, label: kit.word(key), v, on: tokens.indexOf(token) >= 0, rest: String(v), color: mx.colorOf(ctx, token) })
				})
				.join("")}</div>`
		},
		note: (_ctx, tokens, list, places, more) =>
			tokens.length
				? `Around it: titles ${kit.withOrWithout(tokens)}. A colored line marks the posters that came in for it.${list.length < places && !more ? ` These ${list.length} are all there are.` : ""}`
				: "A chip fills to its level. Tap a full one for titles without that trait, a low one for titles with it.",
		act: (ctx, name, arg) => {
			if (name !== "tk") return false
			mx.choose(ctx, arg, 3)
			return true
		},
		will: (ctx, name, arg) => (name === "tk" ? mx.after(ctx, arg, 3) : null),
		deco: (ctx, _list, places) => {
			const mark = mx.marks(ctx, mx.active(ctx), places)
			return mark ? (t) => ({ inner: mark(t), extra: "" }) : null
		},
	})
}

/**
 * mix2, legend bars. Takes the legend (what is around, with counts, so a tap always has titles) and makes each
 * entry a bar: the level here, and the level the titles of that entry have. Improves the colors: posters are plain
 * at rest, a selection has a color of its own, and only the posters that came in for it wear it.
 */
const mix2: MixForm = (core, kit, mx) => {
	type Entry = { token: string; n: number }
	/** The ways the titles around differ most from the title in the middle, each with how many titles a tap would show. */
	const legend = (ctx: PlayCtx, tokens: string[]): Entry[] => {
		const name = kit.nameOf(tokens)
		const kept = ctx.e.ui.lg as { f: string; list: Entry[] } | undefined
		if (kept && kept.f === name) return kept.list
		if (!ctx.list || !ctx.c.s) return []
		const votes: Record<string, number> = {}
		for (const t of kit.around(ctx, tokens).slice(0, 48)) {
			if (!t.s) continue
			const most = kit.gaps(ctx.c, t, 1)[0]
			if (!most || Math.abs(most.d) < 3) continue
			const v = core.val(ctx.c, most.k)
			const token = most.d > 0 ? `${most.k}>${Math.min(10, v + 3)}` : `${most.k}<${Math.max(0, v - 3)}`
			votes[token] = (votes[token] ?? 0) + 1
		}
		const taken = tokens.map((t) => kit.tok(t)?.key)
		const list = Object.keys(votes)
			.filter((token) => votes[token] >= 2 && taken.indexOf(kit.tok(token)?.key) < 0)
			.sort((a, b) => votes[b] - votes[a])
			.slice(0, 6)
			.map((token) => ({ token, n: mx.count(ctx, tokens.concat([token])) }))
			.filter((entry) => entry.n >= 3)
			.slice(0, 4)
		// Kept with the place in the walk, so that the legend does not change while its titles are looked at.
		if (!ctx.soft && list.length) ctx.e.ui.lg = { f: name, list }
		return list
	}
	return kit.make({
		name: "mix2",
		mode: "0",
		th: 56,
		tall: true,
		hint: "How the titles around differ, and how many. Tap one to keep only those.",
		tokens: (ctx) => mx.active(ctx),
		top: (ctx, tokens) => {
			const entries = legend(ctx, tokens)
			if (!entries.length && !tokens.length)
				return `<p class="rm-say"><span>${ctx.list && !ctx.soft ? "The titles around differ in no clear way." : "Reading the neighborhood…"}</span></p>`
			const at = (ctx.st.mem.at as Record<string, string> | undefined) ?? {}
			const on = tokens.map((token) => {
				const key = kit.tok(token)?.key ?? ""
				return mx.chip(ctx, { act: "lg", arg: token, token, label: at[token] === ctx.c.k ? kit.low(key) : kit.word(key), more: at[token] === ctx.c.k ? kit.tok(token)?.op === ">" : undefined, v: core.val(ctx.c, key), on: true, rest: "", color: mx.colorOf(ctx, token) })
			})
			const rest = entries.map((entry) =>
				mx.chip(ctx, { act: "lg", arg: entry.token, token: entry.token, label: kit.low(kit.tok(entry.token)?.key ?? ""), more: kit.tok(entry.token)?.op === ">", v: core.val(ctx.c, kit.tok(entry.token)?.key ?? ""), on: false, rest: String(entry.n) }),
			)
			return `<div class="ix-row ix-4" role="group" aria-label="How the titles around differ">${on
				.concat(rest)
				.slice(0, Math.max(4, on.length))
				.join("")}</div>`
		},
		note: (_ctx, tokens, list, places, more) =>
			tokens.length
				? `Only titles with <b>${tokens.map((token) => `${core.esc(kit.low(kit.tok(token)?.key ?? ""))} ${mx.level(token)}`).join("</b> and <b>")}</b>. A colored line marks the posters that came in for it.${
						list.length < places && !more ? ` These ${list.length} are all there are.` : ""
					}`
				: "Each chip is one way the titles around differ, with how many do. Tap it to keep only those.",
		act: (ctx, name, arg) => {
			if (name !== "lg") return false
			mx.choose(ctx, arg, 3)
			return true
		},
		will: (ctx, name, arg) => (name === "lg" ? mx.after(ctx, arg, 3) : null),
		deco: (ctx, _list, places) => {
			const mark = mx.marks(ctx, mx.active(ctx), places)
			return mark ? (t) => ({ inner: mark(t), extra: "" }) : null
		},
	})
}

/**
 * mix3, one heading. Takes the look of the heading's chips and the legend's counts. Improves what made the heading
 * feel strange: nothing collects by itself, the visitor sets one direction with a tap and lets it go with a tap, a
 * line always says where the walk is heading and how far it has come, and the posters that lead furthest that way
 * are marked. The direction is read again against every title stepped onto, so it keeps climbing.
 */
const mix3: MixForm = (core, kit, mx) => {
	type Heading = { key: string; up: boolean; from: number; at: string; k: string }
	const headed = (ctx: PlayCtx) => (ctx.st.mem.hd as Heading | undefined) ?? null
	/** More, or less, than the title in the middle: two levels where there is room, and never back. */
	const tokenOf = (ctx: PlayCtx, key: string, up: boolean) => {
		const v = core.val(ctx.c, key)
		return up ? `${key}>${Math.min(9, v + 2)}` : `${key}<${Math.max(1, v - 2)}`
	}
	type Offer = { key: string; up: boolean; n: number }
	/** The directions this neighborhood has titles for: what the title has little of, as more, and much of, as less. */
	const offers = (ctx: PlayCtx): Offer[] => {
		if (ctx.e.ui.of) return ctx.e.ui.of as Offer[]
		if (!ctx.list || !ctx.c.s) return []
		const order = kit.WORDS
		const pick = (up: boolean, max: number) => {
			const families: Record<number, boolean> = {}
			const out: Offer[] = []
			const keys = order
				.filter((key) => (up ? core.val(ctx.c, key) <= 5 : core.val(ctx.c, key) >= 5))
				.sort((a, b) => (up ? core.val(ctx.c, a) - core.val(ctx.c, b) : core.val(ctx.c, b) - core.val(ctx.c, a)) || order.indexOf(a) - order.indexOf(b))
			for (const key of keys) {
				if (out.length >= max || families[kit.X.w[key][4]]) continue
				const n = mx.count(ctx, [tokenOf(ctx, key, up)])
				if (n < 4) continue
				families[kit.X.w[key][4]] = true
				out.push({ key, up, n })
			}
			return out
		}
		const more = pick(true, 3)
		const less = pick(false, 2)
		const out: Offer[] = []
		for (let i = 0; i < 3; i++) {
			if (more[i]) out.push(more[i])
			if (less[i]) out.push(less[i])
		}
		if (!ctx.soft && out.length) ctx.e.ui.of = out
		return out
	}
	const dir = (up: boolean) => (up ? "more" : "less")
	return kit.make({
		name: "mix3",
		mode: "0",
		th: 54,
		tall: true,
		hint: "Nearest first. Tap a chip to head one way, tap it again to let go.",
		tokens: (ctx) => {
			const h = headed(ctx)
			return h && ctx.c.s ? [tokenOf(ctx, h.key, h.up)] : []
		},
		// The heading as it will be read against a title that is about to be stepped onto.
		next: (ctx, t) => {
			const h = headed(ctx)
			return h && t.s ? [tokenOf({ ...ctx, c: t }, h.key, h.up)] : []
		},
		top: (ctx, tokens) => {
			const h = headed(ctx)
			const all = offers(ctx).filter((o) => !h || o.key !== h.key)
			let line = '<b>Heading nowhere yet</b><span>tap a chip to set one</span>'
			let chips = ""
			if (h) {
				const v = core.val(ctx.c, h.key)
				const walked = ctx.c.k !== h.k
				line = `<b>Heading: ${dir(h.up)} ${kit.emo(h.key)} ${core.esc(kit.low(h.key))}</b><span>${
					walked ? `${h.from} → ${v} since ${core.esc(h.at)}` : `every title around has ${mx.orMore(tokens[0] ?? "")}`
				}</span>`
				chips = mx.chip(ctx, { act: "hd", arg: `${h.key}:${h.up ? 1 : 0}`, token: tokens[0] ?? "", label: kit.low(h.key), more: h.up, v, on: true, rest: "", color: mx.SLOTS[0], hint: "let go" })
			}
			chips += all
				.slice(0, h ? 2 : 4)
				.map((o) =>
					mx.chip(ctx, { act: "hd", arg: `${o.key}:${o.up ? 1 : 0}`, token: tokenOf(ctx, o.key, o.up), label: kit.low(o.key), more: o.up, v: core.val(ctx.c, o.key), on: false, rest: String(o.n) }),
				)
				.join("")
			if (!chips) chips = `<span class="ix-no">${ctx.list && !ctx.soft ? "No clear way out of here: every title around is much the same." : "Reading the neighborhood…"}</span>`
			return `<div class="ix-hd"><p class="ix-ln" data-r-head="">${line}</p><div class="ix-chs" role="group" aria-label="Head one way">${chips}</div></div>`
		},
		note: (ctx, tokens, list, places, more) => {
			const h = headed(ctx)
			return h
				? `Every title around has ${dir(h.up)} ${core.esc(kit.low(h.key))} than ${core.esc(ctx.c.t)} (${mx.orMore(tokens[0] ?? "")}). ${h.up ? "▲" : "▼"} marks the ones that lead furthest.${
						list.length < places && !more ? ` These ${list.length} are all there are.` : ""
					}`
				: "Nothing but likeness decides the map. A chip sets one heading, and a number says how many titles it has here."
		},
		act: (ctx, name, arg) => {
			if (name !== "hd") return false
			const [key, up] = arg.split(":")
			const h = headed(ctx)
			const same = h && h.key === key && h.up === (up === "1")
			ctx.st.mem.hd = same ? undefined : { key, up: up === "1", from: core.val(ctx.c, key), at: ctx.c.t, k: ctx.c.k }
			mx.flash(ctx, same ? "" : tokenOf(ctx, key, up === "1"))
			return true
		},
		will: (ctx, name, arg) => {
			if (name !== "hd") return null
			const [key, up] = arg.split(":")
			const h = headed(ctx)
			return h && h.key === key && h.up === (up === "1") ? [] : [tokenOf(ctx, key, up === "1")]
		},
		deco: (ctx, _list, places) => {
			const h = headed(ctx)
			if (!h || !ctx.c.s) return null
			const token = tokenOf(ctx, h.key, h.up)
			const mark = mx.marks(ctx, [token], places)
			const n = kit.tok(token)?.n ?? 0
			return (t) => {
				const far = t.s && (h.up ? core.val(t, h.key) >= Math.min(10, n + 2) : core.val(t, h.key) <= Math.max(0, n - 2))
				return { inner: `${mark ? mark(t) : ""}${far ? `<i class="ix-up" style="--c:${mx.SLOTS[0]}" aria-hidden="true">${h.up ? "▲" : "▼"}</i>` : ""}`, extra: "" }
			}
		},
	})
}

/**
 * mix4, signposts. Takes the words form's rule that nothing but likeness decides the map, and the heading's line.
 * Improves how the words are shown: a heading, two or three plain phrases with counts, each phrase's posters marked
 * with its trait in its color, and a phrase that can be followed: its posters stay lit through the walk and the
 * line counts how far that trait has come. The way to head somewhere is to tap a marked poster.
 */
const mix4: MixForm = (core, kit, mx) => {
	type Pin = { key: string; up: boolean; from: number; at: string; k: string }
	type Phrase = { key: string; up: boolean; n: number; c: string }
	const pinned = (ctx: PlayCtx) => (ctx.st.mem.pin as Pin | undefined) ?? null
	/** How far a title is along a phrase from the title in the middle: 0 when it is not part of it. */
	const part = (ctx: PlayCtx, t: PlayTitle, key: string, up: boolean, by: number) => {
		const d = (core.val(t, key) - core.val(ctx.c, key)) * (up ? 1 : -1)
		return t.s && d >= by ? d : 0
	}
	/** The phrases of the titles on the map: the followed one first, then the ways most of the others differ. */
	const phrases = (ctx: PlayCtx, list: PlayTitle[], places: number): Phrase[] => {
		const pin = pinned(ctx)
		const id = `${places}|${pin ? `${pin.key}${pin.up}` : ""}`
		const kept = ctx.e.ui.ph as { id: string; list: Phrase[] } | undefined
		if (kept && kept.id === id) return kept.list
		if (!ctx.c.s) return []
		const shown = list.slice(0, places).filter((t) => t.s)
		const all: Phrase[] = []
		for (const key of kit.WORDS)
			for (const up of [true, false]) {
				if (pin && pin.key === key) continue
				const n = shown.filter((t) => part(ctx, t, key, up, 3) > 0).length
				if (n >= 3) all.push({ key, up, n, c: "" })
			}
		all.sort((a, b) => b.n - a.n || kit.WORDS.indexOf(a.key) - kit.WORDS.indexOf(b.key))
		const out: Phrase[] = pin ? [{ key: pin.key, up: pin.up, n: shown.filter((t) => part(ctx, t, pin.key, pin.up, 2) > 0).length, c: "" }] : []
		// The way most titles here have more of something goes first: it is the more inviting way out.
		const first = all.filter((p) => p.up)[0]
		if (first && !pin) all.unshift(...all.splice(all.indexOf(first), 1))
		const families: Record<string, boolean> = {}
		for (const p of all) {
			const family = `${kit.X.w[p.key][4]}${p.up}`
			if (out.length >= 3 || families[family]) continue
			families[family] = true
			out.push(p)
		}
		out.forEach((p, i) => {
			p.c = mx.SLOTS[i]
		})
		if (!ctx.soft && shown.length >= 4) ctx.e.ui.ph = { id, list: out }
		return out
	}
	const dir = (up: boolean) => (up ? "more" : "less")
	const tokenOf = (ctx: PlayCtx, p: { key: string; up: boolean }, by: number) => {
		const v = core.val(ctx.c, p.key)
		return p.up ? `${p.key}>${Math.min(10, v + by)}` : `${p.key}<${Math.max(0, v - by)}`
	}
	return kit.make({
		name: "mix4",
		mode: "0",
		th: 54,
		tall: true,
		hint: "Nothing bends this map. The marks say how a title differs: tap a marked poster to go that way.",
		tokens: () => [],
		top: (ctx, _tokens, list, places) => {
			const pin = pinned(ctx)
			const drawn = phrases(ctx, list, places)
			let line = `<b>Around ${core.esc(ctx.c.t)}</b><span>the marks say how a title differs</span>`
			if (pin) {
				const v = core.val(ctx.c, pin.key)
				const n = drawn[0]?.n ?? 0
				line = `<b>Heading: ${dir(pin.up)} ${kit.emo(pin.key)} ${core.esc(kit.low(pin.key))}</b><span>${ctx.c.k !== pin.k ? `${pin.from} → ${v} since ${core.esc(pin.at)}. ` : ""}${
					n ? `${n} marked ${n === 1 ? "poster leads" : "posters lead"} on` : "no title on this map leads on: − shows more"
				}</span>`
			}
			const chips = drawn
				.map((p, i) => {
					const on = Boolean(pin) && i === 0
					return mx.chip(ctx, {
						act: "pin",
						arg: `${p.key}:${p.up ? 1 : 0}`,
						token: tokenOf(ctx, p, on ? 2 : 3),
						label: kit.low(p.key),
						more: p.up,
						v: core.val(ctx.c, p.key),
						on,
						rest: String(p.n),
						color: p.c,
						zone: [core.val(ctx.c, p.key), core.val(ctx.c, p.key)],
						to: String(p.n),
						hint: on ? "let go" : "",
						title: `${p.n} of the titles on the map have ${dir(p.up)} ${kit.low(p.key)}. ${on ? "Followed. Tap to let go." : "Tap to follow it."}`,
					})
				})
				.join("")
			return `<div class="ix-hd ix-sp"><p class="ix-ln" data-r-head="">${line}</p><div class="ix-chs" role="group" aria-label="How the titles on the map differ">${
				chips || `<span class="ix-no">${ctx.list && !ctx.soft ? "The titles on the map are much the same." : "Reading the titles on the map…"}</span>`
			}</div></div>`
		},
		note: (ctx) =>
			pinned(ctx)
				? "The map is still the nearest titles: following a phrase only keeps its posters lit. Tap one of them to go that way."
				: "The map is always the nearest titles. A mark on a poster says how it differs most. Tap a phrase to follow it.",
		act: (ctx, name, arg) => {
			if (name !== "pin") return false
			const [key, up] = arg.split(":")
			const pin = pinned(ctx)
			ctx.st.mem.pin = pin && pin.key === key && pin.up === (up === "1") ? undefined : { key, up: up === "1", from: core.val(ctx.c, key), at: ctx.c.t, k: ctx.c.k }
			return true
		},
		look: (ctx, name, arg) => {
			if (name !== "pin") return null
			const [key, up] = arg.split(":")
			const pin = pinned(ctx)
			return [tokenOf(ctx, { key, up: up === "1" }, pin && pin.key === key ? 2 : 3)]
		},
		deco: (ctx, list, places) => {
			const pin = pinned(ctx)
			const all = phrases(ctx, list, places)
			if (!all.length || !ctx.c.s) return null
			return (t) => {
				// The followed phrase alone marks its posters. Otherwise a poster wears the phrase it is furthest along.
				let best: Phrase | null = null
				let far = 0
				for (const p of pin ? all.slice(0, 1) : all) {
					const d = part(ctx, t, p.key, p.up, pin ? 2 : 3)
					if (d > far) {
						far = d
						best = p
					}
				}
				return best
					? { inner: `<i class="ix-b${pin ? " ix-bp" : ""}" style="--c:${best.c}" aria-hidden="true">${kit.emo(best.key)}</i>`, extra: pin ? `;--oc:${best.c}` : "" }
					: { inner: "", extra: pin ? ";--fd2:1" : "" }
			}
		},
	})
}

/**
 * mix5, before and after. Takes the bars and their principle, and the words form's look at the whole map. Shows a
 * change as the before and after of the fingerprint: every bar has a mark for where the titles around sit, and the
 * gap between the bar and its mark is green where they have more and red where they have less. Pointing at a bar
 * moves all the marks to where they would be, so the side effects of a choice show before it is made. One change
 * at a time.
 */
const mix5: MixForm = (core, kit, mx) => {
	const bars = (ctx: PlayCtx, tokens: string[]) => {
		const own = kit.rule("bars", (key) => core.val(ctx.c, key), [], kit.X.w)
		const keys = own.map((token) => kit.tok(token)?.key)
		const here = own.map((token) => tokens.filter((t) => kit.tok(t)?.key === kit.tok(token)?.key)[0] ?? token)
		return tokens
			.filter((t) => keys.indexOf(kit.tok(t)?.key) < 0)
			.concat(here)
			.slice(0, 6)
	}
	const round = (n: number) => Math.round(n * 10) / 10
	return kit.make({
		name: "mix5",
		mode: "bars",
		th: 56,
		tall: true,
		big: true,
		hint: "Its fingerprint, with a mark per bar for the titles around. Tap a bar to pull them away.",
		tokens: (ctx) => mx.active(ctx),
		top: (ctx, tokens, list, places) => {
			if (!ctx.c.s) return '<p class="rm-say"><span>Its fingerprint is on its way.</span></p>'
			const shown = list.slice(0, places).filter((t) => t.s)
			return `<div class="ix-row ix-6 ix-ba" role="group" aria-label="The fingerprint of ${core.esc(ctx.c.t)}, and where the titles around sit.">${bars(ctx, tokens)
				.map((token) => {
					const key = kit.tok(token)?.key ?? ""
					const v = core.val(ctx.c, key)
					const m = shown.length ? mx.mean(shown, key) : v
					const on = tokens.indexOf(token) >= 0
					return mx.chip(ctx, {
						act: "ba",
						arg: token,
						token,
						label: kit.word(key),
						v,
						on,
						rest: String(v),
						wide: ` ▾${Math.round(m)}`,
						to: `${v} ▾${Math.round(m)}`,
						tone: m >= v ? "up" : "dn",
						color: mx.SLOTS[0],
						around: m,
						was: ctx.prev?.s && Math.abs(core.val(ctx.prev, key) - v) >= 2 ? core.val(ctx.prev, key) : undefined,
						zone: [Math.min(v, round(m)), Math.max(v, round(m))],
						title: `${kit.word(key)}: ${v} of 10 here, ${Math.round(m)} on average around. Tap for titles ${kit.tok(token)?.op === ">" ? "with" : "without"} it.`,
					})
				})
				.join("")}</div>`
		},
		note: (_ctx, tokens, list, places, more) =>
			tokens.length
				? `Around it: titles ${kit.withOrWithout(tokens)}. The marks on the bars are where they sit, green above it and red below.${list.length < places && !more ? ` These ${list.length} are all there are.` : ""}`
				: "A bar is its level, the mark on it is where the titles around sit. Point at a bar to see where a tap would move the marks.",
		act: (ctx, name, arg) => {
			if (name !== "ba") return false
			mx.choose(ctx, arg, 1)
			return true
		},
		will: (ctx, name, arg) => (name === "ba" ? mx.after(ctx, arg, 1) : null),
		// The marks of all bars move to where the titles would sit after the tap, and back when the pointer leaves.
		shown: (root, ctx, tokens) => {
			const all = root.querySelectorAll(".ix-ba .ix-c")
			const places = Math.max(1, root.querySelectorAll("[data-r-w] > [data-r-k]").length - 1)
			const would = tokens ? kit.around(ctx, tokens).slice(0, places).filter((t) => t.s) : []
			for (let i = 0; i < all.length; i++) {
				const el = all[i] as HTMLElement & { __was?: string[] }
				const key = el.getAttribute("data-k") ?? ""
				const text = el.querySelector(".ix-p")
				if (!el.__was) el.__was = [el.style.getPropertyValue("--m"), el.style.getPropertyValue("--a"), el.style.getPropertyValue("--b"), el.getAttribute("data-d") ?? "", text?.textContent ?? ""]
				const v = core.val(ctx.c, key)
				const m = would.length >= 3 ? round(mx.mean(would, key)) : null
				el.style.setProperty("--m", m === null ? el.__was[0] : String(m))
				el.style.setProperty("--a", m === null ? el.__was[1] : String(Math.min(v, m)))
				el.style.setProperty("--b", m === null ? el.__was[2] : String(Math.max(v, m)))
				el.setAttribute("data-d", m === null ? el.__was[3] : m >= v ? "up" : "dn")
				if (text) text.textContent = m === null ? el.__was[4] : `${v} ▾${Math.round(m)}`
				if (m === null) el.removeAttribute("data-r-wd")
				else el.setAttribute("data-r-wd", "")
			}
		},
		deco: (ctx, _list, places) => {
			const mark = mx.marks(ctx, mx.active(ctx), places)
			return mark ? (t) => ({ inner: mark(t), extra: "" }) : null
		},
	})
}

/**
 * mix6, keep what you found. Takes the heading's chips that appear by themselves from where the walk went, and
 * its look. Improves the one thing that made it strange: a chip is only a readout of the walk (the level at the
 * start, the level now) until the visitor taps it. Only then do the rings keep it, at a level the chip states.
 * Before the first step the place of the chips says what the map has much of and hardly any of.
 */
const mix6: MixForm = (core, kit, mx) => {
	type Moved = { key: string; d: number; v: number; was: number }
	const drift = (ctx: PlayCtx): Moved[] => {
		if (!ctx.c.s || !ctx.root.s || ctx.c.k === ctx.root.k) return []
		return kit.WORDS.map((key) => ({ key, d: core.val(ctx.c, key) - core.val(ctx.root, key), v: core.val(ctx.c, key), was: core.val(ctx.root, key) }))
			.filter((e) => Math.abs(e.d) >= 3)
			.sort((a, b) => Math.abs(b.d) - Math.abs(a.d))
			.slice(0, 3)
	}
	/** What a tap keeps: the trait may fall back one level from where the walk has brought it, and no further. */
	const tokenOf = (e: Moved) => (e.d > 0 ? `${e.key}>${Math.max(e.was + 1, e.v - 1)}` : `${e.key}<${Math.min(e.was - 1, e.v + 1)}`)
	return kit.make({
		name: "mix6",
		mode: "0",
		th: 54,
		tall: true,
		hint: "Walk. What you move toward shows up here, and stays only if you tap it.",
		tokens: (ctx) => mx.active(ctx),
		top: (ctx, tokens, list, places) => {
			const kept = tokens.map((token) => {
				const key = kit.tok(token)?.key ?? ""
				return mx.chip(ctx, { act: "kp", arg: token, token, label: kit.low(key), v: core.val(ctx.c, key), on: true, rest: "", color: mx.colorOf(ctx, token), hint: "kept" })
			})
			const found = drift(ctx)
				.filter((e) => !tokens.some((t) => kit.tok(t)?.key === e.key))
				.map((e) =>
					mx.chip(ctx, {
						act: "kp",
						arg: tokenOf(e),
						token: tokenOf(e),
						label: kit.low(e.key),
						more: e.d > 0,
						v: e.v,
						on: false,
						rest: `${e.was}→${e.v}`,
						was: e.was,
						zone: [Math.min(e.was, e.v), Math.max(e.was, e.v)],
						title: `${kit.word(e.key)} went from ${e.was} to ${e.v} since ${ctx.root.t}. Tap to keep it at ${mx.orMore(tokenOf(e))}.`,
					}),
				)
			const chips = kept.concat(found).slice(0, 3)
			if (chips.length)
				return `<div class="ix-hd ix-kp"><p class="ix-ln" data-r-head=""><b>Since ${core.esc(ctx.root.t)}</b><span>${
					kept.length ? "the rings keep what is lit" : "tap one to keep it while you walk"
				}</span></p><div class="ix-chs" role="group" aria-label="What the walk moved toward">${chips.join("")}</div></div>`
			// Nothing has moved yet: what the titles on the map have much of, and hardly any of.
			const shown = list.slice(0, places).filter((t) => t.s)
			const levels = kit.WORDS.map((key) => ({ key, m: mx.mean(shown, key) }))
			const much = levels
				.filter((e) => e.m >= 6.5)
				.sort((a, b) => b.m - a.m)
				.slice(0, 2)
			const little = levels
				.filter((e) => e.m <= 2)
				.sort((a, b) => a.m - b.m)
				.slice(0, 1)
			const tag = (all: { key: string; m: number }[], text: string) =>
				all.length ? `<span class="ix-t"><small>${text}</small>${all.map((e) => `<i>${kit.emo(e.key)}</i>${core.esc(kit.low(e.key))}`).join("<small>,</small>")}</span>` : ""
			const tags = shown.length < 4 ? "" : tag(much, "much") + tag(little, "hardly any")
			return `<div class="ix-hd ix-kp"><p class="ix-ln" data-r-head=""><b>${ctx.c.k === ctx.root.k ? `Around ${core.esc(ctx.c.t)}` : "Still close to where you started"}</b><span>walk, and what changes shows here</span></p><div class="ix-chs ix-ts">${
				tags || '<span class="ix-no">Reading the titles on the map…</span>'
			}</div></div>`
		},
		note: (ctx, tokens, list, places, more) =>
			tokens.length
				? `The rings keep <b>${tokens.map((token) => `${core.esc(kit.low(kit.tok(token)?.key ?? ""))} ${mx.level(token)}`).join("</b> and <b>")}</b>. Tap a lit chip to let it go.${
						list.length < places && !more ? ` These ${list.length} are all there are.` : ""
					}`
				: drift(ctx).length
					? "The chips say how far the walk has come since the start. Nothing holds the map to them until you tap one."
					: "Nothing to operate yet: the map is the nearest titles. What your walk moves toward will show above.",
		act: (ctx, name, arg) => {
			if (name !== "kp") return false
			mx.choose(ctx, arg, 3)
			return true
		},
		will: (ctx, name, arg) => (name === "kp" ? mx.after(ctx, arg, 3) : null),
		deco: (ctx, _list, places) => {
			const mark = mx.marks(ctx, mx.active(ctx), places)
			return mark ? (t) => ({ inner: mark(t), extra: "" }) : null
		},
	})
}

export const MIX_FORMS: Record<string, MixForm> = { mix1, mix2, mix3, mix4, mix5, mix6 }
