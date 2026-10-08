// PROTOTYPE for "Prototype native-scroll carousels on title pages", eighth round. Throwaway code: not for production.
//
// Ten variations on the seventh round's scrub strip (play8). What the owner found wrong there is the scale: a strip
// ran from "More intimate" to "Bigger", and a title that is both landed at the intimate end. The cause is how the
// levels were read (see the round's report in the ticket): an end was the absence of the other end or a difference
// of two means, a narrow range of levels was stretched over the whole strip, and ties were shown as a ranking.
//
// Every form here keeps what worked: one strip that scrolls sideways natively, the title under the marker shown
// large, a step drawn in the browser with no request. They differ in how a scale is built and read, how it is
// chosen, how it is labeled, how traits are combined, and how many strips there are:
// - scrub1: one trait as its own scale, absolute from 0 to 10, with level ticks and gaps. No opposites.
// - scrub2: the seventh round's six axes, but an end is only claimed where it holds. The rest is "about the same".
// - scrub3: the seventh round's order, read twice: "of these" (relative) and "in general" (absolute).
// - scrub4: two traits that can both be true as two dimensions: along the strip, and in a band.
// - scrub5: the title's own fingerprint is the picker, with all 74 attributes behind five families.
// - scrub6: the picker leads with what varies in this neighborhood, marks what is flat, and has a search.
// - scrub7: two traits combined: ordered by how much a title has of both.
// - scrub8: one trait held high, another scrubbed.
// - scrub9: a recipe of up to three chips, more of this and less of that.
// - scrub10: three linked strips, one per fingerprint family.
//
// `scrubKit` holds what the forms share. Both it and each form are functions with no outside references, because
// they run as the page's inline script (see play-engine.ts).
import type {
	PlayAxis,
	PlayCore,
	PlayCtx,
	PlayEntry,
	PlayForm,
	PlayTitle,
} from "~/ui/prototype-carousels/play-engine"
import type { ScrubExtra } from "~/ui/prototype-carousels/scrub-meta"

export type ScrubCell =
	| { t: PlayTitle; inner?: string; band?: number; v?: string }
	| { tick: string; sub?: string; off?: boolean; l?: string; wide?: boolean }
export interface ScrubRail {
	cells: ScrubCell[]
	small?: boolean
	/** Three labels, top to bottom, when the rail has bands. */
	bands?: string[]
	head?: string
}
export interface ScrubModel {
	pick: string
	rails: ScrubRail[]
	/** The headline, the lines, and the ruler for the title under the marker. All markup. */
	said: (t: PlayTitle) => string
	lines: (t: PlayTitle) => string
	foot: (t: PlayTitle) => string
	heads?: (t: PlayTitle) => string[]
	why?: string | null
	compact?: boolean
}
export interface ScrubSpec {
	name: string
	hint: string
	model: (ctx: PlayCtx) => ScrubModel
	act?: (ctx: PlayCtx, name: string, arg: string) => boolean
	input?: (ctx: PlayCtx, el: Element, section: Element) => void
}
export type ScrubKit = ReturnType<typeof scrubKit>
type ScrubForm = (core: PlayCore, kit: ScrubKit) => PlayForm
type Strip = HTMLElement & { __set?: number }

