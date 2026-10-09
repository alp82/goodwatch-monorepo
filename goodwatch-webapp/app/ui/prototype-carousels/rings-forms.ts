// PROTOTYPE for "Prototype native-scroll carousels on title pages", eleventh round. Throwaway code: not for production.
//
// The tenth round's rings (one title in the middle, the related titles on rings around it, the ring is the rank of
// similarity, a zoom) with two things fixed, and ten forms that differ only in the control area.
//
// Fixed in all of them (`ringsKit`):
// - A step is a camera pan. The places are a lattice, so moving everything by the vector that brings the tapped
//   poster into the middle puts every poster on a place again, and the title you came from on the place exactly
//   opposite the tapped one, where it stays as the way back. A title's ring is still its similarity rank to the
//   new middle: within its ring it takes the place the pan carried it to, or the free place nearest to that, and
//   moves there in a short second beat. New titles ride in with the pan, the ones that leave ride out and fade.
// - Pointing at a poster shows that title in the card: its name and year, and how it differs from the page's title.
//   Nothing else in the card changes. A finger that stays on a poster does the same.
// - The picture is laid out for the real width before the first paint, from the titles the server sent along.
//
// The forms:
// - roam1: the baseline. Three switches from the page title's fingerprint.
// - rings1, bars: the fingerprint of the title in the middle as six bars. A press turns a trait around.
// - rings2, three stops: three traits, each with less, any, and more than the title in the middle.
// - rings3, words: a visitor's words ("Funnier", "Less violent"), one tap each, and a dice that picks a twist.
// - rings4, edges: the control is on the map. Each edge is one trait, and a tap pulls the map that way.
// - rings5, legend: colors say how a title differs most, and the legend above is the filter.
// - rings6, pad: two traits as one pad with a dot.
// - rings7, blend: a plus on every poster keeps that title in the mix. The rings hold what is like both.
// - rings8, practical: facts instead of traits. Movie or show, older or newer, well rated, on a streaming service.
// - rings9, heading: no control to start with. What the walk moved toward collects itself, and can be let go.
// - rings10, in words: no control at all. A sentence says what the titles on the map have in common.
//
// Both the kit and each form are functions with no outside references, because they run as the page's inline
// script (see play-engine.ts).
import type { PlayCore, PlayCtx, PlayForm, PlayState, PlayTitle } from "~/ui/prototype-carousels/play-engine"
import type { RingsExtra } from "~/ui/prototype-carousels/rings-meta"

type Rule = (mode: string, level: (key: string) => number, keys: string[], w: RingsExtra["w"]) => string[]
export type RingsKit = ReturnType<typeof ringsKit>
type RingsForm = (core: PlayCore, kit: RingsKit) => PlayForm
/** A place on the lattice, in px from the middle. `b` is its ring, `a` its angle, `id` its column and half row. */
interface Cell {
	x: number
	y: number
	b: number
	a: number
	d: number
	i: number
	u: number
	id: string
}
interface Spot {
	x: number
	y: number
	s: number
	o: number
}
/** A poster (or an empty place) in a picture. */
interface Item {
	k: string
	x: number
	y: number
	s: number
	html: string
	style: string
	sig: string
	q: string
	far: boolean
}
interface View {
	form: string
	cls: string
	rstyle: string
	mem: string
	geo: string
	top: string
	bg: string
	ctl: string
	info: string
	ck: string
	wstyle: string
	rest: string
	/** The filter the picture shows, by its name: for the checks. */
	filter: string
	/** How far a poster may move to its own place after a pan, in px. Further than that, it fades over. */
	hop: number
	items: Item[]
	drift: { x: number; y: number } | null
}
/** What a title wears on its poster in one form: a mark inside it, and a style of its own. */
type Deco = (title: PlayTitle, rank: number) => { inner: string; extra: string }
interface Spec {
	name: string
	mode: string
	hint: string
	/** The control area's height on a phone. */
	th?: number
	/** The control is taller than one row: on a phone the card gives up its last line for it. */
	tall?: boolean
	/** On a wide screen the control sits beside the map, under the card, instead of above the map. */
	big?: boolean
	tokens: (ctx: PlayCtx) => string[]
	top: (ctx: PlayCtx, tokens: string[], list: PlayTitle[], places: number) => string
	note: (ctx: PlayCtx, tokens: string[], list: PlayTitle[], places: number, more: boolean) => string
	act?: (ctx: PlayCtx, name: string, arg: string) => boolean
	/** The filter a control would lead to, so that it can be asked for while the finger is still down. */
	will?: (ctx: PlayCtx, name: string, arg: string) => string[] | null
	deco?: (ctx: PlayCtx, list: PlayTitle[]) => Deco | null
	ctl?: (ctx: PlayCtx, tokens: string[]) => string
	drag?: (ctx: PlayCtx, x: number, y: number, w: number, h: number) => boolean
}
type Moved = HTMLElement & { __m?: Spot; __c?: Spot; __h?: string; __pk?: { nm: string; yr: string; df: string } | null }