export function scrubKit(core: PlayCore, X: ScrubExtra) {
	const { esc, val } = core
	const T = core.M.traits
	// The widths of a poster's place, a small poster's place, a tick, and a zone's name: the strip's positions are
	// computed from them, so nothing is measured.
	const W = 58
	const WS = 42
	const TK = 26
	const TKW = 96
	const WORDS = ["none", "a trace", "a little", "some", "a lot", "defining"]
	/** The glossary's reading of a level: 0 is not present, 1 is minimal, 10 is defining. */
	const word = (v: number) => WORDS[v <= 0 ? 0 : Math.ceil(Math.min(10, v) / 2)]
	const nm = (key: string) => `<i>${T[key].e}</i> ${esc(T[key].l)}`
	const fx = (v: number) => String(Math.round(v * 10) / 10)
	const mean = (values: number[]) =>
		values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : 0

	/** The titles a strip can show: where you stand, the neighborhood nearest first, where you came from, the page. */
	const pool = (ctx: PlayCtx) => {
		const seen: Record<string, boolean> = {}
		const out: PlayTitle[] = []
		const add = (t: PlayTitle | null | undefined) => {
			if (!t || seen[t.k]) return
			seen[t.k] = true
			out.push(t)
		}
		add(ctx.c)
		for (const t of ctx.list ?? []) if (t.s) add(t)
		if (ctx.prev?.s) add(ctx.prev)
		if (ctx.root?.s) add(ctx.root)
		return out
	}
	/** The titles a cap never removes. */
	const pins = (ctx: PlayCtx) => {
		const pin: Record<string, boolean> = {}
		pin[ctx.c.k] = true
		pin[ctx.root.k] = true
		if (ctx.prev) pin[ctx.prev.k] = true
		if (ctx.e.ui.f) pin[ctx.e.ui.f] = true
		return pin
	}
	const capped = (ctx: PlayCtx, titles: PlayTitle[], cap: number) => {
		const pin = pins(ctx)
		let free = cap
		return titles.filter((t) => pin[t.k] || free-- > 0)
	}
	/** The two halves of one of the seventh round's axes, as the engine computes them. */
	const halves = (axis: PlayAxis, t: PlayTitle) => {
		const plus = axis.plus
			.map((key) => ({ key, v: val(t, key) }))
			.sort((a, b) => b.v - a.v)
			.slice(0, axis.top ?? axis.plus.length)
		const minus = axis.minus.map((key) => ({ key, v: val(t, key) }))
		return {
			plus: mean(plus.map((p) => p.v)),
			minus: minus.length ? mean(minus.map((p) => p.v)) : null,
			keys: plus
				.slice(0, 2)
				.map((p) => p.key)
				.concat(minus.sort((a, b) => b.v - a.v).slice(0, 1).map((p) => p.key)),
		}
	}
	/** How much a neighborhood spreads on each attribute: the tenth and ninetieth percentile, and the deviation. */
	const spread = (titles: PlayTitle[], keys: string[]) =>
		keys.map((key) => {
			const v = titles.map((t) => val(t, key)).sort((a, b) => a - b)
			const m = mean(v)
			return {
				key,
				lo: v[Math.floor((v.length - 1) * 0.1)] ?? 0,
				hi: v[Math.ceil((v.length - 1) * 0.9)] ?? 0,
				sd: Math.sqrt(mean(v.map((x) => (x - m) ** 2))),
			}
		})
	/**
	 * The traits whose level is a degree of something a title has more or less of. The World family is left out: its
	 * levels say whether a theme is there (crime, warfare, a future setting), and "less" of a theme is no direction.
	 */
	const degree = () => {
		const themes = X.groups[2]?.k ?? []
		return core.M.keys.filter((key) => T[key].on && themes.indexOf(key) < 0)
	}
	/** The degree trait a neighborhood spreads on most, apart from the ones named. */
	const varied = (titles: PlayTitle[], skip: string[] = []) =>
		spread(
			titles,
			degree().filter((key) => skip.indexOf(key) < 0),
		)
			.sort((a, b) => b.sd - a.sd)
			.map((s) => s.key)
	/** The traits a form offers as chips: the page title's strongest, and the ones its neighborhood spreads on. */
	const menu = (ctx: PlayCtx, chosen: string[], count = 10) => {
		const all = degree()
		const wide = varied(pool(ctx))
		const own = core.own(ctx.root, 12).filter((key) => all.indexOf(key) >= 0)
		const out: string[] = []
		const add = (key: string | undefined) => {
			if (key && T[key] && out.indexOf(key) < 0) out.push(key)
		}
		for (const key of chosen) add(key)
		for (let i = 0; i < 6 && out.length < count; i++) {
			add(own[i])
			add(wide[i])
		}
		return out
	}

	// --- Markup ---------------------------------------------------------------------------------------------------
	const row = (
		act: string,
		items: { a: string; h: string; on?: boolean; cls?: string }[],
		lead = "",
		attrs = "",
	) =>
		`<div class="sc-row"${attrs}>${lead}${items
			.map(
				(item) =>
					`<button type="button" class="sc-ch ${item.cls ?? ""}" data-pl-act="${act}" data-arg="${esc(item.a)}" aria-pressed="${Boolean(item.on)}">${item.h}</button>`,
			)
			.join("")}</div>`
	/** One trait of one title as a bar with its level, and a notch where the title you stand on is. */
	const bar = (key: string, v: number, ref?: number, lead = "") =>
		`<span class="sc-bl" style="--c:${T[key].c}"><em>${lead}${nm(key)}</em><s><u style="width:${v * 10}%"></u>${
			ref === undefined ? "" : `<q style="left:${ref * 10}%"></q>`
		}</s><b>${v}</b></span>`
	/** The fixed ruler under a strip: every level from 0 to 10, how many titles sit on it, and three marks. */
	const ruler = (
		counts: number[],
		marks: { f: number; h: number; p: number },
		name: string,
	) => {
		const most = Math.max(1, ...counts)
		const at = (v: number) => Math.max(0, Math.min(10, Math.round(v)))
		return `<div class="sc-ru"><span class="sc-rl"><b>0</b> none</span><span class="sc-rb" role="group" aria-label="${esc(
			`${name}: levels 0 to 10`,
		)}">${counts
			.map(
				(n, level) =>
					`<button type="button" class="sc-rc" data-pl-act="lv" data-arg="${level}"${level === at(marks.f) ? ' data-f=""' : ""}${
						level === at(marks.h) ? ' data-h=""' : ""
					}${level === at(marks.p) ? ' data-p=""' : ""} data-n="${n}" aria-label="${esc(`Level ${level}: ${n} titles`)}"><u style="height:${
						n ? Math.max(2, Math.round((n / most) * 14)) : 0
					}px"></u><b>${level}</b></button>`,
			)
			.join("")}</span><span class="sc-rl">defining <b>10</b></span></div>`
	}
	/**
	 * A strip along a level from 0 to 10: a tick per level, then the titles on it, nearest first. A level without a
	 * title keeps its tick, so a gap shows. Titles on one level are a tie, and the tick says how many there are.
	 */
	const levelCells = (
		ctx: PlayCtx,
		titles: PlayTitle[],
		f: (t: PlayTitle) => number,
		o: {
			cap: number
			v?: (t: PlayTitle) => string
			inner?: (t: PlayTitle) => string
			band?: (t: PlayTitle) => number
		},
	) => {
		const by: PlayTitle[][] = []
		for (let level = 0; level <= 10; level++) by.push([])
		for (const t of titles) by[Math.max(0, Math.min(10, Math.round(f(t))))].push(t)
		const cells: ScrubCell[] = []
		const counts: number[] = []
		by.forEach((group, level) => {
			counts.push(group.length)
			const shown = capped(ctx, group, o.cap)
			cells.push({
				tick: String(level),
				sub: shown.length < group.length ? `${shown.length} of ${group.length}` : "",
				off: !group.length,
				l: String(level),
			})
			for (const t of shown)
				cells.push({
					t,
					v: o.v ? o.v(t) : String(f(t)),
					inner: o.inner?.(t),
					band: o.band?.(t),
				})
		})
		return { cells, counts }
	}
	const railOf = (ctx: PlayCtx, rail: ScrubRail, index: number, fk: string) => {
		const w = rail.small ? WS : W
		let x = 0
		let at = 0
		rail.cells.forEach((cell, n) => {
			if ("t" in cell && cell.t.k === fk) at = n
		})
		const cells = rail.cells
			.map((cell, n) => {
				if ("tick" in cell) {
					const tw = cell.wide ? TKW : TK
					x += tw
					return `<i class="sc-tk"${cell.wide ? ' data-wide=""' : ""}${cell.off ? ' data-off=""' : ""}${
						cell.l === undefined ? "" : ` data-l="${esc(cell.l)}"`
					} data-x="${x - tw / 2}"><b>${esc(cell.tick)}</b>${cell.sub ? `<small>${esc(cell.sub)}</small>` : ""}</i>`
				}
				const t = cell.t
				x += w
				const attrs = ` data-k="${t.k}" data-x="${x - w / 2}"${cell.v === undefined ? "" : ` data-v="${esc(cell.v)}"`}${
					t.k === fk ? ' data-on=""' : ""
				}`
				const style = cell.band === undefined ? "" : `--b:${cell.band}`
				const came = Boolean(ctx.prev && t.k === ctx.prev.k)
				const inner = `${cell.inner ?? ""}${
					t.k === ctx.root.k && t.k !== ctx.c.k && !came ? '<span class="sc-pg">this page</span>' : ""
				}`
				return t.k === ctx.c.k
					? `<span class="sc-i sc-me"${style ? ` style="${style}"` : ""}${attrs}><img alt="" decoding="async" src="${esc(
							core.src(t.p),
						)}">${inner}</span>`
					: core.poster(t, {
							cls: "sc-i",
							style,
							came,
							inner,
							attrs: `${attrs}${Math.abs(n - at) > 4 ? ' data-pl-far=""' : ""}`,
						})
			})
			.join("")
		return `${rail.head ?? ""}<div class="sc-rail"${rail.small ? ' data-sz="s"' : ""}${rail.bands ? ' data-bands=""' : ""}><div class="sc-strip" data-sc-strip="${index}" data-pl-input="">${cells}</div><span class="sc-mark" aria-hidden="true"></span>${
			rail.bands
				? `<span class="sc-bn" aria-hidden="true">${rail.bands.map((label) => `<i><span>${label}</span></i>`).join("")}</span>`
				: ""
		}<button type="button" class="sc-nd" data-pl-act="nd" data-arg="-1" aria-label="One title to the left">‹</button><button type="button" class="sc-nd" data-pl-act="nd" data-arg="1" aria-label="One title to the right">›</button></div>`
	}
	const focusOf = (ctx: PlayCtx, m: ScrubModel, t: PlayTitle) => {
		const here = t.k === ctx.c.k
		const came = Boolean(ctx.prev && t.k === ctx.prev.k)
		const body = `<span class="sc-big"><img alt="" decoding="async" src="${esc(core.src(t.p))}"></span><span class="sc-tx"><b>${esc(
			t.t,
		)}</b><small>${esc(t.y)}${t.k === ctx.root.k && !here ? " · this page" : ""}</small><strong>${m.said(t)}</strong>${m.lines(t)}${
			here ? "" : `<em class="sc-go">${came ? "‹ Back to here" : "Stand here ›"}</em>`
		}</span>`
		return here
			? `<span class="sc-f sc-here">${body}</span>`
			: `<button type="button" class="sc-f" data-pl-step="${t.k}" data-via="" data-t="${esc(t.t)}" data-y="${esc(
					t.y,
				)}" data-pl-far=""${came ? ' data-pl-came=""' : ""}>${body}</button>`
	}
	const titleIn = (m: ScrubModel, key: string) => {
		for (const cell of m.rails[0]?.cells ?? [])
			if ("t" in cell && cell.t.k === key) return cell.t
		return undefined
	}

	/** A form from its model: the stage, the scrubbing, the level ruler's taps, and what a step keeps. */
	const form = (spec: ScrubSpec): PlayForm => {
		let memo: { e: PlayEntry; l: PlayTitle[] | null; m: ScrubModel } | null = null
		const modelOf = (ctx: PlayCtx) => {
			if (!memo || memo.e !== ctx.e || memo.l !== ctx.list)
				memo = { e: ctx.e, l: ctx.list, m: spec.model(ctx) }
			return memo.m
		}
		const show = (ctx: PlayCtx, s: Element, m: ScrubModel, t: PlayTitle, from: Element | null) => {
			ctx.e.ui.f = t.k
			const focus = s.querySelector("[data-sc-focus]")
			if (focus) {
				focus.setAttribute("data-k", t.k)
				focus.innerHTML = focusOf(ctx, m, t)
			}
			const foot = s.querySelector("[data-sc-foot]")
			if (foot) foot.innerHTML = m.foot(t)
			if (m.heads) {
				const heads = m.heads(t)
				const slots = s.querySelectorAll("[data-sc-lv]")
				for (let i = 0; i < slots.length; i++) slots[i].innerHTML = heads[i] ?? ""
			}
			const strips = s.querySelectorAll("[data-sc-strip]")
			for (let i = 0; i < strips.length; i++) {
				const strip = strips[i] as Strip
				strip.querySelector("[data-on]")?.removeAttribute("data-on")
				const mine = strip.querySelector(`[data-k="${t.k}"]`)
				if (!mine) continue
				mine.setAttribute("data-on", "")
				// The other strips bring the same title under their markers.
				if (strip !== from) {
					strip.__set = Number(mine.getAttribute("data-x"))
					strip.scrollLeft = strip.__set
				}
			}
		}
		return {
			hint: spec.hint,
			settle: false,
			fly: false,
			carry: () => ({}),
			adopt: (st, stage) => {
				try {
					const kept = stage.firstElementChild?.getAttribute("data-sc-mem")
					if (kept) Object.assign(st.mem, JSON.parse(kept))
				} catch {}
			},
			why: (ctx) => (memo && memo.e === ctx.e ? (memo.m.why ?? null) : null),
			act: (ctx, name, arg, el, s) => {
				if (name === "nd") {
					// With a mouse there may be no way to scroll sideways: the arrows move the strip by one title.
					const strip = el.parentElement?.querySelector("[data-sc-strip]") as Strip | null
					const items = strip ? strip.querySelectorAll("[data-k]") : []
					for (let i = 0; i < items.length; i++) {
						if (!items[i].hasAttribute("data-on")) continue
						const to = items[i + Number(arg)]
						if (strip && to) {
							strip.__set = undefined
							strip.scrollLeft = Number(to.getAttribute("data-x"))
						}
						break
					}
					return false
				}
				if (name === "lv") {
					const strip = s.querySelector("[data-sc-strip]") as Strip | null
					const tick = strip?.querySelector(`.sc-tk[data-l="${arg}"]`)
					const next = tick?.nextElementSibling
					const to = next?.hasAttribute("data-k") ? next : tick
					if (strip && to) {
						strip.__set = undefined
						strip.scrollLeft = Number(to.getAttribute("data-x"))
					}
					return false
				}
				if (!spec.act?.(ctx, name, arg)) return false
				memo = null
				return true
			},
			input: (ctx, el, s) => {
				if (!el.hasAttribute("data-sc-strip")) {
					spec.input?.(ctx, el, s)
					return
				}
				const strip = el as Strip
				const left = strip.scrollLeft
				// A position this script set itself is not a scrub.
				if (strip.__set !== undefined && Math.abs(left - strip.__set) < 2) return
				strip.__set = undefined
				const items = strip.querySelectorAll("[data-k]")
				let key = ""
				let best = 1e9
				for (let i = 0; i < items.length; i++) {
					const d = Math.abs(Number(items[i].getAttribute("data-x")) - left)
					if (d < best) {
						best = d
						key = items[i].getAttribute("data-k") ?? ""
					}
				}
				const focus = s.querySelector("[data-sc-focus]")
				if (!key || !focus || focus.getAttribute("data-k") === key || !core.title(key)?.s) return
				// The strip's own copy of the title: a pack cached on another day may hold other levels for it.
				const m = modelOf(ctx)
				const t = titleIn(m, key)
				if (t) show(ctx, s, m, t, strip)
			},
			after: (s) => {
				// A chosen chip that lies outside its row comes into view.
				const rows = s.querySelectorAll(".sc-row")
				for (let i = 0; i < rows.length; i++) {
					const row = rows[i] as HTMLElement
					const chip = row.querySelector('[aria-pressed="true"]') as HTMLElement | null
					if (!chip || row.scrollWidth <= row.clientWidth) continue
					const left = chip.offsetLeft - row.offsetLeft
					if (left < row.scrollLeft || left + chip.offsetWidth > row.scrollLeft + row.clientWidth)
						row.scrollLeft = Math.max(0, left - 24)
				}
				const strips = s.querySelectorAll("[data-sc-strip]")
				for (let i = 0; i < strips.length; i++) {
					const strip = strips[i] as Strip
					const mine = strip.querySelector("[data-on]")
					if (!mine) continue
					strip.__set = Number(mine.getAttribute("data-x"))
					strip.scrollLeft = strip.__set
				}
			},
			stage: (ctx) => {
				const m = spec.model(ctx)
				memo = { e: ctx.e, l: ctx.list, m }
				const kept = ctx.e.ui.f ? titleIn(m, ctx.e.ui.f) : undefined
				const f = kept ?? ctx.c
				if (!kept) ctx.e.ui.f = undefined
				return `<div class="sc sc-${spec.name}"${m.compact ? ' data-compact=""' : ""} data-sc-mem="${esc(
					JSON.stringify(ctx.st.mem),
				)}"><div class="sc-pick">${m.pick}</div><div class="sc-focus" data-sc-focus="" data-k="${f.k}">${focusOf(
					ctx,
					m,
					f,
				)}</div>${m.rails.map((rail, i) => railOf(ctx, rail, i, f.k)).join("")}<div class="sc-foot" data-sc-foot="">${m.foot(
					f,
				)}</div><span hidden>${core.center(ctx)}</span></div>`
			},
		}
	}

	/** One trait as its own scale: absolute, from none of it to defining, with a tick per level. */
	const single = (
		ctx: PlayCtx,
		key: string,
		o: { pick: string; titles?: PlayTitle[]; cap?: number },
	): ScrubModel => {
		const f = (t: PlayTitle) => val(t, key)
		const { cells, counts } = levelCells(ctx, o.titles ?? pool(ctx), f, { cap: o.cap ?? 6 })
		const own = f(ctx.c)
		return {
			pick: o.pick,
			rails: [{ cells }],
			said: (t) => `${nm(key)} ${f(t)} of 10 · ${word(f(t))}`,
			lines: (t) => {
				if (t.k === ctx.c.k)
					return `${bar(key, own)}<span class="sc-cmp">You stand here. Left is less of it, right is more.</span>`
				const d = f(t) - own
				const told = core.diffs(ctx.c, t, 3).filter((entry) => entry.k !== key).slice(0, 2)
				return `${bar(key, f(t), own)}<span class="sc-cmp">${
					d === 0 ? "The same level as" : `${Math.abs(d)} ${d > 0 ? "more" : "less"} than`
				} ${esc(ctx.c.t)} (${own})</span><span class="sc-df">${told.length ? `Also ${core.sayDiff(told)}` : ""}</span>`
			},
			foot: (t) => ruler(counts, { f: f(t), h: own, p: f(ctx.root) }, T[key].l),
			why: ctx.prev?.s
				? `From ${esc(ctx.prev.t)}: ${nm(key)} ${f(ctx.prev)} → ${own}.`
				: ctx.list
					? `${nm(key)}: these titles run from ${counts.findIndex((n) => n > 0)} to ${
							10 - counts.slice().reverse().findIndex((n) => n > 0)
						}, and ${esc(ctx.c.t)} is at ${own}.`
					: null,
		}
	}

	/** The seventh round's axes, with the one the owner's case is about first. */
	const axes = () => core.M.axes.filter((x) => x.id === "scale").concat(core.M.axes.filter((x) => x.id !== "scale"))

	return {
		X,
		T,
		axes,
		word,
		nm,
		fx,
		mean,
		pool,
		pins,
		capped,
		halves,
		spread,
		degree,
		varied,
		menu,
		row,
		bar,
		ruler,
		levelCells,
		form,
		single,
	}
}

/** scrub1, honest ruler: one trait, from none of it to defining. Only the scale differs from play8. */
const scrub1: ScrubForm = (core, kit) =>
	kit.form({
		name: "scrub1",
		hint: "One trait from none of it to all of it. Drag the strip: every level has its tick, and a gap is a gap.",
		act: (ctx, name, arg) => {
			if (name !== "a" || ctx.st.mem.a === arg) return false
			ctx.st.mem.a = arg
			return true
		},
		model: (ctx) => {
			const mem = ctx.st.mem
			mem.a ??= kit.X.fix[0]
			return kit.single(ctx, mem.a, {
				pick: kit.row(
					"a",
					kit.X.fix.map((key) => ({ a: key, h: kit.nm(key), on: key === mem.a })),
				),
			})
		},
	})

/**
 * scrub2, only clear claims: the seventh round's six axes and words, but a title sits under an end only where the
 * claim holds: its level on that end is at least 6, it is at least 2 past the title you stand on, and the other end
 * doesn't speak against it. A title that is strong on both ends gets its own zone. Everything else is "about the
 * same". Only the scale differs from play8.
 */
const scrub2: ScrubForm = (core, kit) =>
	kit.form({
		name: "scrub2",
		hint: "An end is only claimed where it holds. Everything else is about the same.",
		act: (ctx, name, arg) => {
			if (name !== "x" || ctx.st.mem.x === arg) return false
			ctx.st.mem.x = arg
			return true
		},
		model: (ctx) => {
			const mem = ctx.st.mem
			mem.x ??= "scale"
			const esc = core.esc
			const axis = core.axisOf(mem.x) ?? core.M.axes[0]
			const a = kit.halves(axis, ctx.c)
			const two = a.minus !== null
			const claim = (t: PlayTitle) => {
				if (t.k === ctx.c.k) return 0
				const b = kit.halves(axis, t)
				if (b.minus !== null && a.minus !== null) {
					if (b.plus >= 6.5 && b.minus >= 6.5) return 2
					if (b.plus >= 6 && b.plus - a.plus >= 2 && b.minus <= b.plus - 2) return 1
					if (b.minus >= 6 && b.plus <= b.minus - 2 && (b.minus - a.minus >= 2 || a.plus - b.plus >= 2))
						return -1
					return 0
				}
				if (b.plus >= 6 && b.plus - a.plus >= 2) return 1
				if (b.plus <= 3 && a.plus - b.plus >= 2) return -1
				return 0
			}
			const zones = [
				{ id: -1, name: `Clearly ${axis.lowWord}`, cap: 20 },
				{ id: 0, name: "About the same", cap: 12 },
				{ id: 2, name: "Both at once", cap: 10 },
				{ id: 1, name: `Clearly ${axis.highWord}`, cap: 20 },
			].filter((zone) => two || zone.id !== 2)
			const all = kit.pool(ctx)
			const cells: ScrubCell[] = []
			const counts: Record<string, number> = {}
			for (const zone of zones) {
				const inZone = all.filter((t) => claim(t) === zone.id)
				counts[zone.id] = inZone.length
				const shown = kit
					.capped(ctx, inZone, zone.cap)
					.map((t, i) => ({ t, i }))
					.sort((p, q) => core.level(axis, p.t) - core.level(axis, q.t) || p.i - q.i)
				cells.push({
					tick: zone.name,
					sub: inZone.length
						? shown.length < inZone.length
							? `${shown.length} of ${inZone.length}`
							: String(inZone.length)
						: "none here",
					off: !inZone.length,
					l: String(zone.id),
					wide: true,
				})
				for (const { t } of shown) cells.push({ t, v: String(zone.id) })
			}
			const than = esc(ctx.c.t)
			return {
				pick: kit.row(
					"x",
					kit.axes().map((x) => ({ a: x.id, h: esc(x.name), on: x.id === axis.id })),
				),
				rails: [{ cells }],
				said: (t) => {
					if (t.k === ctx.c.k) return "You stand here"
					const c = claim(t)
					return c === 1
						? `Clearly ${esc(axis.highWord)} than ${than}`
						: c === -1
							? `Clearly ${esc(axis.lowWord)} than ${than}`
							: c === 2
								? `Both at once: ${esc(axis.highMost)} and ${esc(axis.lowMost)}`
								: `About the same as ${than}`
				},
				lines: (t) => {
					const h = kit.halves(axis, t)
					return `${h.keys.map((key) => kit.bar(key, core.val(t, key), t.k === ctx.c.k ? undefined : core.val(ctx.c, key))).join("")}`
				},
				foot: (t) => {
					const c = claim(t)
					return `<p class="sc-note"><b>${counts[-1]}</b> ${esc(axis.lowWord)} · <b>${counts[0]}</b> about the same${
						two ? ` · <b>${counts[2]}</b> both` : ""
					} · <b>${counts[1]}</b> ${esc(axis.highWord)}. ${
						t.k === ctx.c.k || c !== 0
							? "An end needs a level of 6 or more and 2 more than where you stand."
							: "Not 2 apart, or not at 6 on either end: no claim."
					}</p>`
				},
				why: null,
			}
		},
	})