export function ringsKit(core: PlayCore, X: RingsExtra, rule: Rule) {
	const { esc, val } = core
	const win = core.win
	const WORDS = Object.keys(X.w)
	const word = (key: string) => X.w[key]?.[0] ?? key
	const emo = (key: string) => X.w[key]?.[1] ?? ""
	const low = (key: string) => word(key).toLowerCase()
	const hue = (key: string) => core.M.traits[key]?.c ?? "#fbbf24"
	const enc = encodeURIComponent
	// For looking at the movement: `?plmove=a|b|c` picks how the titles that stay find their place, `?plslow=8`
	// stretches every motion.
	const found = (name: string) => (win ? new RegExp(`[?&]${name}=(\\w+)`).exec(win.location.search)?.[1] : undefined)
	const MOVE = found("plmove") ?? "c"
	const SLOW = Number(found("plslow")) || 1

	// --- The stage's size and the lattice ---------------------------------------------------------------------
	// The server draws for a phone. The browser measures the map before the first paint and draws again if needed.
	const box = { w: 346, h: 368 }
	let mode = "0"
	const roomy = () => box.w >= 600
	const posterW = () => (roomy() ? 60 : Math.max(44, Math.min(56, Math.floor((box.w - 4) / 5.43))))
	/** How small the posters get: on a phone they stay wide enough for a finger. */
	const zooms = () => (roomy() ? [1, 0.72, 0.54] : [1, 0.8, 0.66])
	const geoOf = () => `${box.w}|${box.h}`
	/** How much wider than tall the rings are: a wide stage gets wide rings, so that every ring is whole. */
	const stretch = () => Math.max(1, Math.min(2.4, (box.w / box.h) * 0.95))
	const memo: Record<string, Cell[] & { ix?: Record<string, number> }> = {}
	/**
	 * The places of a lattice of posters that are fully inside the map, nearest first: ring by ring, and around each
	 * ring clockwise from the top. The lattice is the same after a shift by any of its places, which is what lets a
	 * step be a pan.
	 */
	const cells = (scale: number): Cell[] & { ix?: Record<string, number> } => {
		const id = `${geoOf()}|${scale}`
		if (memo[id]) return memo[id]
		const wide = stretch()
		const w = posterW() * scale
		const h = w * 1.5
		const p = w * 1.107
		const q = h * 1.0715
		const out: Cell[] & { ix?: Record<string, number> } = []
		const cols = Math.ceil(box.w / 2 / p) + 1
		const rows = Math.ceil(box.h / 2 / q) + 1
		for (let i = -cols; i <= cols; i++)
			for (let j = -rows; j <= rows; j++) {
				const u = 2 * j + (i % 2 ? 1 : 0)
				const x = i * p
				const y = (u / 2) * q
				if (!i && !u) continue
				if (Math.abs(x) + w / 2 > box.w / 2 - 1 || Math.abs(y) + h / 2 > box.h / 2 - 1) continue
				// The four corners stay free, for the key and the zoom, and so that the place opposite any place exists.
				if (Math.abs(x) + w / 2 > box.w / 2 - 78 && Math.abs(y) + h / 2 > box.h / 2 - 44) continue
				const d = Math.sqrt((x / wide) * (x / wide) + y * y)
				let a = Math.atan2(x / wide, -y)
				if (a < 0) a += Math.PI * 2
				out.push({ x, y, d, a, i, u, id: `${i},${u}`, b: Math.max(1, Math.ceil((d - 0.8 * w) / (1.107 * w))) })
			}
		out.sort((m, n) => m.b - n.b || m.a - n.a)
		const ix: Record<string, number> = {}
		out.forEach((cell, n) => {
			ix[cell.id] = n
		})
		out.ix = ix
		memo[id] = out
		return out
	}
	const guides = (scale: number, rings: number) => {
		const wide = stretch()
		let out = ""
		for (let ring = 1; ring <= rings; ring++) {
			const r = (0.8 + 1.107 * ring) * posterW() * scale + 3
			out += `<ellipse rx="${Math.round(r * wide)}" ry="${Math.round(r)}"/>`
		}
		return `<svg class="rm-g" viewBox="${-box.w / 2} ${-box.h / 2} ${box.w} ${box.h}" aria-hidden="true">${out}</svg>`
	}

	// --- Filters: tokens, who passes them, and asking for more ---------------------------------------------------
	type Token = { key: string; op: string; v: string; n: number }
	const parsed: Record<string, Token | null> = {}
	const tok = (token: string): Token | null => {
		if (parsed[token] === undefined) {
			const m = /^([a-z_]+)([<>=])([a-z0-9]+)$/.exec(token)
			parsed[token] = m ? { key: m[1], op: m[2], v: m[3], n: Number(m[3]) } : null
		}
		return parsed[token]
	}
	const pass = (t: PlayTitle, token: string) => {
		const k = tok(token)
		if (!k) return true
		if (k.key === "_b") return true
		if (k.key === "_k") return t.k.charAt(0) === k.v
		if (k.key === "_y") return k.op === ">" ? Number(t.y) >= k.n : Number(t.y) <= k.n && Number(t.y) > 0
		if (k.key === "_st") return val(t, "_st") === 1
		const level = k.key === "_r" ? val(t, "_r") * 5 + 50 : val(t, k.key)
		return k.op === ">" ? level >= k.n : level <= k.n
	}
	const passes = (t: PlayTitle, tokens: string[]) => {
		for (const token of tokens) if (!pass(t, token)) return false
		return true
	}
	const nameOf = (tokens: string[]) => tokens.slice().sort().join(",")
	const blendOf = (tokens: string[]) => {
		for (const token of tokens) if (token.slice(0, 3) === "_b=") return token
		return ""
	}
	/**
	 * Down to which similarity the titles that pass a filter are all in memory. A list that came for the filter itself
	 * says so. Without one, whatever is known for a part of the filter holds for all of it: a title that passes
	 * "tense and funny" is among the tense ones.
	 */
	const bound = (ctx: PlayCtx, tokens: string[]) => {
		const exact = core.floor(ctx.c.k, nameOf(tokens))
		if (exact !== undefined) return exact
		let best = core.floor(ctx.c.k, "")
		for (const token of tokens) {
			const part = core.floor(ctx.c.k, token)
			if (part !== undefined && (best === undefined || part < best)) best = part
		}
		return best
	}
	/** A title's franchise as far as its name tells: "Toy Story 2" and "Toy Story" are one (best-meta.ts has the rule). */
	const stem = (t: PlayTitle & { f?: string }) => {
		if (t.f === undefined)
			t.f = t.t
				.toLowerCase()
				.replace(/^(the|a|an) /, "")
				.replace(/[’']/g, "")
				.split(/:| - | – | — /)[0]
				.replace(/\b(part|chapter|vol\.?|volume|episode|season)\s+[\divxlc]+.*$/, "")
				.replace(/\s+([ivx]+|\d+)$/, "")
				.replace(/[^\w ]+/g, " ")
				.replace(/\s+/g, " ")
				.trim()
		return t.f
	}
	let guessed = false
	/**
	 * The titles around the one you stand on that pass a filter, most alike first. Only down to the similarity they
	 * are complete to, so that a page that arrives later adds titles further out and pushes none aside.
	 */
	const around = (ctx: PlayCtx, tokens: string[]): PlayTitle[] => {
		guessed = false
		if (!ctx.list) return []
		let out: PlayTitle[]
		const blend = blendOf(tokens)
		if (blend) {
			const both = core.alt(ctx.c.k, blend)
			if (both) out = both
			else {
				// Until the list of titles alike both is there: what is known around either, by their levels.
				guessed = true
				const other = core.title(blend.slice(3))
				const seen: Record<string, boolean> = {}
				out = []
				for (const t of ctx.list.concat(core.listOf(blend.slice(3)) ?? [])) {
					if (seen[t.k] || t.k === ctx.c.k || !t.s) continue
					seen[t.k] = true
					out.push({ ...t, n: other ? (core.sim(ctx.c, t) + core.sim(other, t)) / 2 : t.n })
				}
				out.sort((a, b) => b.n - a.n)
			}
		} else {
			out = tokens.length ? ctx.list.filter((t) => t.s && passes(t, tokens)) : ctx.list
			if (!ctx.soft) {
				const floor = bound(ctx, tokens)
				if (floor) out = out.filter((t) => t.n * 1000 >= floor - 0.01)
			}
		}
		// One title per franchise, the most alike one.
		const seen: Record<string, boolean> = {}
		return out.filter((t) => {
			const name = stem(t)
			if (!name) return true
			if (seen[name]) return false
			seen[name] = true
			return true
		})
	}
	const page: Record<string, number> = {}
	let cur: PlayState | null = null
	const country = () => (cur?.mem.cc ? `&cc=${cur.mem.cc}` : "")
	/** Makes sure `count` titles are there under a filter, or on their way. Never waited for. True: on their way. */
	const want = (ctx: PlayCtx, tokens: string[], held: number, count: number): boolean => {
		// The list of titles alike two titles is one of its own: nothing in memory stands for it.
		const have = blendOf(tokens) && !core.alt(ctx.c.k, blendOf(tokens)) ? 0 : held
		if (!win || ctx.soft || !ctx.list || have >= count) return false
		const name = nameOf(tokens)
		if (!blendOf(tokens) && bound(ctx, tokens) === 0) return false
		if (core.floor(ctx.c.k, name) === 0) return false
		const id = `${ctx.c.k}|${name}`
		// The pack itself is the first page of the plain order. A filter starts at its own first page.
		let d = page[id] ?? (name ? 0 : 1)
		const ask = () => core.more(ctx.c.k, `&v=5${country()}&f=${enc(name)}&d=${d}`)
		if (ask()) return true
		if (d >= 6) return false
		d++
		page[id] = d
		return ask()
	}
	/** True when there may be more titles under a filter than are in memory. */
	const open = (ctx: PlayCtx, tokens: string[]) =>
		!ctx.list || ctx.soft || (core.floor(ctx.c.k, nameOf(tokens)) !== 0 && (Boolean(blendOf(tokens)) || bound(ctx, tokens) !== 0))
	/** What a walk holds on to from the page's title: its switches, the traits they are about, its year. */
	const hold = (ctx: PlayCtx) => {
		cur = ctx.st
		const mem = ctx.st.mem
		if (!mem.tr) {
			const own = core.packTraits(ctx.root.k)
			if (own) {
				mem.tr = own
				const keys: string[] = []
				for (const token of own) {
					const k = tok(token)
					if (k && keys.indexOf(k.key) < 0) keys.push(k.key)
				}
				mem.ax = keys
			}
		}
		if (!mem.yr && ctx.root.y) mem.yr = Number(ctx.root.y) || 0
		return mem
	}
	/** The filtered lists a title's pack should bring along: the rule of rings-meta.ts, from the title's own levels. */
	const preload = (t: PlayTitle, mem: PlayState["mem"]): string[] | null => {
		if (mode === "0") return []
		if (mode === "chips" || mode === "edges") return (mem.tr as string[] | undefined) ?? null
		if (!t.s || ((mode === "stops" || mode === "pad") && !mem.ax)) return null
		return rule(mode, (key) => val(t, key), (mem.ax as string[] | undefined) ?? [], X.w)
	}
	core.queryOf((key) => {
		let out = `&v=5&m=${mode}${country()}`
		// The page's own title is asked for as the server asked: it chooses the lists itself.
		if (cur && key !== cur.root && mode !== "0") {
			const t = core.title(key)
			const tokens = t ? preload(t, cur.mem) : null
			if (tokens) out += `&tr=${tokens.length ? enc(tokens.join(",")) : "0"}`
		}
		return out
	})

	// --- Words ----------------------------------------------------------------------------------------------------
	/** How a title differs from another on the plain traits, strongest first: at least two levels. */
	const gaps = (from: PlayTitle, t: PlayTitle, max: number) =>
		WORDS.map((k) => ({ k, d: val(t, k) - val(from, k) }))
			.filter((e) => Math.abs(e.d) >= 2)
			.sort((a, b) => Math.abs(b.d) - Math.abs(a.d))
			.slice(0, max)
	/** The one part of the card's second line that changes with the title it is about. */
	const differs = (ctx: PlayCtx, t: PlayTitle) => {
		if (t.k === ctx.root.k && ctx.c.k !== ctx.root.k) return "it is the title of this page"
		if (t.k === ctx.root.k) return '<span class="rg-h">point at a poster to compare it</span><span class="rg-t">hold a poster to compare it</span>'
		if (!t.s || !ctx.root.s) return "…"
		const told = gaps(ctx.root, t, 3)
		return told.length ? told.map((e) => `${e.d > 0 ? "more" : "less"} ${emo(e.k)} ${esc(low(e.k))}`).join(", ") : "much the same mix"
	}
	const when = (t: PlayTitle) => `${esc(t.y)}${t.k.charAt(0) === "s" ? " · Show" : ""}`
	/**
	 * The card: the title you stand on with its year and "Open", a line that compares it with the page's title, and
	 * the form's own line. Pointing at a poster changes the name, the year, and the comparison, and nothing else.
	 */
	const info = (ctx: PlayCtx, note: string) => {
		const c = ctx.c
		const link =
			c.k === ctx.root.k
				? '<span class="bs-this">this page</span>'
				: `<a class="bs-open" data-pl-nav="" data-pl-open="" href="${esc(core.href(c))}">Open<span class="pl-sr"> ${esc(c.t)}</span></a>`
		return `<p class="rm-nm"><b data-pl-here="" data-r-nm="">${esc(c.t)}</b><small data-r-yr="">${when(c)}</small>${link}</p><p class="rg-vs" data-pl-why=""><span class="rg-ld">Next to <b>${esc(
			ctx.root.t,
		)}</b>:</span> <span class="rg-df" data-r-df="">${differs(ctx, c)}</span></p><p class="rg-nt" data-r-nt="">${note}</p>`
	}
	const peek = (section: Element, ctx: PlayCtx, t: PlayTitle | null) => {
		const card = section.querySelector("[data-r-info]") as Moved | null
		const nm = card?.querySelector("[data-r-nm]")
		const yr = card?.querySelector("[data-r-yr]")
		const df = card?.querySelector("[data-r-df]")
		if (!card || !nm || !yr || !df) return
		if (!t) {
			if (card.__pk) {
				nm.textContent = card.__pk.nm
				yr.innerHTML = card.__pk.yr
				df.innerHTML = card.__pk.df
			}
			card.__pk = null
			card.removeAttribute("data-r-pk")
			return
		}
		if (!card.__pk) card.__pk = { nm: nm.textContent ?? "", yr: yr.innerHTML, df: df.innerHTML }
		nm.textContent = t.t
		yr.innerHTML = when(t)
		df.innerHTML = differs(ctx, t)
		card.setAttribute("data-r-pk", t.k)
	}
	const withOrWithout = (tokens: string[]) =>
		tokens
			.map((token) => {
				const k = tok(token)
				return k ? `<b>${k.op === ">" ? "with" : "without"} ${esc(low(k.key))}</b>` : ""
			})
			.join(" and ")
	/** A token as a visitor's word: "Funnier", "Less violent". */
	const saying = (token: string) => {
		const k = tok(token)
		return k && X.w[k.key] ? X.w[k.key][k.op === ">" ? 2 : 3] : token
	}
	const toggled = (list: string[] | undefined, token: string) => {
		const out = (list ?? []).slice()
		const at = out.indexOf(token)
		if (at >= 0) out.splice(at, 1)
		else out.push(token)
		return out
	}
	const zoomOf = (ctx: PlayCtx) => Math.max(0, Math.min(zooms().length - 1, Number(ctx.st.mem.z) || 0))
	const zoomCtl = (ctx: PlayCtx, shown: number) => {
		const z = zoomOf(ctx)
		return `<div class="rm-z" role="group" aria-label="How far out the map reaches"><button type="button" data-pl-act="z" data-arg="1" aria-label="Further out: more titles"${
			z >= zooms().length - 1 ? " disabled" : ""
		}>−</button><span>${shown}</span><button type="button" data-pl-act="z" data-arg="-1" aria-label="Closer: larger posters"${z <= 0 ? " disabled" : ""}>+</button></div>`
	}

	// --- A picture: who sits where ---------------------------------------------------------------------------------
	const round = (n: number, by: number) => Math.round(n * by) / by
	const place = (x: number, y: number, s: number, extra = "") => `--x:${round(x, 10)}px;--y:${round(y, 10)}px;--s:${round(s, 1000)}${extra}`
	const item = (ctx: PlayCtx, t: PlayTitle, cell: Cell, s: number, came: boolean, rank: number, deco: Deco | null): Item => {
		const worn = deco && !came ? deco(t, rank) : { inner: "", extra: "" }
		const style = place(cell.x, cell.y, s, worn.extra)
		const sig = `${came ? "c" : "p"}|${worn.inner}`
		const far = rank >= 8
		return {
			k: t.k,
			x: round(cell.x, 10),
			y: round(cell.y, 10),
			s: round(s, 1000),
			style,
			sig,
			q: cell.id,
			far,
			html: core.poster(t, {
				cls: "rm-p",
				style,
				came,
				inner: worn.inner,
				attrs: ` data-r-k="${t.k}" data-r-q="${cell.id}" data-r-g="${esc(sig)}"${far ? ' data-pl-far=""' : ""}`,
			}),
		}
	}
	const hole = (cell: Cell, s: number): Item => {
		const style = place(cell.x, cell.y, s)
		return {
			k: `h${cell.id}`,
			x: round(cell.x, 10),
			y: round(cell.y, 10),
			s: round(s, 1000),
			style,
			sig: "",
			q: cell.id,
			far: true,
			html: `<span class="pl-ph rm-p" style="${style}" data-r-k="h${cell.id}" data-r-q="${cell.id}" data-r-g="" aria-hidden="true"></span>`,
		}
	}
	/** The title in the middle. The same kind of element as a poster, so that a tapped poster becomes it in place. */
	const middle = (ctx: PlayCtx, scale: number): Item => {
		const s = round(scale * 1.1, 1000)
		const style = place(0, 0, s)
		return {
			k: ctx.c.k,
			x: 0,
			y: 0,
			s,
			style,
			sig: "m|",
			q: "0,0",
			far: true,
			html: `<button type="button" class="pl-p rm-p rg-c" style="${style}" data-pl-center="" data-r-c="${ctx.c.k}" data-r-k="${ctx.c.k}" data-r-q="0,0" data-r-g="m|" data-t="${esc(ctx.c.t)}" data-y="${esc(
				ctx.c.y,
			)}" aria-current="true" tabindex="-1"><img alt="${esc(`${ctx.c.t} (${ctx.c.y})`)}" decoding="async" src="${esc(core.src(ctx.c.p))}"></button>`,
		}
	}
	/**
	 * Who sits where. The ring is the rank of similarity: the nearest ring holds the most alike titles, and so on
	 * outward. Within its ring a title keeps the place it was on (after a step: the place the pan carries it to), or
	 * takes the free place nearest to that. A title that was not on the map takes what is left, clockwise from the
	 * top. The title you came from sits on the place opposite the one you tapped, whatever its rank.
	 */
	const lay = (ctx: PlayCtx, list: PlayTitle[], spots: Cell[] & { ix?: Record<string, number> }, scale: number, coming: boolean, deco: Deco | null, filter: string) => {
		const e = ctx.e
		const ix = spots.ix ?? {}
		let prefs = e.ui.at as Record<string, string> | undefined
		// A filter that was shown here before gets its picture back: a switch turned off again is the picture as it was.
		const kept = (e.ui.af as Record<string, Record<string, string>> | undefined)?.[filter]
		if (prefs && kept) prefs = { ...prefs, ...kept }
		if (!prefs && e.ui.base && e.ui.sh) {
			// After a step: everything is where the pan carries it.
			const base = e.ui.base as Record<string, string>
			const [di, du] = e.ui.sh as number[]
			prefs = {}
			for (const k in base) {
				const at = base[k].split(",")
				prefs[k] = `${Number(at[0]) - di},${Number(at[1]) - du}`
			}
		}
		const w = posterW() * scale
		const p = w * 1.107
		const q = w * 1.5 * 1.0715
		const spotOf = (id: string) => {
			const at = id.split(",")
			return { x: Number(at[0]) * p, y: (Number(at[1]) / 2) * q }
		}
		const used: Record<number, boolean> = {}
		const out: Item[] = []
		const now: Record<string, string> = {}
		const put = (t: PlayTitle, n: number, came: boolean, rank: number) => {
			used[n] = true
			now[t.k] = spots[n].id
			out.push(item(ctx, t, spots[n], scale, came, rank, deco))
		}
		let rest = list
		const pin = e.ui.pin as string | undefined
		if (ctx.prev && pin && spots.length) {
			let n = ix[pin]
			if (n === undefined) {
				// The place is outside the map at this zoom: the place nearest to it.
				const ideal = spotOf(pin)
				let near = 1e12
				spots.forEach((cell, i) => {
					const d = (cell.x - ideal.x) * (cell.x - ideal.x) + (cell.y - ideal.y) * (cell.y - ideal.y)
					if (d < near) {
						near = d
						n = i
					}
				})
			}
			const prev = ctx.prev
			put(prev, n, true, 99)
			rest = list.filter((t) => t.k !== prev.k)
		}
		let next = 0
		let from = 0
		while (from < spots.length) {
			let to = from
			while (to < spots.length && spots[to].b === spots[from].b) to++
			const free: number[] = []
			for (let n = from; n < to; n++) if (!used[n]) free.push(n)
			const titles = rest.slice(next, next + free.length)
			const first = next
			next += titles.length
			let left: { t: PlayTitle; rank: number }[] = []
			titles.forEach((t, i) => {
				const n = prefs && MOVE !== "a" ? ix[prefs[t.k]] : undefined
				if (n !== undefined && n >= from && n < to && !used[n]) put(t, n, false, first + i)
				else left.push({ t, rank: first + i })
			})
			if (prefs && MOVE === "c" && left.length) {
				const pairs: number[][] = []
				left.forEach((entry, i) => {
					const id = (prefs as Record<string, string>)[entry.t.k]
					if (!id) return
					const ideal = spotOf(id)
					for (const n of free) if (!used[n]) pairs.push([(spots[n].x - ideal.x) * (spots[n].x - ideal.x) + (spots[n].y - ideal.y) * (spots[n].y - ideal.y), i, n])
				})
				pairs.sort((a, b) => a[0] - b[0])
				const done: Record<number, boolean> = {}
				for (const pair of pairs) {
					if (done[pair[1]] || used[pair[2]]) continue
					done[pair[1]] = true
					put(left[pair[1]].t, pair[2], false, left[pair[1]].rank)
				}
				left = left.filter((_entry, i) => !done[i])
			}
			let at = 0
			for (const entry of left) {
				while (at < free.length && used[free[at]]) at++
				if (at < free.length) put(entry.t, free[at], false, entry.rank)
			}
			// A place whose title is on its way is a calm empty place until it is there.
			if (!ctx.list || coming) for (const n of free) if (!used[n]) out.push(hole(spots[n], scale))
			from = to
		}
		if (ctx.list) {
			e.ui.at = now
			e.ui.base = undefined
			if (!ctx.soft) e.ui.af = { ...(e.ui.af as Record<string, unknown> | undefined), [filter]: now }
		}
		return out
	}
	/** What a step carries: where the tapped poster was, so that the new picture is the old one moved by that much. */
	const carry = (ui: Record<string, unknown>, button: Element) => {
		const at = (button.getAttribute("data-r-q") ?? "0,0").split(",").map(Number)
		return { base: ui.at, sh: at, pin: `${-at[0]},${-at[1]}` }
	}

	// --- A picture into the stage, and the movement ---------------------------------------------------------------
	let last: View | null = null
	let once: { x: number; y: number } | null = null
	const html = (view: View) => {
		last = view
		return `<div class="${view.cls}" style="${view.rstyle}" data-r-form="${view.form}" data-r-geo="${view.geo}" data-r-mem="${esc(view.mem)}"${
			view.rest ? ` data-pl-rest="${esc(view.rest)}"` : ""
		} data-r-at="${view.ck}" data-r-f="${esc(view.filter)}"><div class="rm-top rg-top" data-r-top="">${view.top}</div><div class="rm-map" data-r-map=""><div class="rm-bg" data-r-bg="">${view.bg}</div><div class="rm-w" data-r-w="" data-pl-slop="" style="${view.wstyle}">${view.items
			.map((entry) => entry.html)
			.join("")}</div><div class="rm-ctl" data-r-ctl="">${view.ctl}</div></div><div class="rm-info rg-info" data-r-info="">${view.info}</div></div>`
	}
	const part = (root: Element, name: string, markup: string) => {
		const el = root.querySelector(`[data-r-${name}]`) as Moved | null
		if (!el || el.__h === markup) return
		// The server's markup is not compared: it is replaced once, by the same thing.
		el.innerHTML = markup
		el.__h = markup
		el.__pk = null
		el.removeAttribute("data-r-pk")
	}
	const still = () => Boolean(win?.matchMedia?.("(prefers-reduced-motion: reduce)").matches)
	// A pan starts at an even pace and comes to rest, so that the eye can pick it up: no leap in the first frame.
	// A long pan (a wide screen, a far poster) takes a little longer than a short one.
	let PAN = 240 * SLOW
	const SETTLE = 100 * SLOW
	const PLAIN = 200 * SLOW
	const EASE = "cubic-bezier(.3,.3,.2,1)"
	let busy = 0
	const num = (text: string | undefined) => Number.parseFloat(text ?? "") || 0
	/** Where a poster is right now: in the middle of a motion, where the motion has it. */
	const read = (node: Moved, live: boolean): Spot => {
		if (live && node.getAnimations && node.getAnimations().length) {
			const cs = win.getComputedStyle(node)
			const tr = cs.translate === "none" ? [] : String(cs.translate).split(" ")
			return { x: num(tr[0]), y: num(tr[1]), s: cs.scale === "none" ? 1 : num(String(cs.scale).split(" ")[0]) || 1, o: Number(cs.opacity) }
		}
		if (node.__m) return node.__m
		return { x: num(node.style.getPropertyValue("--x")), y: num(node.style.getPropertyValue("--y")), s: num(node.style.getPropertyValue("--s")) || 1, o: 1 }
	}
	const frame = (x: number, y: number, s: number, o: number, extra?: Record<string, unknown>) => ({ translate: `${x}px ${y}px`, scale: String(s), opacity: String(o), ...extra })
	const stop = (node: Moved) => {
		if (!node.getAnimations) return
		for (const running of node.getAnimations()) running.cancel()
	}
	const play = (node: Moved, frames: Record<string, unknown>[], duration: number, easing: string) => {
		stop(node)
		return node.animate ? node.animate(frames as unknown as Keyframe[], { duration, easing }) : null
	}
	/** A poster that stays: along the pan first, then to its own place if that is another one. */
	const move = (node: Moved, to: Item, by: { x: number; y: number } | null, calm: boolean) => {
		const c = node.__c ?? { x: to.x, y: to.y, s: to.s, o: 1 }
		node.__m = { x: to.x, y: to.y, s: to.s, o: 1 }
		if (calm) return stop(node)
		const there = (x: number, y: number) => Math.abs(x - to.x) + Math.abs(y - to.y) < 0.6
		if (!by) {
			if (there(c.x, c.y) && Math.abs(c.s - to.s) < 0.004 && c.o > 0.99) return stop(node)
			play(node, [frame(c.x, c.y, c.s, c.o), frame(to.x, to.y, to.s, 1)], PLAIN, EASE)
			return
		}
		const mx = c.x + by.x
		const my = c.y + by.y
		if (there(mx, my)) play(node, [frame(c.x, c.y, c.s, c.o), frame(to.x, to.y, to.s, 1)], PAN, EASE)
		else
			play(
				node,
				[frame(c.x, c.y, c.s, c.o, { easing: EASE }), frame(mx, my, to.s, 1, { offset: PAN / (PAN + SETTLE), easing: "cubic-bezier(.3,0,.3,1)" }), frame(to.x, to.y, to.s, 1)],
				PAN + SETTLE,
				"linear",
			)
	}
	/** A poster that leaves: along the pan (or the pull of an edge), fading, and then out of the document. */
	const leave = (node: Moved, by: { x: number; y: number } | null, calm: boolean) => {
		const c = node.__c ?? { x: 0, y: 0, s: 1, o: 1 }
		node.removeAttribute("data-r-k")
		node.removeAttribute("data-pl-step")
		node.removeAttribute("data-pl-center")
		node.removeAttribute("data-r-c")
		node.setAttribute("data-r-x", "")
		node.setAttribute("aria-hidden", "true")
		node.setAttribute("tabindex", "-1")
		if (calm || c.o < 0.02) {
			stop(node)
			node.remove()
			return
		}
		const x = c.x + (by ? by.x : 0)
		const y = c.y + (by ? by.y : 0)
		node.style.cssText = `${place(x, y, c.s)};opacity:0`
		node.__m = { x, y, s: c.s, o: 0 }
		// It rides the whole pan and fades evenly, so that the eye has the old picture to follow.
		stop(node)
		if (!node.animate) return node.remove()
		const time = by ? PAN : PLAIN * 0.8
		node.animate([{ translate: `${c.x}px ${c.y}px`, scale: String(c.s) }, { translate: `${x}px ${y}px`, scale: String(c.s) }] as Keyframe[], { duration: time, easing: EASE })
		node.animate([{ opacity: String(c.o) }, { opacity: "0" }], { duration: time * 0.8, easing: "linear" }).onfinish = () => node.remove()
	}
	/** A new poster: it rides in with the pan from the side the map moves toward, or fades in where it is. */
	const enter = (node: Moved, to: Item, by: { x: number; y: number } | null, calm: boolean) => {
		node.__m = { x: to.x, y: to.y, s: to.s, o: 1 }
		if (calm) return
		if (!node.animate) return
		if (by) node.animate([{ translate: `${to.x - by.x}px ${to.y - by.y}px` }, { translate: `${to.x}px ${to.y}px` }] as Keyframe[], { duration: PAN, easing: EASE })
		node.animate([{ opacity: "0" }, { opacity: "1" }], { duration: (by ? PAN : PLAIN) * 0.8, easing: "linear" })
	}
	/** A poster that changes what it is (a poster, the middle, the way back) stays the element it was, with its image. */
	const morph = (node: Moved, markup: string) => {
		const holder = win.document.createElement("template") as HTMLTemplateElement
		holder.innerHTML = markup
		const src = holder.content.firstElementChild
		if (!src || src.tagName !== node.tagName) return false
		for (const attr of Array.from(node.attributes)) if (!src.hasAttribute(attr.name)) node.removeAttribute(attr.name)
		for (const attr of Array.from(src.attributes)) if (node.getAttribute(attr.name) !== attr.value) node.setAttribute(attr.name, attr.value)
		const img = node.querySelector("img")
		const now = src.querySelector("img")
		if (img && now) img.setAttribute("alt", now.getAttribute("alt") ?? "")
		for (const child of Array.from(node.children)) if (child !== img) child.remove()
		for (const child of Array.from(src.children)) if (child.tagName !== "IMG") node.appendChild(child)
		return true
	}
	/**
	 * Puts the picture drawn last into the stage. Every poster that stays is the same element and moves from where
	 * it is right now, so a tap in the middle of a motion goes on from there. Only `translate`, `scale`, and
	 * `opacity` are animated. First everything is read, then everything is written.
	 */
	const into = (stage: Element, _ctx?: PlayCtx): boolean => {
		const view = last
		const root = stage.firstElementChild as HTMLElement | null
		if (!view || !root || root.getAttribute("data-r-form") !== view.form) return false
		const world = root.querySelector("[data-r-w]") as HTMLElement | null
		if (!world) return false
		const calm = still()
		const t0 = win.performance.now()
		const live = t0 < busy
		const have: Record<string, Moved> = {}
		const ghosts: Moved[] = []
		for (let i = 0; i < world.children.length; i++) {
			const node = world.children[i] as Moved
			const k = node.getAttribute("data-r-k")
			node.__c = read(node, live)
			if (k && !have[k]) have[k] = node
			else ghosts.push(node)
		}
		// The pan: what brings the new middle from where it is to the middle.
		// A picture of the same middle (more titles arrived, a control, the zoom) leaves a running pan alone.
		const stepped = root.getAttribute("data-r-at") !== view.ck
		root.setAttribute("data-r-at", view.ck)
		const pivot = stepped ? have[view.ck] : undefined
		const shift = pivot?.__c && Math.abs(pivot.__c.x) + Math.abs(pivot.__c.y) > 0.6 ? { x: -pivot.__c.x, y: -pivot.__c.y } : null
		const by = shift ?? view.drift
		if (shift) PAN = Math.max(220, Math.min(280, 220 + (Math.hypot(shift.x, shift.y) - 100) * 0.2)) * SLOW
		root.className = view.cls
		root.style.cssText = view.rstyle
		root.setAttribute("data-r-mem", view.mem)
		root.setAttribute("data-r-geo", view.geo)
		root.setAttribute("data-r-f", view.filter)
		part(root, "top", view.top)
		part(root, "bg", view.bg)
		part(root, "ctl", view.ctl)
		part(root, "info", view.info)
		world.style.cssText = view.wstyle
		const wanted: Record<string, boolean> = {}
		let fresh = ""
		const born: Item[] = []
		for (const entry of view.items) {
			wanted[entry.k] = true
			let node: Moved | undefined = have[entry.k]
			// A title that the pan carries off the map, or far from its new place, does not fly back across the map:
			// it leaves with the pan like the others, and comes in at its new place like a new one.
			if (node && shift && entry.k !== view.ck && node.__c) {
				const mx = node.__c.x + shift.x
				const my = node.__c.y + shift.y
				const hop = Math.abs(mx - entry.x) + Math.abs(my - entry.y)
				if (hop > 0.6 && (Math.abs(mx) > box.w / 2 || Math.abs(my) > box.h / 2 || Math.hypot(mx - entry.x, my - entry.y) > view.hop)) node = undefined
			}
			if (!node || (node.getAttribute("data-r-g") !== entry.sig && !morph(node, entry.html))) {
				if (have[entry.k]) wanted[entry.k] = false
				fresh += entry.html
				born.push(entry)
				continue
			}
			node.style.cssText = entry.style
			node.setAttribute("data-r-q", entry.q)
			if (entry.far) node.setAttribute("data-pl-far", "")
			else node.removeAttribute("data-pl-far")
			// On its way to the same place already: it goes on as it is.
			const going = node.__m
			if (!stepped && !calm && live && going && Math.abs(going.x - entry.x) + Math.abs(going.y - entry.y) < 0.6 && Math.abs(going.s - entry.s) < 0.004) continue
			move(node, entry, shift, calm)
		}
		for (const k in have) if (!wanted[k]) leave(have[k], by, calm)
		// A poster that is leaving already goes on leaving, unless a new step moves the map under it.
		for (const node of ghosts) if (stepped || calm || !node.hasAttribute("data-r-x")) leave(node, by, calm)
		if (fresh) {
			world.insertAdjacentHTML("beforeend", fresh)
			const count = world.children.length
			born.forEach((entry, i) => enter(world.children[count - born.length + i] as Moved, entry, by, calm))
		}
		busy = Math.max(busy, t0 + (shift ? PAN + SETTLE : PLAIN) + 40)
		return true
	}
	/** The map's size, measured. True when the picture in the stage was drawn for another size. */
	const fit = (s: Element): boolean => {
		const map = s.querySelector("[data-r-map]") as HTMLElement | null
		if (!map?.clientWidth) return false
		box.w = map.clientWidth
		box.h = map.clientHeight
		return s.querySelector("[data-r-geo]")?.getAttribute("data-r-geo") !== geoOf()
	}
	const adopt = (st: PlayState, stage: Element) => {
		try {
			const kept = stage.firstElementChild?.getAttribute("data-r-mem")
			if (kept) Object.assign(st.mem, JSON.parse(kept))
		} catch {}
		cur = st
		// Where the server put every title: the first picture drawn here keeps them there, and comes back to it.
		const ui = st.trail[0].ui
		const root = stage.firstElementChild
		if (st.trail.length === 1 && !ui.at && root) {
			const at: Record<string, string> = {}
			const drawn = root.querySelectorAll("[data-r-w] > button[data-r-k]")
			for (let i = 0; i < drawn.length; i++) at[drawn[i].getAttribute("data-r-k") ?? ""] = drawn[i].getAttribute("data-r-q") ?? ""
			if (root.getAttribute("data-r-geo") === geoOf()) {
				ui.at = at
				ui.af = { [root.getAttribute("data-r-f") ?? ""]: at }
			}
		}
	}

	/** A form: the rings, the zoom, the movement, and the card are the kit's. The control area is the form's. */
	const make = (spec: Spec): PlayForm => {
		mode = spec.mode
		const th = spec.th ?? 30
		// A tall control takes the room of the card's last line on a phone, so that the map keeps its rows.
		box.h = (spec.tall ? 414 : 398) - th
		const picture = (ctx: PlayCtx) => {
			hold(ctx)
			const tokens = spec.tokens(ctx)
			const scale = zooms()[zoomOf(ctx)]
			const spots = cells(scale)
			let list = around(ctx, tokens)
			const rough = guessed
			// A walk never ends in an empty map: when hardly any title passes and there are no more, the places left
			// go to the most alike titles as they come, dimmed, and the card says so.
			const passing = list.length
			const few = tokens.length > 0 && !rough && passing < 6 && !open(ctx, tokens) && Boolean(ctx.list) && !ctx.soft
			if (few) {
				const has: Record<string, boolean> = {}
				for (const t of list) has[t.k] = true
				list = list.concat(around(ctx, []).filter((t) => !has[t.k]))
			}
			const own = spec.deco ? spec.deco(ctx, list) : null
			const deco: Deco | null = few
				? (t, rank) => (rank >= passing && rank < 99 ? { inner: '<i class="rg-dm" aria-hidden="true"></i>', extra: ";--dm:1" } : own ? own(t, rank) : { inner: "", extra: "" })
				: own
			// Enough for this zoom and the next one out.
			const coming = want(ctx, tokens, list.length, Math.round(spots.length * 2.2))
			const shown = Math.min(list.length, spots.length)
			const items = [middle(ctx, scale)].concat(lay(ctx, list, spots, scale, coming || rough, deco, nameOf(tokens)))
			const rings = spots.length ? spots[spots.length - 1].b : 0
			const more = open(ctx, tokens)
			// What the server did not draw goes along as plain data: enough for a wide screen's first picture.
			const rest = win ? "" : JSON.stringify(list.slice(shown, 64).map((t) => [t.k, t.t, t.y, t.p]))
			const drift = once
			once = null
			return html({
				form: spec.name,
				cls: `rm rg rg-${spec.name}${spec.big ? " rg-big" : ""}${spec.tall ? " rg-tall" : ""}`,
				rstyle: `--th:${th}px`,
				mem: JSON.stringify(ctx.st.mem),
				geo: geoOf(),
				top: spec.top(ctx, tokens, list, spots.length),
				bg: `${guides(scale, Math.min(rings, 3))}<span class="rm-key">${few ? "dimmed = not a match" : "nearer = more alike"}</span>`,
				ctl: `${spec.ctl ? spec.ctl(ctx, tokens) : ""}${zoomCtl(ctx, shown)}`,
				info: info(
					ctx,
					few
						? `Only ${passing} ${passing === 1 ? "title passes" : "titles pass"} that. The dimmed ones are the most alike that do not.`
						: spec.note(ctx, tokens, list, spots.length, more),
				),
				ck: ctx.c.k,
				wstyle: `--pw:${posterW()}px`,
				rest,
				filter: nameOf(tokens),
				hop: posterW() * scale * 1.107 * 1.75,
				items,
				drift,
			})
		}
		const form: PlayForm = {
			hint: spec.hint,
			plain: true,
			truth: true,
			fly: false,
			carry,
			adopt,
			fit,
			into,
			peek,
			stage: picture,
			act: (ctx, name, arg) => {
				hold(ctx)
				if (name === "z") {
					const z = zoomOf(ctx)
					const next = Math.max(0, Math.min(zooms().length - 1, z + Number(arg)))
					ctx.st.mem.z = next
					return next !== z
				}
				return spec.act ? spec.act(ctx, name, arg) : false
			},
			intent: (ctx, name, arg) => {
				hold(ctx)
				const tokens = spec.will ? spec.will(ctx, name, arg) : null
				if (tokens?.length) want(ctx, tokens, around(ctx, tokens).length, Math.round(cells(zooms()[zoomOf(ctx)]).length * 1.2))
			},
		}
		if (spec.drag) {
			const dragged = spec.drag
			form.drag = (ctx, el, s, x, y) => {
				const r = el.getBoundingClientRect()
				if (!dragged(ctx, x, y, r.width, r.height)) return
				const stage = s.querySelector("[data-pl-stage]")
				if (!stage) return
				picture(ctx)
				into(stage)
			}
		}
		return form
	}
	/** The next picture's new titles come in from one side, and the ones that leave go out the other. */
	const pull = (x: number, y: number) => {
		once = { x, y }
	}
	return { X, WORDS, box, word, emo, low, hue, tok, pass, passes, around, bound, open, gaps, withOrWithout, saying, toggled, make, pull, posterW, rule, hold, nameOf }
}

/** The switches as chips: lit means the titles around have the trait. */
const roam1: RingsForm = (core, kit) =>
	kit.make({
		name: "roam1",
		mode: "chips",
		hint: "Nearer the middle = more alike. Tap a poster to walk.",
		tokens: (ctx) => (ctx.st.mem.w as string[] | undefined) ?? [],
		top: (ctx, tokens) => {
			const tr = (ctx.st.mem.tr as string[] | undefined) ?? []
			return `<div class="rm-sw" role="group" aria-label="What the titles around have"><span class="rm-swl">With</span>${tr
				.map((token) => {
					const k = kit.tok(token)
					if (!k) return ""
					const on = (k.op === "<") !== tokens.indexOf(token) >= 0
					return `<button type="button" class="rm-ch" data-pl-act="sw" data-arg="${core.esc(token)}" aria-pressed="${on}" style="--c:${kit.hue(k.key)}"><i>${kit.emo(k.key)}</i>${core.esc(kit.word(k.key))}</button>`
				})
				.join("")}</div>`
		},
		note: (_ctx, tokens, list, places, more) =>
			tokens.length
				? `Around it: titles ${kit.withOrWithout(tokens)}.${list.length < places && !more ? ` These ${list.length} are all there are.` : ""}`
				: "Turn a switch off or on to change who is around. − shows more.",
		act: (ctx, name, arg) => {
			if (name !== "sw") return false
			ctx.st.mem.w = kit.toggled(ctx.st.mem.w, arg)
			return true
		},
		will: (ctx, name, arg) => (name === "sw" ? kit.toggled(ctx.st.mem.w, arg) : null),
	})

/**
 * rings1, bars. The fingerprint of the title in the middle, six traits of it with their levels: three it is strong
 * on and three it has little of. A press turns a trait around: a strong one goes ("without"), a weak one comes
 * ("with"). The bars follow the walk, and a turned trait stays turned.
 */
const rings1: RingsForm = (core, kit) =>
	kit.make({
		name: "rings1",
		mode: "bars",
		th: 56,
		tall: true,
		big: true,
		hint: "Its fingerprint is the control. Press a bar to turn that trait around.",
		tokens: (ctx) => (ctx.st.mem.w as string[] | undefined) ?? [],
		top: (ctx, tokens) => {
			if (!ctx.c.s) return '<p class="rm-say"><span>Its fingerprint is on its way.</span></p>'
			const own = kit.rule("bars", (key) => core.val(ctx.c, key), [], kit.X.w)
			// A turned trait keeps its bar, whatever the title in the middle is strong on.
			const bars = own.filter((token) => !tokens.some((t) => kit.tok(t)?.key === kit.tok(token)?.key))
			const all = tokens.concat(bars).slice(0, Math.max(6, tokens.length))
			all.sort((a, b) => core.val(ctx.c, kit.tok(b)?.key ?? "") - core.val(ctx.c, kit.tok(a)?.key ?? ""))
			return `<div class="rg-bars" role="group" aria-label="The fingerprint of ${core.esc(ctx.c.t)}. A press turns a trait around.">${all
				.map((token) => {
					const k = kit.tok(token)
					if (!k) return ""
					const on = tokens.indexOf(token) >= 0
					const v = core.val(ctx.c, k.key)
					return `<button type="button" class="rg-b" data-pl-act="tk" data-arg="${core.esc(token)}" aria-pressed="${on}" data-d="${k.op === ">" ? "w" : "o"}" style="--c:${kit.hue(k.key)};--v:${v}" aria-label="${core.esc(
						`${kit.word(k.key)}: ${v} of 10. Titles ${k.op === ">" ? "with" : "without"} it.`,
					)}"><i>${kit.emo(k.key)}</i><b>${core.esc(kit.word(k.key))}</b><s><u></u></s><em>${on ? (k.op === ">" ? `${k.v}+` : `≤${k.v}`) : v}</em></button>`
				})
				.join("")}</div>`
		},
		note: (_ctx, tokens, list, places, more) =>
			tokens.length
				? `Around it: titles ${kit.withOrWithout(tokens)}.${list.length < places && !more ? ` These ${list.length} are all there are.` : ""}`
				: "The bars are its fingerprint. Press a full one for titles without that, a low one for titles with it.",
		act: (ctx, name, arg) => {
			if (name !== "tk") return false
			ctx.st.mem.w = kit.toggled(ctx.st.mem.w, arg)
			return true
		},
		will: (ctx, name, arg) => (name === "tk" ? kit.toggled(ctx.st.mem.w, arg) : null),
	})

/**
 * rings2, three stops. Three traits of the page's title, each with three stops: less than the title in the middle,
 * any, more than it. The stops stay through the walk and are always read against the title you stand on, so "more"
 * keeps climbing.
 */
const rings2: RingsForm = (core, kit) => {
	const tokensOf = (ctx: PlayCtx, stops: Record<string, number>) => {
		const out: string[] = []
		for (const key of (ctx.st.mem.ax as string[] | undefined) ?? []) {
			const v = core.val(ctx.c, key)
			if (stops[key] < 0) out.push(`${key}<${Math.max(0, v - 2)}`)
			if (stops[key] > 0) out.push(`${key}>${Math.min(10, v + 2)}`)
		}
		return out
	}
	const after = (ctx: PlayCtx, arg: string) => {
		const [key, stop] = arg.split(":")
		return { ...((ctx.st.mem.sd as Record<string, number> | undefined) ?? {}), [key]: Number(stop) }
	}
	return kit.make({
		name: "rings2",
		mode: "stops",
		th: 40,
		hint: "Three traits, three stops each: less, any, more.",
		tokens: (ctx) => tokensOf(ctx, (ctx.st.mem.sd as Record<string, number> | undefined) ?? {}),
		top: (ctx) => {
			const stops = (ctx.st.mem.sd as Record<string, number> | undefined) ?? {}
			return `<div class="rg-sts">${((ctx.st.mem.ax as string[] | undefined) ?? [])
				.slice(0, 3)
				.map((key) => {
					const v = core.val(ctx.c, key)
					const at = stops[key] ?? 0
					const stop = (n: number, text: string, off: boolean) =>
						`<button type="button" data-pl-act="sd" data-arg="${key}:${n}" aria-pressed="${at === n}"${off && at !== n ? " disabled" : ""} aria-label="${core.esc(`${text} ${kit.low(key)}`)}">${text}</button>`
					return `<div class="rg-st" style="--c:${kit.hue(key)}" data-at="${at}"><span><i>${kit.emo(key)}</i>${core.esc(kit.word(key))}<em>${ctx.c.s ? v : ""}</em></span><div role="group" aria-label="${core.esc(
						kit.word(key),
					)}">${stop(-1, "less", v < 2)}${stop(0, "any", false)}${stop(1, "more", v > 8)}</div></div>`
				})
				.join("")}</div>`
		},
		note: (ctx, tokens, list, places, more) =>
			tokens.length
				? `Around it: ${tokens
						.map((token) => {
							const k = kit.tok(token)
							return k ? `<b>${k.op === ">" ? "more" : "less"} ${core.esc(kit.low(k.key))}</b> (${k.op === ">" ? `${k.v} or more` : `${k.v} or less`})` : ""
						})
						.join(", ")} than ${core.esc(ctx.c.t)}.${list.length < places && !more ? ` These ${list.length} are all there are.` : ""}`
				: "Each trait has three stops. Less and more are read against the title in the middle.",
		act: (ctx, name, arg) => {
			if (name !== "sd") return false
			ctx.st.mem.sd = after(ctx, arg)
			return true
		},
		will: (ctx, name, arg) => (name === "sd" ? tokensOf(ctx, after(ctx, arg)) : null),
	})
}

/**
 * rings3, words. A visitor's words instead of trait names: five of them, chosen for the title in the middle (two
 * things it has much of, as "less", and three it has little of, as "more"). One tap is the whole recipe, and the
 * dice picks a twist of one or two words from all twenty traits and says which.
 */
const rings3: RingsForm = (core, kit) => {
	/** Every word that has somewhere to go from the title in the middle, with how many titles in memory pass it. */
	const twists = (ctx: PlayCtx) => {
		const out: { tokens: string[]; n: number }[] = []
		const single: { token: string; family: number; n: number }[] = []
		const known = (ctx.list ?? []).filter((t) => t.s)
		const count = (tokens: string[]) => known.filter((t) => kit.passes(t, tokens)).length
		for (const key of kit.WORDS) {
			const v = core.val(ctx.c, key)
			const both = [v <= 7 ? `${key}>${Math.min(10, Math.max(5, v + 2))}` : "", v >= 3 ? `${key}<${Math.max(0, Math.min(5, v - 2))}` : ""]
			for (const token of both) {
				if (!token) continue
				const n = count([token])
				if (n >= 4) single.push({ token, family: kit.X.w[key][4], n })
			}
		}
		for (const a of single) {
			out.push({ tokens: [a.token], n: a.n })
			for (const b of single) {
				if (a.token >= b.token || a.family === b.family) continue
				const n = count([a.token, b.token])
				if (n >= 6) out.push({ tokens: [a.token, b.token], n })
			}
		}
		return out
	}
	return kit.make({
		name: "rings3",
		mode: "words",
		th: 56,
		tall: true,
		hint: "Say it in a word. Or roll the dice.",
		tokens: (ctx) => (ctx.st.mem.w as string[] | undefined) ?? [],
		top: (ctx, tokens) => {
			const own = ctx.c.s ? kit.rule("words", (key) => core.val(ctx.c, key), [], kit.X.w) : []
			const rest = own.filter((token) => !tokens.some((t) => kit.tok(t)?.key === kit.tok(token)?.key))
			const chip = (token: string) => {
				const k = kit.tok(token)
				return k
					? `<button type="button" class="rg-wd" data-pl-act="wd" data-arg="${core.esc(token)}" aria-pressed="${tokens.indexOf(token) >= 0}" style="--c:${kit.hue(k.key)}"><i>${kit.emo(k.key)}</i>${core.esc(kit.saying(token))}</button>`
					: ""
			}
			return `<div class="rg-wds" role="group" aria-label="The same, but"><button type="button" class="rg-dice" data-pl-act="dice" aria-label="Surprise me: pick a twist">🎲 Surprise me</button>${tokens
				.concat(rest)
				.slice(0, Math.max(5, tokens.length))
				.map(chip)
				.join("")}</div>`
		},
		note: (ctx, tokens, list, places, more) =>
			tokens.length
				? `${ctx.st.mem.dice ? "The dice says: " : "Around it: "}<b>${tokens.map((token) => core.esc(kit.saying(token).toLowerCase())).join("</b> and <b>")}</b>.${
						list.length < places && !more ? ` These ${list.length} are all there are.` : ""
					}`
				: "One word changes who is around. The dice picks one or two for you.",
		act: (ctx, name, arg) => {
			const mem = ctx.st.mem
			if (name === "wd") {
				mem.w = ((mem.w as string[] | undefined) ?? []).indexOf(arg) >= 0 ? [] : [arg]
				mem.dice = false
				return true
			}
			if (name !== "dice") return false
			const now = kit.nameOf((mem.w as string[] | undefined) ?? [])
			const all = twists(ctx).filter((twist) => kit.nameOf(twist.tokens) !== now)
			if (!all.length) return false
			// Two words more often than their share: they are the surprise.
			const pairs = all.filter((twist) => twist.tokens.length > 1)
			const pool = pairs.length && Math.random() < 0.6 ? pairs : all
			mem.w = pool[Math.floor(Math.random() * pool.length)].tokens
			mem.dice = true
			return true
		},
		will: (_ctx, name, arg) => (name === "wd" ? [arg] : null),
	})
}

/**
 * rings4, edges. The control is on the map: each edge is one trait of the page's title turned around ("without
 * spectacle" at the top, "with comedy" at the right). A tap on an edge pulls the map that way: the titles that pass
 * come in from that edge, the others leave by the opposite one. The edges keep their words for the whole walk.
 */
const rings4: RingsForm = (core, kit) => {
	const SIDES = [
		[0, 1],
		[-1, 0],
		[0, -1],
		[1, 0],
	]
	return kit.make({
		name: "rings4",
		mode: "edges",
		hint: "Each edge of the map is a trait. Tap an edge to pull the map that way.",
		tokens: (ctx) => (ctx.st.mem.w as string[] | undefined) ?? [],
		top: (_ctx, tokens) =>
			tokens.length
				? `<p class="rm-say"><b>Pulled toward titles ${kit.withOrWithout(tokens).replace(/<\/?b>/g, "")}</b><span>tap an edge again to let go</span></p>`
				: '<p class="rm-say"><b>Pull the map by an edge</b><span>nearer = more alike</span></p>',
		ctl: (ctx, tokens) =>
			((ctx.st.mem.tr as string[] | undefined) ?? [])
				.slice(0, 4)
				.map((token, i) => {
					const k = kit.tok(token)
					return k
						? `<button type="button" class="rg-e rg-e${i}" data-pl-act="ed" data-arg="${core.esc(token)}" aria-pressed="${tokens.indexOf(token) >= 0}" style="--c:${kit.hue(k.key)}"><i>${kit.emo(k.key)}</i>${
								k.op === ">" ? "with" : "without"
							} ${core.esc(kit.low(k.key))}</button>`
						: ""
				})
				.join(""),
		note: (_ctx, tokens, list, places, more) =>
			tokens.length
				? `Around it: titles ${kit.withOrWithout(tokens)}.${list.length < places && !more ? ` These ${list.length} are all there are.` : ""}`
				: "The four edges are four ways out of this neighborhood. Two edges at once work too.",
		act: (ctx, name, arg) => {
			if (name !== "ed") return false
			const mem = ctx.st.mem
			const at = ((mem.tr as string[] | undefined) ?? []).indexOf(arg)
			const on = ((mem.w as string[] | undefined) ?? []).indexOf(arg) < 0
			mem.w = kit.toggled(mem.w, arg)
			const side = SIDES[at] ?? [0, 0]
			const far = kit.posterW() * 1.2 * (on ? 1 : -1)
			kit.pull(side[0] * far, side[1] * far)
			return true
		},
		will: (ctx, name, arg) => (name === "ed" ? kit.toggled(ctx.st.mem.w, arg) : null),
	})
}

/**
 * rings5, legend. Nothing to choose from a list of traits: the map itself says what is around. Every poster wears
 * the color of the one way it differs most from the title in the middle, the legend counts the colors, and a tap on
 * a legend entry keeps only the titles that differ that way.
 */
const rings5: RingsForm = (core, kit) => {
	type Entry = { token: string; text: string; n: number; key: string }
	/** The ways the nearest titles differ most, with how many do: the legend of one title's neighborhood. */
	const legend = (ctx: PlayCtx): Entry[] => {
		if (ctx.e.ui.lg) return ctx.e.ui.lg as Entry[]
		if (!ctx.list || !ctx.c.s) return []
		const counts: Record<string, Entry> = {}
		for (const t of kit.around(ctx, []).slice(0, 48)) {
			if (!t.s) continue
			const most = kit.gaps(ctx.c, t, 1)[0]
			if (!most || Math.abs(most.d) < 3) continue
			const v = core.val(ctx.c, most.k)
			const token = most.d > 0 ? `${most.k}>${Math.min(10, v + 3)}` : `${most.k}<${Math.max(0, v - 3)}`
			counts[token] = counts[token] ?? { token, key: most.k, n: 0, text: `${most.d > 0 ? "more" : "less"} ${kit.low(most.k)}` }
			counts[token].n++
		}
		const out = Object.keys(counts)
			.map((token) => counts[token])
			.filter((entry) => entry.n >= 2)
			.sort((a, b) => b.n - a.n)
			.slice(0, 4)
		// Kept with the place in the walk, so that the legend does not change while its titles are looked at.
		if (!ctx.soft && out.length) ctx.e.ui.lg = out
		return out
	}
	const labels = (ctx: PlayCtx) => (ctx.st.mem.lb as Record<string, string> | undefined) ?? {}
	return kit.make({
		name: "rings5",
		mode: "0",
		th: 56,
		tall: true,
		hint: "Colors say how a title differs most. The legend is the filter.",
		tokens: (ctx) => (ctx.st.mem.w as string[] | undefined) ?? [],
		top: (ctx, tokens) => {
			const entries = legend(ctx)
			const kept = tokens.map((token) => ({ token, key: kit.tok(token)?.key ?? "", n: -1, text: labels(ctx)[token] ?? token }))
			const all = kept.concat(entries.filter((entry) => tokens.indexOf(entry.token) < 0)).slice(0, Math.max(4, kept.length))
			if (!all.length) return `<p class="rm-say"><span>${ctx.list && !ctx.soft ? "The titles around differ in no clear way." : "Reading the neighborhood…"}</span></p>`
			return `<div class="rg-lg" role="group" aria-label="How the titles around differ">${all
				.map(
					(entry) =>
						`<button type="button" class="rg-le" data-pl-act="lg" data-arg="${core.esc(`${entry.token}|${entry.text}`)}" aria-pressed="${tokens.indexOf(entry.token) >= 0}" style="--c:${kit.hue(entry.key)}"><u></u>${core.esc(
							entry.text,
						)}${entry.n > 0 ? `<em>${entry.n}</em>` : ""}</button>`,
				)
				.join("")}</div>`
		},
		deco: (ctx) => {
			const entries = legend(ctx)
			const active = ((ctx.st.mem.w as string[] | undefined) ?? []).map((token) => ({ token, key: kit.tok(token)?.key ?? "" }))
			const all = active.concat(entries)
			if (!all.length) return null
			return (t) => {
				if (!t.s) return { inner: "", extra: "" }
				const most = ctx.c.s ? kit.gaps(ctx.c, t, 1)[0] : undefined
				// Its own strongest difference if the legend has it, else the first entry it passes.
				const mine = all.filter((entry) => kit.pass(t, entry.token))
				const pick = mine.filter((entry) => entry.key === most?.k)[0] ?? mine[0]
				return pick ? { inner: `<i class="rg-tn" style="--c:${kit.hue(pick.key)}"></i>`, extra: `;--oc:${kit.hue(pick.key)}` } : { inner: "", extra: "" }
			}
		},
		note: (ctx, tokens, list, places, more) =>
			tokens.length
				? `Only titles with <b>${tokens.map((token) => core.esc(labels(ctx)[token] ?? token)).join("</b> and <b>")}</b>.${list.length < places && !more ? ` These ${list.length} are all there are.` : ""}`
				: "A color is the one way a title differs most from the middle. Tap a color above to keep only those.",
		act: (ctx, name, arg) => {
			if (name !== "lg") return false
			const [token, text] = arg.split("|")
			const mem = ctx.st.mem
			mem.w = kit.toggled(mem.w, token)
			mem.lb = { ...labels(ctx), [token]: text }
			return true
		},
		will: (ctx, name, arg) => (name === "lg" ? kit.toggled(ctx.st.mem.w, arg.split("|")[0]) : null),
	})
}

/**
 * rings6, pad. Two controls in one: two traits of the page's title as the two directions of a pad. The dot in the
 * middle is "as it comes"; to the right is more of the first trait than the title in the middle, to the left less,
 * up more of the second, down less. A tap on the pad or a drag of the dot.
 */
const rings6: RingsForm = (core, kit) => {
	const tokensOf = (ctx: PlayCtx, at: number[]) => {
		const out: string[] = []
		const keys = (ctx.st.mem.ax as string[] | undefined) ?? []
		keys.slice(0, 2).forEach((key, i) => {
			const v = core.val(ctx.c, key)
			if (at[i] < 0) out.push(`${key}<${Math.max(0, v - 2)}`)
			if (at[i] > 0) out.push(`${key}>${Math.min(10, v + 2)}`)
		})
		return out
	}
	const where = (ctx: PlayCtx) => (ctx.st.mem.pd as number[] | undefined) ?? [0, 0]
	const say = (ctx: PlayCtx, at: number[]) => {
		const keys = (ctx.st.mem.ax as string[] | undefined) ?? []
		const out: string[] = []
		keys.slice(0, 2).forEach((key, i) => {
			if (at[i]) out.push(`${at[i] > 0 ? "more" : "less"} ${kit.low(key)}`)
		})
		return out
	}
	return kit.make({
		name: "rings6",
		mode: "pad",
		th: 56,
		tall: true,
		big: true,
		hint: "Two traits, one pad. Move the dot.",
		tokens: (ctx) => tokensOf(ctx, where(ctx)),
		top: (ctx) => {
			const keys = ((ctx.st.mem.ax as string[] | undefined) ?? []).slice(0, 2)
			if (keys.length < 2) return '<p class="rm-say"><span>The pad is on its way.</span></p>'
			const at = where(ctx)
			let grid = ""
			for (const y of [1, 0, -1])
				for (const x of [-1, 0, 1]) {
					const text = say(ctx, [x, y]).join(", ") || "as it comes"
					grid += `<button type="button" data-pl-act="pd" data-arg="${x},${y}" aria-pressed="${at[0] === x && at[1] === y}" aria-label="${core.esc(text)}"></button>`
				}
			const told = say(ctx, at)
			return `<div class="rg-pd"><div class="rg-pad" data-pl-drag="" style="--px:${at[0]};--py:${at[1]};--cx:${kit.hue(keys[0])};--cy:${kit.hue(keys[1])}">${grid}<i class="rg-dot" aria-hidden="true"></i><span class="rg-ax rg-ax0" aria-hidden="true">${kit.emo(
				keys[1],
			)}+</span><span class="rg-ax rg-ax1" aria-hidden="true">${kit.emo(keys[0])}+</span><span class="rg-ax rg-ax2" aria-hidden="true">−</span><span class="rg-ax rg-ax3" aria-hidden="true">−</span></div><p class="rg-pds"><span>↔ <i>${kit.emo(
				keys[0],
			)}</i> ${core.esc(kit.word(keys[0]))}</span><span>↕ <i>${kit.emo(keys[1])}</i> ${core.esc(kit.word(keys[1]))}</span><b>${told.length ? core.esc(told.join(", ")) : "as it comes"}</b></p></div>`
		},
		note: (ctx, tokens, list, places, more) =>
			tokens.length
				? `Around it: <b>${say(ctx, where(ctx)).map(core.esc).join("</b> and <b>")}</b> than ${core.esc(ctx.c.t)}.${list.length < places && !more ? ` These ${list.length} are all there are.` : ""}`
				: "Move the dot on the pad: sideways is one trait, up and down the other.",
		act: (ctx, name, arg) => {
			if (name !== "pd") return false
			ctx.st.mem.pd = arg.split(",").map(Number)
			return true
		},
		will: (ctx, name, arg) => (name === "pd" ? tokensOf(ctx, arg.split(",").map(Number)) : null),
		drag: (ctx, x, y, w, h) => {
			const at = [x < w / 3 ? -1 : x > (2 * w) / 3 ? 1 : 0, y < h / 3 ? 1 : y > (2 * h) / 3 ? -1 : 0]
			const was = where(ctx)
			if (was[0] === at[0] && was[1] === at[1]) return false
			ctx.st.mem.pd = at
			return true
		},
	})
}

/**
 * rings7, blend. "More like this one too": every poster has a plus, and a tap on it keeps that title in the mix
 * without leaving the middle. The rings then hold the titles that are alike both, and the second title stays in the
 * mix while you walk, until it is taken out.
 */
const rings7: RingsForm = (core, kit) => {
	const partner = (ctx: PlayCtx) => {
		const key = ctx.st.mem.bl as string | undefined
		return key && key !== ctx.c.k ? core.title(key) : undefined
	}
	return kit.make({
		name: "rings7",
		mode: "0",
		th: 32,
		hint: "A tap walks. The plus on a poster keeps that title in the mix.",
		tokens: (ctx) => {
			const other = partner(ctx)
			return other ? [`_b=${other.k}`] : []
		},
		top: (ctx) => {
			const other = partner(ctx)
			return `<div class="rg-bl"><span class="rg-bn">Like <b>${core.esc(ctx.c.t)}</b></span><span class="rg-bp" aria-hidden="true">+</span>${
				other
					? `<button type="button" class="rg-pt" data-pl-act="bl" data-arg="" aria-label="${core.esc(`Take ${other.t} out of the mix`)}"><img alt="" src="${core.esc(core.src(other.p))}"><b>${core.esc(other.t)}</b><em>take out</em></button>`
					: '<span class="rg-slot">the ＋ on a poster</span>'
			}</div>`
		},
		deco: (ctx) => {
			const other = partner(ctx)
			return (t) =>
				other && t.k === other.k
					? { inner: '<i class="rg-in" aria-hidden="true">in the mix</i>', extra: ";--oc:#fbbf24" }
					: { inner: `<span class="rg-pl" role="button" data-pl-act="bl" data-arg="${t.k}" aria-label="${core.esc(`Keep ${t.t} in the mix`)}">+</span>`, extra: "" }
		},
		note: (ctx, tokens) => {
			const other = partner(ctx)
			return other
				? `The rings hold what is like both <b>${core.esc(ctx.c.t)}</b> and <b>${core.esc(other.t)}</b>.${core.alt(ctx.c.k, tokens[0] ?? "") ? "" : " Sorting them…"}`
				: "The ＋ on a poster keeps that title in the mix: the rings then hold what is like both."
		},
		act: (ctx, name, arg) => {
			if (name !== "bl") return false
			ctx.st.mem.bl = arg || undefined
			if (arg) core.need(arg)
			return true
		},
		will: (_ctx, name, arg) => (name === "bl" && arg ? [`_b=${arg}`] : null),
	})
}

/**
 * rings8, practical. No traits at all: movie or show, older or newer than the page's title, well rated, and on one
 * of the large subscription services in the visitor's country. Facts a visitor filters by anyway.
 */
const rings8: RingsForm = (core, kit) => {
	const PAIRS = ["_k", "_y"]
	const after = (ctx: PlayCtx, token: string) => {
		const now = ((ctx.st.mem.w as string[] | undefined) ?? []).slice()
		if (now.indexOf(token) >= 0) return now.filter((t) => t !== token)
		const key = kit.tok(token)?.key ?? ""
		// A movie is not a show, and older is not newer: the other of a pair goes.
		return now.filter((t) => PAIRS.indexOf(key) < 0 || kit.tok(t)?.key !== key).concat([token])
	}
	const text = (ctx: PlayCtx, token: string) => {
		const k = kit.tok(token)
		if (!k) return ""
		if (k.key === "_k") return k.v === "m" ? "movies" : "shows"
		if (k.key === "_y") return k.op === "<" ? `from before ${Number(k.v) + 1}` : `from after ${Number(k.v) - 1}`
		if (k.key === "_r") return `rated ${k.v} or more`
		return `on a streaming service in ${ctx.st.mem.cc ?? "your country"}`
	}
	return kit.make({
		name: "rings8",
		mode: "practical",
		th: 56,
		tall: true,
		hint: "Facts instead of traits: kind, year, score, streaming.",
		tokens: (ctx) => (ctx.st.mem.w as string[] | undefined) ?? [],
		top: (ctx, tokens) => {
			const year = Number(ctx.st.mem.yr) || 0
			const all: [string, string][] = [
				["_k=m", "🎬 Movies"],
				["_k=s", "📺 Shows"],
				["_r>80", "⭐ Rated 80+"],
				[`_y<${year - 1}`, `⏪ Before ${year}`],
				[`_y>${year + 1}`, `⏩ After ${year}`],
			]
			if (ctx.st.mem.cc) all.push(["_st=1", `▶ Streaming · ${ctx.st.mem.cc}`])
			return `<div class="rg-pr" role="group" aria-label="Only">${all
				.map(([token, label]) => `<button type="button" class="rg-f" data-pl-act="pr" data-arg="${core.esc(token)}" aria-pressed="${tokens.indexOf(token) >= 0}">${core.esc(label)}</button>`)
				.join("")}</div>`
		},
		note: (ctx, tokens, list, places, more) =>
			tokens.length
				? `Around it: only <b>${tokens.map((token) => core.esc(text(ctx, token))).join("</b>, <b>")}</b>.${list.length < places && !more ? ` These ${list.length} are all there are.` : ""}`
				: "No traits here: what kind, how old, how well rated, and whether it can be streamed.",
		act: (ctx, name, arg) => {
			if (name !== "pr") return false
			ctx.st.mem.w = after(ctx, arg)
			return true
		},
		will: (ctx, name, arg) => (name === "pr" ? after(ctx, arg) : null),
	})
}

/**
 * rings9, heading. A control that builds itself. At the start there is none. With every step the form compares
 * where you stand with where you started: a trait that moved by three levels or more shows up as "more" or "less"
 * of it, and the rings keep it (nothing around falls back). Each can be let go with a tap, and taken up again.
 */
const rings9: RingsForm = (core, kit) => {
	const drift = (ctx: PlayCtx) => {
		if (!ctx.c.s || !ctx.root.s || ctx.c.k === ctx.root.k) return []
		return kit.WORDS.map((key) => ({ key, d: core.val(ctx.c, key) - core.val(ctx.root, key), v: core.val(ctx.c, key) }))
			.filter((e) => Math.abs(e.d) >= 3)
			.sort((a, b) => Math.abs(b.d) - Math.abs(a.d))
			.slice(0, 3)
	}
	const off = (ctx: PlayCtx) => (ctx.st.mem.off as Record<string, boolean> | undefined) ?? {}
	const tokenOf = (e: { key: string; d: number; v: number }) => (e.d > 0 ? `${e.key}>${Math.max(0, e.v - 1)}` : `${e.key}<${Math.min(10, e.v + 1)}`)
	return kit.make({
		name: "rings9",
		mode: "0",
		hint: "No control yet. Walk, and where you are heading shows up here.",
		tokens: (ctx) =>
			drift(ctx)
				.filter((e) => !off(ctx)[e.key])
				.map(tokenOf),
		top: (ctx) => {
			const all = drift(ctx)
			if (!all.length)
				return `<p class="rm-say"><b>${ctx.c.k === ctx.root.k ? "Heading nowhere yet" : "Still close to where you started"}</b><span>walk, and it shows here</span></p>`
			return `<div class="rm-sw" role="group" aria-label="Where the walk is heading">${all
				.map(
					(e) =>
						`<button type="button" class="rm-ch" data-pl-act="hd" data-arg="${e.key}" aria-pressed="${!off(ctx)[e.key]}" style="--c:${kit.hue(e.key)}"><i>${kit.emo(e.key)}</i>${e.d > 0 ? "more" : "less"} ${core.esc(kit.low(e.key))}</button>`,
				)
				.join("")}</div>`
		},
		note: (ctx) => {
			const all = drift(ctx)
			return all.length
				? `Since ${core.esc(ctx.root.t)}: ${all.map((e) => `${core.esc(kit.low(e.key))} ${e.v - e.d} → ${e.v}`).join(", ")}. The rings keep what is lit; tap one to let it go.`
				: "What you walk toward collects above by itself, and the rings then keep it."
		},
		act: (ctx, name, arg) => {
			if (name !== "hd") return false
			ctx.st.mem.off = { ...off(ctx), [arg]: !off(ctx)[arg] }
			return true
		},
		will: (ctx, name, arg) =>
			name === "hd"
				? drift(ctx)
						.filter((e) => (e.key === arg ? off(ctx)[e.key] : !off(ctx)[e.key]))
						.map(tokenOf)
				: null,
	})
}

/**
 * rings10, in words. Something that only displays. A sentence about the titles on the map right now: what most of
 * them have a lot of, what hardly any has, and what changes further out. It follows the zoom and the walk.
 */
const rings10: RingsForm = (core, kit) => {
	const mean = (list: PlayTitle[], key: string) => (list.length ? list.reduce((sum, t) => sum + core.val(t, key), 0) / list.length : 0)
	return kit.make({
		name: "rings10",
		mode: "0",
		th: 52,
		tall: true,
		hint: "Nothing to operate: the words say what is on the map.",
		tokens: () => [],
		top: (ctx, _tokens, list, places) => {
			const shown = list.slice(0, places).filter((t) => t.s)
			if (shown.length < 4) return '<p class="rg-iw">Reading the titles on the map…</p>'
			const b = (key: string) => `<b style="--c:${kit.hue(key)}">${core.esc(kit.low(key))}</b>`
			const join = (words: string[]) => (words.length > 1 ? `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}` : (words[0] ?? ""))
			const levels = kit.WORDS.map((key) => ({ key, m: mean(shown, key) }))
			const much = levels
				.filter((e) => e.m >= 6.5)
				.sort((a, b2) => b2.m - a.m)
				.slice(0, 3)
			const little = levels
				.filter((e) => e.m <= 2)
				.sort((a, b2) => a.m - b2.m)
				.slice(0, 2)
			const outer = list.slice(places, places + 60).filter((t) => t.s)
			let further = ""
			if (outer.length >= 8) {
				const moved = kit.WORDS.map((key) => ({ key, d: mean(outer, key) - mean(shown, key) })).sort((a, b2) => b2.d - a.d)
				const up = moved[0]
				const down = moved[moved.length - 1]
				const parts: string[] = []
				if (up.d >= 0.8) parts.push(`more ${b(up.key)}`)
				if (down.d <= -0.8) parts.push(`less ${b(down.key)}`)
				if (parts.length) further = ` Further out: ${parts.join(", ")}.`
			}
			return `<p class="rg-iw">These ${shown.length}: ${much.length ? `a lot of ${join(much.map((e) => b(e.key)))}` : "no trait in common"}${
				little.length ? `, hardly any ${join(little.map((e) => b(e.key)))}` : ""
			}.${further}</p>`
		},
		note: () => "The sentence above is about the titles on the map right now. − shows more of them, and the sentence follows.",
	})
}

export const RINGS_FORMS: Record<string, RingsForm> = { roam1, rings1, rings2, rings3, rings4, rings5, rings6, rings7, rings8, rings9, rings10 }