/**
 * scrub3, of these and in general: the seventh round's order, unchanged, read twice. "Of these" is the place on
 * this strip, which is all the old labels could honestly mean. "In general" is what the levels say by themselves.
 * Two rulers show how a narrow range was stretched. Only the reading differs from play8.
 */
const scrub3: ScrubForm = (core, kit) =>
	kit.form({
		name: "scrub3",
		hint: "The same order as before, read twice: its place among these titles, and what its levels say in general.",
		act: (ctx, name, arg) => {
			if (name !== "x" || ctx.st.mem.x === arg) return false
			ctx.st.mem.x = arg
			return true
		},
		model: (ctx) => {
			const mem = ctx.st.mem
			mem.x ??= "scale"
			const axis = core.axisOf(mem.x) ?? core.M.axes[0]
			const lv = (t: PlayTitle) => core.level(axis, t)
			// The seventh round's choice of titles: at most three per half level, nearest first.
			const pin = kit.pins(ctx)
			const buckets: Record<string, number> = {}
			const sorted = kit
				.pool(ctx)
				.filter((t) => {
					const bucket = String(Math.round(lv(t) * 2))
					buckets[bucket] = (buckets[bucket] ?? 0) + 1
					return pin[t.k] || buckets[bucket] <= 3
				})
				.map((t, i) => ({ t, i }))
				.sort((p, q) => lv(p.t) - lv(q.t) || p.i - q.i)
				.map((p) => p.t)
			const n = sorted.length
			const lo = n ? lv(sorted[0]) : 0
			const hi = n ? lv(sorted[n - 1]) : 10
			const place: Record<string, number> = {}
			sorted.forEach((t, i) => {
				place[t.k] = i
			})
			const ord = (i: number) => (i === 1 ? "" : i === 2 ? "2nd " : i === 3 ? "3rd " : `${i}th `)
			const verdict = (t: PlayTitle) => {
				const h = kit.halves(axis, t)
				if (h.minus !== null)
					return h.plus >= 6.5 && h.minus >= 6.5
						? `both ends at once: ${core.esc(axis.highMost)} and ${core.esc(axis.lowMost)}`
						: h.plus >= 6.5 && h.minus < 5
							? `clearly ${core.esc(axis.highMost)}`
							: h.minus >= 6.5 && h.plus < 5
								? `clearly ${core.esc(axis.lowMost)}`
								: "no clear side"
				return h.plus >= 6.5
					? `clearly ${core.esc(axis.highMost)}`
					: h.plus <= 2.5
						? `not ${core.esc(axis.highMost)}`
						: h.plus < 4.5
							? `a little ${core.esc(axis.highMost)}`
							: `somewhat ${core.esc(axis.highMost)}`
			}
			return {
				pick: kit.row(
					"x",
					kit.axes().map((x) => ({ a: x.id, h: core.esc(x.name), on: x.id === axis.id })),
				),
				rails: [{ cells: sorted.map((t) => ({ t, v: kit.fx(lv(t)) })) }],
				said: (t) => {
					const i = place[t.k] ?? 0
					const third = n / 3
					const where =
						i < third
							? `${ord(i + 1)}from the “${core.esc(axis.low)}” end`
							: i >= n - third
								? `${ord(n - i)}from the “${core.esc(axis.high)}” end`
								: "in the middle"
					return `Of these ${n}: ${where}`
				},
				lines: (t) => {
					const h = kit.halves(axis, t)
					return `<span class="sc-abs">In general: ${verdict(t)}</span>${h.keys.map((key) => kit.bar(key, core.val(t, key))).join("")}`
				},
				foot: (t) => {
					const v = lv(t)
					return `<div class="sc-two"><span><small>Of these</small><s><q style="left:${hi > lo ? ((v - lo) / (hi - lo)) * 100 : 50}%"></q></s><small>${kit.fx(
						lo,
					)} to ${kit.fx(hi)}</small></span><span><small>In general</small><s><u style="left:${lo * 10}%;width:${(hi - lo) * 10}%"></u><q style="left:${
						v * 10
					}%"></q></s><small>0 to 10</small></span></div>`
				},
				why: null,
			}
		},
	})

/**
 * scrub4, two at once: two traits that can both be true of a title are two dimensions. One runs along the strip
 * with a tick per level, the other puts the poster in an upper, middle, or lower band.
 */
const scrub4: ScrubForm = (core, kit) =>
	kit.form({
		name: "scrub4",
		hint: "Two traits at once: one along the strip, one as the band a poster sits in.",
		act: (ctx, name, arg) => {
			const mem = ctx.st.mem
			if (name === "sw") {
				mem.sw = mem.sw ? 0 : 1
				return true
			}
			if (name !== "p" || String(mem.p) === arg) return false
			mem.p = Number(arg)
			mem.sw = 0
			return true
		},
		model: (ctx) => {
			const mem = ctx.st.mem
			mem.p ??= 0
			mem.sw ??= 0
			const pair = kit.X.pairs[mem.p] ?? kit.X.pairs[0]
			const A = pair[mem.sw ? 1 : 0]
			const B = pair[mem.sw ? 0 : 1]
			const a = (t: PlayTitle) => core.val(t, A)
			const b = (t: PlayTitle) => core.val(t, B)
			const { cells, counts } = kit.levelCells(ctx, kit.pool(ctx), a, {
				cap: 5,
				v: (t) => `${a(t)},${b(t)}`,
				band: (t) => (b(t) >= 7 ? 0 : b(t) >= 4 ? 1 : 2),
			})
			return {
				compact: true,
				pick: kit.row(
					"p",
					kit.X.pairs.map((keys, i) => ({
						a: String(i),
						h: `${kit.nm(keys[0])} × ${kit.nm(keys[1])}`,
						on: i === mem.p,
					})),
					`<button type="button" class="sc-ch sc-sw" data-pl-act="sw" aria-label="Swap the two traits">⇄</button>`,
				),
				rails: [
					{
						cells,
						small: true,
						bands: [`<i>${kit.T[B].e}</i> 7+`, `<i>${kit.T[B].e}</i> 4 to 6`, `<i>${kit.T[B].e}</i> 0 to 3`],
					},
				],
				said: (t) =>
					a(t) >= 7 && b(t) >= 7
						? "A lot of both"
						: a(t) <= 3 && b(t) <= 3
							? "Little of either"
							: `${kit.word(a(t))} / ${kit.word(b(t))}`.replace(/^./, (ch) => ch.toUpperCase()),
				lines: (t) =>
					`${kit.bar(A, a(t), t.k === ctx.c.k ? undefined : a(ctx.c))}${kit.bar(B, b(t), t.k === ctx.c.k ? undefined : b(ctx.c))}`,
				foot: (t) => kit.ruler(counts, { f: a(t), h: a(ctx.c), p: a(ctx.root) }, kit.T[A].l),
				why: ctx.prev?.s
					? `From ${core.esc(ctx.prev.t)}: ${kit.nm(A)} ${a(ctx.prev)} → ${a(ctx.c)}, ${kit.nm(B)} ${b(ctx.prev)} → ${b(ctx.c)}.`
					: null,
			}
		},
	})

/**
 * scrub5, its own fingerprint: the picker is the fingerprint of the title you stand on, as bars. "Top" is its
 * strongest traits, and the five families reach all 74 attributes, strongest first. A tap makes one the scale.
 */
const scrub5: ScrubForm = (core, kit) =>
	kit.form({
		name: "scrub5",
		hint: "The bars are this title's fingerprint. Tap one to line the neighborhood up along it.",
		act: (ctx, name, arg) => {
			const mem = ctx.st.mem
			if (name === "tab") {
				if (String(mem.tab) === arg) return false
				mem.tab = Number(arg)
				return true
			}
			if (name !== "a" || mem.a === arg) return false
			mem.a = arg
			return true
		},
		model: (ctx) => {
			const mem = ctx.st.mem
			mem.tab ??= 0
			mem.a ??= kit.menu(ctx, [], 1)[0] ?? "tension"
			const titles = kit.pool(ctx)
			const keys =
				mem.tab === 0
					? core.own(ctx.c, 10)
					: (kit.X.groups[mem.tab - 1]?.k ?? [])
							.slice()
							.sort((p, q) => core.val(ctx.c, q) - core.val(ctx.c, p))
			if (mem.tab === 0 && keys.indexOf(mem.a) < 0) keys.unshift(mem.a)
			// A trait the title has clearly more of than the titles around it is marked as its own.
			const around = (key: string) => kit.mean(titles.map((t) => core.val(t, key)))
			const tabs = kit.row(
				"tab",
				[{ a: "0", h: "★ Top", on: mem.tab === 0 }].concat(
					kit.X.groups.map((group, i) => ({
						a: String(i + 1),
						h: `<i>${group.e}</i> ${core.esc(group.n)}`,
						on: mem.tab === i + 1,
					})),
				),
			)
			const bars = kit.row(
				"a",
				keys.map((key) => {
					const v = core.val(ctx.c, key)
					return {
						a: key,
						cls: "sc-bc",
						on: key === mem.a,
						h: `${kit.nm(key)}<s style="--c:${kit.T[key].c}"><u style="width:${v * 10}%"></u></s><b>${v}</b>${
							v >= 6 && v - around(key) >= 2 ? '<em title="More than the titles around it">★</em>' : ""
						}`,
					}
				}),
			)
			return kit.single(ctx, mem.a, { pick: tabs + bars })
		},
	})

/**
 * scrub6, what varies here: the picker leads with the traits on which this neighborhood actually spreads, each with
 * the range its titles cover, and names the flat ones as flat. A search reaches every attribute.
 */
const scrub6: ScrubForm = (core, kit) => {
	const list = (ctx: PlayCtx) => {
		const mem = ctx.st.mem
		const spreads = kit.spread(kit.pool(ctx), core.M.keys).sort((p, q) => q.sd - p.sd)
		const q = String(mem.q ?? "")
			.trim()
			.toLowerCase()
		const flat = (s: { lo: number; hi: number }) => s.hi - s.lo <= 1
		const shown = q
			? spreads
					.filter((s) => `${kit.T[s.key].l} ${kit.T[s.key].n} ${s.key}`.toLowerCase().indexOf(q) >= 0)
					.slice(0, 12)
			: spreads
					.filter((s) => s.key === mem.a)
					.concat(spreads.filter((s) => !flat(s) && s.key !== mem.a).slice(0, 10))
					.concat(spreads.filter((s) => flat(s) && s.key !== mem.a).slice(-4))
		if (!shown.length) return '<small class="sc-none">No trait by that name</small>'
		return shown
			.map(
				(s) =>
					`<button type="button" class="sc-ch sc-vc${flat(s) ? " sc-flat" : ""}" data-pl-act="a" data-arg="${s.key}" aria-pressed="${
						s.key === mem.a
					}">${kit.nm(s.key)}<s><u style="left:${s.lo * 10}%;width:${Math.max(4, (s.hi - s.lo) * 10)}%"></u></s><b>${
						flat(s) ? `flat at ${s.lo === s.hi ? s.lo : `${s.lo} to ${s.hi}`}` : `${s.lo} to ${s.hi}`
					}</b></button>`,
			)
			.join("")
	}
	return kit.form({
		name: "scrub6",
		hint: "The chips lead with what differs among these titles. A flat trait would tell you nothing here.",
		act: (ctx, name, arg) => {
			if (name !== "a") return false
			ctx.st.mem.a = arg
			ctx.st.mem.q = ""
			return true
		},
		input: (ctx, el, s) => {
			if (!el.hasAttribute("data-sc-q")) return
			ctx.st.mem.q = (el as HTMLInputElement).value
			const row = s.querySelector("[data-sc-list]")
			if (row) row.innerHTML = list(ctx)
		},
		model: (ctx) => {
			const mem = ctx.st.mem
			if (!mem.a) {
				mem.a = kit.varied(kit.pool(ctx))[0] ?? "tension"
			}
			return kit.single(ctx, mem.a, {
				pick: `<div class="sc-row sc-find"><input class="sc-q" type="search" placeholder="Find a trait" aria-label="Find a trait" autocomplete="off" data-pl-input="" data-sc-q="" value="${core.esc(
					mem.q ?? "",
				)}"><small>${mem.q ? "Matches" : "Varies most here first, flat last"}</small></div><div class="sc-row" data-sc-list="">${list(ctx)}</div>`,
			})
		},
	})
}

/**
 * scrub7, both of two: two traits combined into one strip. A title's place is the lower of its two levels, so only
 * a title with a lot of both sits far right. Each poster carries its two levels.
 */
const scrub7: ScrubForm = (core, kit) =>
	kit.form({
		name: "scrub7",
		hint: "Pick two traits. The strip orders by how much a title has of both: the lower of its two levels.",
		act: (ctx, name, arg) => {
			if (name !== "two") return false
			const two = ctx.st.mem.two as string[]
			const at = two.indexOf(arg)
			if (at >= 0) {
				if (two.length < 2) return false
				two.splice(at, 1)
			} else {
				two.push(arg)
				if (two.length > 2) two.shift()
			}
			return true
		},
		model: (ctx) => {
			const mem = ctx.st.mem
			if (!mem.two) {
				const offer = kit.menu(ctx, [])
				mem.two = [offer[0] ?? "tension", offer[1] ?? "wit_wordplay"]
			}
			const two = mem.two as string[]
			const f = (t: PlayTitle) => Math.min(...two.map((key) => core.val(t, key)))
			const { cells, counts } = kit.levelCells(ctx, kit.pool(ctx), f, {
				cap: 6,
				v: (t) => two.map((key) => core.val(t, key)).join(","),
				inner: (t) => `<span class="sc-nb">${two.map((key) => core.val(t, key)).join("·")}</span>`,
			})
			const names = two.map((key) => kit.nm(key)).join(" and ")
			return {
				pick: kit.row(
					"two",
					kit.menu(ctx, two).map((key) => ({ a: key, h: kit.nm(key), on: two.indexOf(key) >= 0 })),
					"<small>Both of</small>",
				),
				rails: [{ cells }],
				said: (t) =>
					two.length < 2
						? `${names} ${f(t)} of 10 · ${kit.word(f(t))}`
						: `At least ${f(t)} of both · ${kit.word(f(t))}`,
				lines: (t) =>
					`${two.map((key) => kit.bar(key, core.val(t, key), t.k === ctx.c.k ? undefined : core.val(ctx.c, key))).join("")}<span class="sc-cmp">${
						t.k === ctx.c.k ? "You stand here." : `${core.esc(ctx.c.t)}: at least ${f(ctx.c)} of both`
					}</span>`,
				foot: (t) => kit.ruler(counts, { f: f(t), h: f(ctx.c), p: f(ctx.root) }, "The lower of the two levels"),
				why: ctx.prev?.s ? `From ${core.esc(ctx.prev.t)}: at least ${f(ctx.prev)} → ${f(ctx.c)} of ${names}.` : null,
			}
		},
	})

/**
 * scrub8, hold and scrub: one trait is held at a level the page's title has, and the strip runs along another. Only
 * titles that keep the held trait are on the strip.
 */
const scrub8: ScrubForm = (core, kit) =>
	kit.form({
		name: "scrub8",
		hint: "Keep one trait high and move along another. The strip only holds titles that keep it.",
		act: (ctx, name, arg) => {
			const mem = ctx.st.mem
			if (name === "h") {
				mem.h = mem.h === arg ? "" : arg
				return true
			}
			if (name !== "a" || mem.a === arg) return false
			mem.a = arg
			return true
		},
		model: (ctx) => {
			const mem = ctx.st.mem
			const strong = core.own(ctx.root, 5).filter((key) => core.val(ctx.root, key) >= 6)
			mem.h ??= strong[0] ?? ""
			const from = (key: string) => Math.max(6, core.val(ctx.root, key) - 1)
			const all = kit.pool(ctx)
			const held = mem.h
				? all.filter((t) => t.k === ctx.c.k || core.val(t, mem.h) >= from(mem.h))
				: all
			if (!mem.a) {
				mem.a = kit.varied(held, [mem.h])[0] ?? "tension"
			}
			const keep = kit.row(
				"h",
				strong.map((key) => ({ a: key, h: `${kit.nm(key)} ${from(key)}+`, on: key === mem.h })),
				"<small>Keep</small>",
				mem.h ? ` data-held="${held.length}" data-of="${all.length}"` : "",
			)
			const along = kit.row(
				"a",
				kit
					.menu(ctx, [mem.a])
					.filter((key) => key !== mem.h)
					.map((key) => ({ a: key, h: kit.nm(key), on: key === mem.a })),
				`<small>Along${mem.h ? ` · ${held.length} of ${all.length} keep it` : ""}</small>`,
			)
			const m = kit.single(ctx, mem.a, { pick: keep + along, titles: held, cap: 8 })
			const lines = m.lines
			if (mem.h)
				m.lines = (t) =>
					`${lines(t)}${kit.bar(mem.h, core.val(t, mem.h), undefined, "Kept: ")}`
			return m
		},
	})

/**
 * scrub9, recipe: up to three chips, each "more" or "less". A title's score is the sum of its levels on the "more"
 * traits minus the sum on the "less" traits, and the strip runs from the lowest score to the highest.
 */
const scrub9: ScrubForm = (core, kit) =>
	kit.form({
		name: "scrub9",
		hint: "A recipe: tap a chip for more of it, again for less, again to drop it. Up to three.",
		act: (ctx, name, arg) => {
			if (name !== "r") return false
			const r = ctx.st.mem.r as [string, number][]
			const at = r.findIndex((entry) => entry[0] === arg)
			if (at < 0) {
				r.push([arg, 1])
				if (r.length > 3) r.shift()
			} else if (r[at][1] > 0) r[at][1] = -1
			else if (r.length > 1) r.splice(at, 1)
			else r[at][1] = 1
			return true
		},
		model: (ctx) => {
			const mem = ctx.st.mem
			if (!mem.r) {
				const offer = kit.menu(ctx, [])
				const wide = kit.varied(kit.pool(ctx), [offer[0]])
				mem.r = [
					[offer[0] ?? "tension", 1],
					[wide[0] ?? "bleakness", -1],
				]
			}
			const r = mem.r as [string, number][]
			const f = (t: PlayTitle) => r.reduce((sum, entry) => sum + entry[1] * core.val(t, entry[0]), 0)
			const sign = (v: number) => (v > 0 ? `+${v}` : v < 0 ? `−${-v}` : "0")
			const sorted = kit
				.capped(ctx, kit.pool(ctx), 40)
				.map((t, i) => ({ t, i }))
				.sort((p, q) => f(p.t) - f(q.t) || p.i - q.i)
			const cells: ScrubCell[] = []
			let last: number | null = null
			for (const { t } of sorted) {
				if (f(t) !== last) {
					last = f(t)
					cells.push({ tick: sign(last), l: String(last) })
				}
				cells.push({ t, v: String(f(t)) })
			}
			const lo = sorted.length ? f(sorted[0].t) : 0
			const hi = sorted.length ? f(sorted[sorted.length - 1].t) : 0
			const state: Record<string, number> = {}
			for (const entry of r) state[entry[0]] = entry[1]
			const told = r
				.map((entry) => `${entry[1] > 0 ? "more" : "less"} ${kit.nm(entry[0])}`)
				.join(", ")
			return {
				pick: kit.row(
					"r",
					kit.menu(
						ctx,
						r.map((entry) => entry[0]),
					).map((key) => ({
						a: key,
						h: `${state[key] ? `<b>${state[key] > 0 ? "▲" : "▼"}</b> ` : ""}${kit.nm(key)}`,
						on: Boolean(state[key]),
						cls: state[key] ? (state[key] > 0 ? "sc-up" : "sc-dn") : "",
					})),
				),
				rails: [{ cells }],
				said: (t) =>
					t.k === ctx.c.k
						? `You stand here: ${sign(f(t))}`
						: `${sign(f(t))} on this recipe, ${core.esc(ctx.c.t)} ${sign(f(ctx.c))}`,
				lines: (t) =>
					r
						.map((entry) =>
							kit.bar(
								entry[0],
								core.val(t, entry[0]),
								t.k === ctx.c.k ? undefined : core.val(ctx.c, entry[0]),
								entry[1] > 0 ? "▲ " : "▼ ",
							),
						)
						.join(""),
				foot: (t) =>
					`<p class="sc-note">Order: ${told}. Score ${r.map((entry) => `${entry[1] > 0 ? "+" : "−"} ${core.esc(kit.T[entry[0]].l)}`).join(" ")}, from <b>${sign(
						lo,
					)}</b> to <b>${sign(hi)}</b> here. This title: <b>${sign(f(t))}</b>.</p>`,
				why: ctx.prev?.s ? `From ${core.esc(ctx.prev.t)}: ${sign(f(ctx.prev))} → ${sign(f(ctx.c))} on the recipe.` : null,
			}
		},
	})

/**
 * scrub10, three lanes: three strips, one per fingerprint family, each along the trait of the family on which the
 * neighborhood spreads most. The same titles are on all three: scrubbing one brings the title under the marker to
 * the marker of the others, so its place on three scales shows at once.
 */
const scrub10: ScrubForm = (core, kit) =>
	kit.form({
		name: "scrub10",
		hint: "Three scales at once. Drag any lane: the other two follow the same title.",
		act: (ctx, name, arg) => {
			const mem = ctx.st.mem
			if (name === "lane") {
				// The next trait of the family, among the four this neighborhood spreads on most.
				const keys = kit
					.spread(kit.pool(ctx), kit.X.groups[Number(arg)]?.k ?? [])
					.sort((p, q) => q.sd - p.sd)
					.slice(0, 4)
					.map((entry) => entry.key)
				mem.lk[arg] = keys[(keys.indexOf(mem.lk[arg]) + 1) % Math.max(1, keys.length)] ?? mem.lk[arg]
				return true
			}
			if (name !== "grp") return false
			const g = mem.g as number[]
			const index = Number(arg)
			if (g.indexOf(index) >= 0) return false
			g.push(index)
			g.shift()
			return true
		},
		model: (ctx) => {
			const mem = ctx.st.mem
			const all = kit.pool(ctx)
			const ranked = kit.X.groups.map((group) =>
				kit
					.spread(all, group.k)
					.sort((p, q) => q.sd - p.sd)
					.slice(0, 4),
			)
			if (!mem.g)
				mem.g = ranked
					.map((list, i) => ({ i, sd: list[0]?.sd ?? 0 }))
					.slice(0, 4)
					.sort((p, q) => q.sd - p.sd)
					.slice(0, 3)
					.map((entry) => entry.i)
					.sort((p: number, q: number) => p - q)
			// A lane's trait is chosen once and kept for the walk, so that a step doesn't change what a lane means.
			mem.lk ??= {}
			const g = mem.g as number[]
			const titles = kit.capped(ctx, all, 26)
			const lanes = g.map((index) => {
				mem.lk[index] ??= ranked[index][0]?.key ?? kit.X.groups[index].k[0]
				return { index, key: mem.lk[index] as string, group: kit.X.groups[index] }
			})
			const level = (key: string, t: PlayTitle) => `<b>${core.val(t, key)}</b> ${kit.word(core.val(t, key))}`
			return {
				compact: true,
				pick: kit.row(
					"grp",
					kit.X.groups.map((group, i) => ({
						a: String(i),
						h: `<i>${group.e}</i> ${core.esc(group.n)}`,
						on: g.indexOf(i) >= 0,
					})),
					"<small>Lanes</small>",
				),
				rails: lanes.map((lane) => ({
					small: true,
					cells: kit.levelCells(ctx, titles, (t) => core.val(t, lane.key), { cap: 99 }).cells,
					head: `<div class="sc-lh"><button type="button" data-pl-act="lane" data-arg="${lane.index}" aria-label="${core.esc(
						`${lane.group.n}: ${kit.T[lane.key].l}. Tap for another trait of this family`,
					)}"><small>${core.esc(lane.group.n)}</small> ${kit.nm(lane.key)} <i>↻</i></button><span data-sc-lv="">${level(
						lane.key,
						ctx.e.ui.f ? (core.title(ctx.e.ui.f) ?? ctx.c) : ctx.c,
					)}</span></div>`,
				})),
				heads: (t) => lanes.map((lane) => level(lane.key, t)),
				said: (t) => {
					if (t.k === ctx.c.k) return "You stand here"
					const told = core.diffs(ctx.c, t, 2)
					return told.length ? core.sayDiff(told).replace(/^./, (ch) => ch.toUpperCase()) : "Much the same mix"
				},
				lines: () => "",
				foot: () => "",
				why: ctx.prev?.s
					? `From ${core.esc(ctx.prev.t)}: ${lanes.map((lane) => `${kit.nm(lane.key)} ${core.val(ctx.prev as PlayTitle, lane.key)} → ${core.val(ctx.c, lane.key)}`).join(", ")}.`
					: null,
			}
		},
	})

export const SCRUB_FORMS: Record<string, ScrubForm> = {
	scrub1,
	scrub2,
	scrub3,
	scrub4,
	scrub5,
	scrub6,
	scrub7,
	scrub8,
	scrub9,
	scrub10,
}
