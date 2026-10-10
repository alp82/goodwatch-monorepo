// The rings of the related map: one title in the middle, the related titles on rings around it, the ring is the rank
// of similarity, and a zoom.
//
// - A step is a camera pan. The places are a lattice, so moving everything by the vector that brings the tapped
//   poster into the middle puts every poster on a place again, and the title you came from on the place exactly
//   opposite the tapped one, where it stays as the way back. A title's ring is still its similarity rank to the
//   new middle: within its ring it takes the place the pan carried it to, or the free place nearest to that, and
//   moves there in a short second beat. New titles ride in with the pan, the ones that leave ride out and fade.
// - The pan is slow enough for the eye to follow (about a second), and everything around it is timed for that: the
//   short way a poster takes to its own place begins while the map comes to rest, new titles are solid before the
//   pan is half over, the way back gets its mark once it has left the middle, and a control lets go of what leaves
//   before it brings in what comes.
// - Pointing at a poster shows that title in the card: its name and year, and how it differs from the page's title.
//   Nothing else in the card changes. A finger that stays on a poster does the same.
// - A control can be looked at before it is used: the map dims what would leave.
// - A filter that has nothing to show yet never leaves the map empty.
// - The picture is laid out for the real width before the first paint, from the titles the server sent along.
//
// The control area, the card, and what they show of the map are the form's (trail.ts).
import type { MapCore, MapCtx, MapForm, MapState, MapTitle } from "./engine"
import type { TraitWords } from "./traits"

/** The pages of a filter a title can be asked for beyond its pack (see server/related-map.server.ts). */
const MAX_PAGE = 6

export type RingsKit = ReturnType<typeof ringsKit>
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
	cls: string
	rstyle: string
	geo: string
	top: string
	bg: string
	ctl: string
	info: string
	ck: string
	wstyle: string
	rest: string
	/** The filter the picture shows, by its name. */
	filter: string
	/** The zoom the picture is drawn at. */
	z: number
	/** How far a poster may move to its own place after a pan, in px. Further than that, it fades over. */
	hop: number
	items: Item[]
}
/** What a title wears on its poster in one form: a mark inside it, and a style of its own. */
type Deco = (title: MapTitle, rank: number) => { inner: string; extra: string }
/** How long the parts of one redraw take, in ms: fades in and out, the move of what stays, the size, the way back's mark. */
interface Pace {
	fi: number
	fd: number
	fo: number
	mv: number
	md: number
	sc: number
	bk: number
	end: number
}
/** What the form (trail.ts) brings to the kit: the control area, the card, and what they show of the map. */
interface Spec {
	/** The control area's height on a phone. */
	th: number
	/** The map's height on a phone. */
	mh: number
	/** The filter that is on. */
	tokens: (ctx: MapCtx) => string[]
	/** The control area. */
	top: (ctx: MapCtx, tokens: string[]) => string
	/** The card's last line. `places`: how many titles the map holds at this zoom. */
	note: (ctx: MapCtx, tokens: string[], list: MapTitle[], places: number, more: boolean) => string
	act: (ctx: MapCtx, name: string, arg: string) => boolean
	/** The filter a control would lead to: it is asked for while the finger is still down, and the map dims what does not pass it while the control is pointed at or held. */
	will: (ctx: MapCtx, name: string, arg: string) => string[] | null
	deco: (ctx: MapCtx, list: MapTitle[], places: number) => Deco | null
	/** A control is pointed at or held (`tokens`), or no longer (null): what the form shows of it beyond the map. */
	shown: (section: Element, ctx: MapCtx, tokens: string[] | null, name: string, arg: string) => void
	/** The card's markup. It carries the kit's marks for the name, the year, and the comparison. */
	card: (ctx: MapCtx, note: string) => string
	/** How a title differs from the page's title, as the card says it. */
	diff: (ctx: MapCtx, title: MapTitle) => string
	/** A poster is pointed at or held (`title`), or no longer (null): what the form shows of it beyond the card. */
	peeked: (section: Element, ctx: MapCtx, title: MapTitle | null) => void
}
type Moved = HTMLElement & {
	__m?: Spot
	__c?: Spot
	__h?: string
	__a?: Animation | null
	__born?: number
	__fi?: number
	__xv?: string
	__xu?: number
	__end?: number
	__pk?: { nm: string; yr: string; df: string } | null
}

export function ringsKit(core: MapCore, words: TraitWords) {
	const { esc, val } = core
	const win = core.win
	const WORDS = Object.keys(words)
	const word = (key: string) => words[key]?.[0] ?? key
	const emo = (key: string) => words[key]?.[1] ?? ""
	const low = (key: string) => word(key).toLowerCase()
	const enc = encodeURIComponent
	// The pace of the movement. A step is slow enough for the eye to follow the map, a zoom and a control half that.
	const STEP = 4
	const ZOOM = 2
	const FLIP = 2

	// --- The stage's size and the lattice ---------------------------------------------------------------------
	// The server draws for a phone. The browser measures the map before the first paint and draws again if needed.
	const box = { w: 346, h: 368 }
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
	type Token = { key: string; op: string; n: number }
	const parsed: Record<string, Token | null> = {}
	const tok = (token: string): Token | null => {
		if (parsed[token] === undefined) {
			const m = /^([a-z_]+)([<>])(\d+)$/.exec(token)
			parsed[token] = m ? { key: m[1], op: m[2], n: Number(m[3]) } : null
		}
		return parsed[token]
	}
	const pass = (t: MapTitle, token: string) => {
		const k = tok(token)
		if (!k) return true
		const level = val(t, k.key)
		return k.op === ">" ? level >= k.n : level <= k.n
	}
	const passes = (t: MapTitle, tokens: string[]) => {
		for (const token of tokens) if (!pass(t, token)) return false
		return true
	}
	const nameOf = (tokens: string[]) => tokens.slice().sort().join(",")
	/**
	 * Down to which similarity the titles that pass a filter are all in memory. A list that came for the filter itself
	 * says so. Without one, whatever is known for a part of the filter holds for all of it: a title that passes
	 * "tense and funny" is among the tense ones.
	 */
	const bound = (ctx: MapCtx, tokens: string[]) => {
		const exact = core.floor(ctx.c.k, nameOf(tokens))
		if (exact !== undefined) return exact
		let best = core.floor(ctx.c.k, "")
		for (const token of tokens) {
			const part = core.floor(ctx.c.k, token)
			if (part !== undefined && (best === undefined || part < best)) best = part
		}
		return best
	}
	/** A title's franchise as far as its name tells: "Toy Story 2" and "Toy Story" are one. */
	const stem = (t: MapTitle & { f?: string }) => {
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
	/**
	 * The titles around the one you stand on that pass a filter, most alike first. Only down to the similarity they
	 * are complete to, so that a page that arrives later adds titles further out and pushes none aside.
	 */
	const around = (ctx: MapCtx, tokens: string[]): MapTitle[] => {
		if (!ctx.list) return []
		let out = tokens.length ? ctx.list.filter((t) => t.s && passes(t, tokens)) : ctx.list
		if (!ctx.soft) {
			const floor = bound(ctx, tokens)
			if (floor) out = out.filter((t) => t.n * 1000 >= floor - 0.01)
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
	/** The suffix of a pack's address that asks for a further page of a filter. */
	const pageOf = (name: string, d: number) => `&f=${enc(name)}&d=${d}`
	/** Makes sure `count` titles are there under a filter, or on their way. Never waited for. True: on their way. */
	const want = (ctx: MapCtx, tokens: string[], held: number, count: number): boolean => {
		if (!win || ctx.soft || !ctx.list || held >= count) return false
		const name = nameOf(tokens)
		if (bound(ctx, tokens) === 0) return false
		if (core.floor(ctx.c.k, name) === 0) return false
		const id = `${ctx.c.k}|${name}`
		// The pack itself is the first page of the plain order. A filter starts at its own first page.
		let d = page[id] ?? (name ? 0 : 1)
		const ask = () => core.more(ctx.c.k, pageOf(name, d))
		if (ask()) return true
		if (d >= MAX_PAGE) return false
		d++
		page[id] = d
		return ask()
	}
	/** True when there may be more titles under a filter than are in memory. */
	const open = (ctx: MapCtx, tokens: string[]) => !ctx.list || ctx.soft || (core.floor(ctx.c.k, nameOf(tokens)) !== 0 && bound(ctx, tokens) !== 0)

	// --- Words ----------------------------------------------------------------------------------------------------
	/** How a title differs from another on the plain traits, strongest first: at least two levels. */
	const gaps = (from: MapTitle, t: MapTitle, max: number) =>
		WORDS.map((k) => ({ k, d: val(t, k) - val(from, k) }))
			.filter((e) => Math.abs(e.d) >= 2)
			.sort((a, b) => Math.abs(b.d) - Math.abs(a.d))
			.slice(0, max)
	const when = (t: MapTitle) => `${esc(t.y)}${t.k.charAt(0) === "s" ? " · Show" : ""}`
	/** Pointing at a poster changes the card's name, year, and comparison to that title's, and nothing else. */
	const peek = (section: Element, ctx: MapCtx, t: MapTitle | null, diff: (ctx: MapCtx, title: MapTitle) => string) => {
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
		df.innerHTML = diff(ctx, t)
		card.setAttribute("data-r-pk", t.k)
	}
	const withOrWithout = (tokens: string[]) =>
		tokens
			.map((token) => {
				const k = tok(token)
				return k ? `<b>${k.op === ">" ? "with" : "without"} ${esc(low(k.key))}</b>` : ""
			})
			.join(" and ")
	const zoomOf = (ctx: MapCtx) => Math.max(0, Math.min(zooms().length - 1, Number(ctx.st.mem.z) || 0))
	const zoomCtl = (ctx: MapCtx, shown: number) => {
		const z = zoomOf(ctx)
		return `<div class="rm-z" role="group" aria-label="How far out the map reaches"><button type="button" data-pl-act="z" data-arg="1" aria-label="Further out: more titles"${
			z >= zooms().length - 1 ? " disabled" : ""
		}>−</button><span>${shown}</span><button type="button" data-pl-act="z" data-arg="-1" aria-label="Closer: larger posters"${z <= 0 ? " disabled" : ""}>+</button></div>`
	}

	// --- A picture: who sits where ---------------------------------------------------------------------------------
	const round = (n: number, by: number) => Math.round(n * by) / by
	const place = (x: number, y: number, s: number, extra = "") => `--x:${round(x, 10)}px;--y:${round(y, 10)}px;--s:${round(s, 1000)}${extra}`
	const item = (ctx: MapCtx, t: MapTitle, cell: Cell, s: number, came: boolean, rank: number, deco: Deco | null): Item => {
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
	const middle = (ctx: MapCtx, scale: number): Item => {
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
	const lay = (ctx: MapCtx, list: MapTitle[], spots: Cell[] & { ix?: Record<string, number> }, scale: number, coming: boolean, deco: Deco | null, filter: string) => {
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
		const put = (t: MapTitle, n: number, came: boolean, rank: number) => {
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
			let left: { t: MapTitle; rank: number }[] = []
			titles.forEach((t, i) => {
				const n = prefs ? ix[prefs[t.k]] : undefined
				if (n !== undefined && n >= from && n < to && !used[n]) put(t, n, false, first + i)
				else left.push({ t, rank: first + i })
			})
			if (prefs && left.length) {
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
	/** After a picture is in the stage: a control that is being looked at keeps its marks on the map. */
	let again: ((root: Element) => void) | null = null
	// Where the mouse is. A pan may carry a pointed-at poster away from under a pointer that rests: when the pan is
	// over, the card shows what is under the pointer then (`rested`).
	let mouse: { x: number; y: number } | null = null
	let rested: ((root: Element, key: string) => void) | null = null
	if (win)
		win.addEventListener(
			"pointermove",
			(event: PointerEvent) => {
				if (event.pointerType === "mouse") mouse = { x: event.clientX, y: event.clientY }
			},
			{ capture: true, passive: true },
		)
	const html = (view: View) => {
		last = view
		return `<div class="${view.cls}" style="${view.rstyle}" data-r-root="" data-r-geo="${view.geo}" data-r-z="${view.z}"${
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
	let PAN = 240 * STEP
	/** How long after the pan the last poster is on its own place, and the part of the pan it waits out first. */
	const TAIL = 20 * STEP
	const HOLD = 0.72
	const EASE = "cubic-bezier(.3,.3,.2,1)"
	/**
	 * The pace of one redraw. A step: new titles are solid before the pan is half over, the ones that leave are gone
	 * a little later, and the way back gets its mark once it has left the middle. A zoom: everything moves and
	 * changes size as one. A control: what leaves fades first, what stays moves, what comes fades in last. More
	 * titles that arrive by themselves come in quickly.
	 */
	const paceOf = (kind: string): Pace =>
		kind === "step"
			? { fi: 105 * STEP, fd: 0, fo: 130 * STEP, mv: 0, md: 0, sc: 75 * STEP, bk: 100 * STEP, end: PAN + TAIL }
			: kind === "zoom"
				? { fi: 120 * ZOOM, fd: 80 * ZOOM, fo: 120 * ZOOM, mv: 200 * ZOOM, md: 0, sc: 200 * ZOOM, bk: 0, end: 200 * ZOOM }
				: kind === "flip"
					? { fi: 130 * FLIP, fd: 110 * FLIP, fo: 120 * FLIP, mv: 190 * FLIP, md: 30 * FLIP, sc: 190 * FLIP, bk: 0, end: 240 * FLIP }
					: { fi: 190, fd: 0, fo: 190, mv: 200, md: 0, sc: 200, bk: 0, end: 200 }
	let T = paceOf("")
	let busy = 0
	const num = (text: string | undefined) => Number.parseFloat(text ?? "") || 0
	// The movement is one animation of the whole map (the pan), and one more for each poster that then has a short
	// way to its own place. A poster's place is its own (`--x`, `--y`) plus the map's, and "where it is right now"
	// reads both, so that a tap in the middle of a pan goes on from there.
	const offset = (node: Moved, live: boolean): { x: number; y: number } | null => {
		if (!live || !node.__a || node.__a.playState !== "running") return null
		const tr = String(win.getComputedStyle(node).translate)
		if (tr === "none") return { x: 0, y: 0 }
		const at = tr.split(" ")
		return { x: num(at[0]), y: num(at[1]) }
	}
	/** Where a poster is within the map right now. */
	const read = (node: Moved, live: boolean): Spot => {
		const moving = offset(node, live)
		if (moving) return { x: moving.x, y: moving.y, s: 1, o: 1 }
		if (node.__m) return node.__m
		return { x: num(node.style.getPropertyValue("--x")), y: num(node.style.getPropertyValue("--y")), s: 1, o: 1 }
	}
	const frame = (x: number, y: number, extra?: Record<string, unknown>) => ({ translate: `${x}px ${y}px`, ...extra })
	const stop = (node: Moved) => {
		if (node.__a) node.__a.cancel()
		node.__a = null
	}
	const play = (node: Moved, frames: Record<string, unknown>[], duration: number, easing: string, delay = 0) => {
		stop(node)
		if (node.animate) node.__a = node.animate(frames as unknown as Keyframe[], delay ? { duration, easing, delay, fill: "backwards" } : { duration, easing })
	}
	/** What a poster's style carries beyond its place while a fade of its own runs: how long that fade takes. */
	const keep = (node: Moved, now: number) => (node.__xu && now < node.__xu ? (node.__xv ?? "") : "")
	/**
	 * A poster that stays. `from` is where it is within the map as the motion starts. After a step the map's pan
	 * carries it (`pan`), and it only moves itself when its own place is another one: it waits out most of the pan,
	 * and takes the short way while the map comes to rest. Without a step it goes straight there.
	 */
	const move = (node: Moved, from: { x: number; y: number }, to: Item, pan: boolean, calm: boolean) => {
		node.__m = { x: to.x, y: to.y, s: to.s, o: 1 }
		if (calm || Math.abs(from.x - to.x) + Math.abs(from.y - to.y) < 0.6) return stop(node)
		if (!pan) play(node, [frame(from.x, from.y), frame(to.x, to.y)], T.mv, EASE, T.md)
		else play(node, [frame(from.x, from.y), frame(from.x, from.y, { offset: (HOLD * PAN) / (PAN + TAIL), easing: "cubic-bezier(.3,0,.3,1)" }), frame(to.x, to.y)], PAN + TAIL, "linear")
	}
	/**
	 * A poster that leaves: it stays where the map carries it, fading evenly so that the eye has the old picture to
	 * follow, and is then taken out of the document. `at` is its place within the map. One that is leaving already
	 * keeps its fade.
	 */
	const leave = (node: Moved, at: { x: number; y: number }, calm: boolean, now: number) => {
		const again = node.hasAttribute("data-r-x")
		if (calm) {
			stop(node)
			node.remove()
			return
		}
		let from = again ? node.style.getPropertyValue("--o") : ""
		const fade = again ? node.style.getPropertyValue("--fo") : `${T.fo}ms`
		if (!again) {
			// Still fading in: it fades out from where it is.
			if (node.__born && now - node.__born < (node.__fi ?? 0)) from = String(Math.round(Number(win.getComputedStyle(node).opacity) * 100) / 100)
			node.removeAttribute("data-r-k")
			node.removeAttribute("data-pl-step")
			node.removeAttribute("data-pl-center")
			node.removeAttribute("data-r-c")
			node.setAttribute("data-r-x", "")
			node.setAttribute("aria-hidden", "true")
			node.setAttribute("tabindex", "-1")
			node.__end = now + T.fo
		}
		node.style.cssText = `${place(at.x, at.y, node.__m?.s ?? (num(node.style.getPropertyValue("--s")) || 1))}${from ? `;--o:${from}` : ""};--fo:${fade}`
		node.__m = { x: at.x, y: at.y, s: node.__m?.s ?? 1, o: 0 }
		stop(node)
	}
	/** Takes the posters that have faded out of the document. */
	const sweep = (world: Element) => {
		const now = win.performance.now()
		const gone = world.querySelectorAll("[data-r-x]")
		for (let i = 0; i < gone.length; i++) if (((gone[i] as Moved).__end ?? 0) <= now + 8) gone[i].remove()
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
	const into = (stage: Element): boolean => {
		const view = last
		const root = stage.firstElementChild as HTMLElement | null
		if (!view || !root || !root.hasAttribute("data-r-root")) return false
		const world = root.querySelector("[data-r-w]") as Moved | null
		if (!world) return false
		const calm = still()
		const t0 = win.performance.now()
		const live = t0 < busy
		// Where the map is in its pan right now, and every poster within it.
		const map = offset(world, live) ?? { x: 0, y: 0 }
		const have: Record<string, Moved> = {}
		const ghosts: Moved[] = []
		for (let i = 0; i < world.children.length; i++) {
			const node = world.children[i] as Moved
			const k = node.getAttribute("data-r-k")
			node.__c = read(node, live)
			if (k && !have[k]) have[k] = node
			else ghosts.push(node)
		}
		// The pan: what brings the new middle from where it is on the screen to the middle. A picture of the same
		// middle (more titles arrived, a control, the zoom) leaves a running pan alone.
		const stepped = root.getAttribute("data-r-at") !== view.ck
		if (stepped) root.setAttribute("data-r-at", view.ck)
		const pivot = stepped ? have[view.ck]?.__c : undefined
		const shift = pivot && Math.abs(pivot.x + map.x) + Math.abs(pivot.y + map.y) > 0.6 ? { x: -pivot.x - map.x, y: -pivot.y - map.y } : null
		// After the pan starts the map is `shift` short of its place, so within the map everything is that much on.
		const on = shift ? { x: map.x + shift.x, y: map.y + shift.y } : { x: 0, y: 0 }
		if (shift) PAN = Math.max(220, Math.min(280, 220 + (Math.hypot(shift.x, shift.y) - 100) * 0.2)) * STEP
		// What kind of change this is sets its pace. A step onto a title that was not on the map has no pan: it
		// changes like a control does.
		const kind = shift
			? "step"
			: root.getAttribute("data-r-z") !== String(view.z)
				? "zoom"
				: stepped || root.getAttribute("data-r-f") !== view.filter
					? "flip"
					: ""
		T = paceOf(kind)
		// Only what changed is written: an attribute written again costs a look at every poster's style.
		if (root.className !== view.cls) root.className = view.cls
		if (root.getAttribute("style") !== view.rstyle) root.style.cssText = view.rstyle
		if (root.getAttribute("data-r-geo") !== view.geo) root.setAttribute("data-r-geo", view.geo)
		if (root.getAttribute("data-r-f") !== view.filter) root.setAttribute("data-r-f", view.filter)
		if (root.getAttribute("data-r-z") !== String(view.z)) root.setAttribute("data-r-z", String(view.z))
		// A step answers in the map and in the card. The control area follows in the frame after the first one: it
		// is the part of a step that costs most to lay out, and nobody reads it in the first moment of a pan.
		if (shift && !calm && win.requestAnimationFrame)
			win.requestAnimationFrame(() =>
				win.requestAnimationFrame(() => {
					if (root.isConnected && last) {
						part(root, "top", last.top)
						if (again) again(root)
					}
				}),
			)
		else part(root, "top", view.top)
		part(root, "bg", view.bg)
		part(root, "ctl", view.ctl)
		part(root, "info", view.info)
		// The map's own style never changes with the kind of redraw: a change there is a new style for every poster.
		if (world.getAttribute("style") !== view.wstyle) world.style.cssText = view.wstyle
		if (calm) stop(world)
		else if (shift) play(world, [frame(-shift.x, -shift.y), frame(0, 0)], PAN, EASE)
		const wanted: Record<string, boolean> = {}
		let fresh = ""
		const born: Item[] = []
		const fading = `;--fi:${Math.round(T.fi)}ms;--fd:${Math.round(T.fd)}ms`
		for (const entry of view.items) {
			wanted[entry.k] = true
			let node: Moved | undefined = have[entry.k]
			const c = node?.__c
			// Where the pan alone would leave it, within the map.
			const mx = c ? c.x + on.x : 0
			const my = c ? c.y + on.y : 0
			// A title that the pan carries off the map, or far from its new place, does not fly back across the map:
			// it leaves with the pan like the others, and comes in at its new place like a new one.
			if (node && shift && entry.k !== view.ck) {
				const hop = Math.abs(mx - entry.x) + Math.abs(my - entry.y)
				if (hop > 0.6 && (Math.abs(mx) > box.w / 2 || Math.abs(my) > box.h / 2 || Math.hypot(mx - entry.x, my - entry.y) > view.hop)) node = undefined
			}
			// The same when titles arrive by themselves and one that is shown belongs far from where it is: it fades
			// over. Only a zoom and a control move posters across the map, because there the visitor asked for it.
			if (node && !shift && !kind && entry.k !== view.ck && Math.hypot(mx - entry.x, my - entry.y) > view.hop) node = undefined
			const was = node?.getAttribute("data-r-g")
			if (!node || !c || (was !== entry.sig && !morph(node, entry.html))) {
				if (have[entry.k]) wanted[entry.k] = false
				fresh += calm
					? entry.html
					: entry.html.replace(' rm-p"', ' rm-p rg-new"').replace(' rm-p rg-c"', ' rm-p rg-c rg-new"').replace('style="', `style="${fading.slice(1)};`)
				born.push(entry)
				continue
			}
			// Still fading in when it became something else (a tap on a poster that had just arrived): it goes on fading.
			if (node.__born && t0 - node.__born < (node.__fi ?? 0)) node.classList.add("rg-new")
			// The title you came from gets its mark once the pan has taken it out of the middle.
			if (shift && was !== entry.sig && entry.sig.charAt(0) === "c") {
				node.__xv = `${keep(node, t0)};--cmw:${Math.round(0.4 * PAN)}ms;--cmd:${Math.round(60 * STEP)}ms`
				node.__xu = t0 + PAN
			}
			node.style.cssText = entry.style + keep(node, t0)
			if (node.getAttribute("data-r-q") !== entry.q) node.setAttribute("data-r-q", entry.q)
			if (entry.far !== node.hasAttribute("data-pl-far")) {
				if (entry.far) node.setAttribute("data-pl-far", "")
				else node.removeAttribute("data-pl-far")
			}
			// On its way to the same place already: it goes on as it is.
			const going = node.__m
			if (!shift && !calm && live && going && Math.abs(going.x - entry.x) + Math.abs(going.y - entry.y) < 0.6) {
				going.s = entry.s
				continue
			}
			move(node, { x: mx, y: my }, entry, Boolean(shift), calm)
		}
		let left = ghosts.length
		for (const k in have)
			if (!wanted[k]) {
				const c = have[k].__c ?? { x: 0, y: 0 }
				leave(have[k], { x: c.x + on.x, y: c.y + on.y }, calm, t0)
				left++
			}
		// A poster that is leaving already goes on leaving. A new step moves the map under it: it keeps its place on
		// the screen and rides the new pan.
		for (const node of ghosts) {
			const c = node.__c ?? { x: 0, y: 0 }
			if (shift || calm || !node.hasAttribute("data-r-x")) leave(node, { x: c.x + on.x, y: c.y + on.y }, calm, t0)
		}
		if (left && !calm) win.setTimeout(() => sweep(world), T.fo + 30)
		if (fresh) {
			world.insertAdjacentHTML("beforeend", fresh)
			const count = world.children.length
			born.forEach((entry, i) => {
				const node = world.children[count - born.length + i] as Moved
				node.__m = { x: entry.x, y: entry.y, s: entry.s, o: 1 }
				node.__born = t0
				node.__fi = T.fd + T.fi
				node.__xv = fading
				node.__xu = t0 + T.fd + T.fi
			})
		}
		busy = Math.max(busy, t0 + T.end + 40)
		if (again) again(root)
		if (shift)
			win.setTimeout(
				() => {
					const shown = root.querySelector("[data-r-info]")?.getAttribute("data-r-pk")
					if (!shown || !mouse || !rested || win.performance.now() < busy - 60 || !root.isConnected) return
					const under = win.document.elementFromPoint(mouse.x, mouse.y)?.closest?.("[data-r-w] > [data-r-k]")
					const key = under && root.contains(under) && !under.hasAttribute("data-r-c") ? (under.getAttribute("data-r-k") ?? "") : ""
					if (key !== shown) rested(root, key)
				},
				T.end + 60,
			)
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
	const adopt = (st: MapState, stage: Element) => {
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

	/** The form: the rings, the zoom, the movement, and the card's frame are the kit's. The rest is the spec's. */
	const make = (spec: Spec): MapForm => {
		const th = spec.th
		box.h = spec.mh
		let seen: MapCtx | null = null
		const look = (section: Element, ctx: MapCtx, t: MapTitle | null) => {
			peek(section, ctx, t, spec.diff)
			spec.peeked(section, ctx, t)
		}
		const picture = (ctx: MapCtx) => {
			seen = ctx
			const tokens = spec.tokens(ctx)
			const scale = zooms()[zoomOf(ctx)]
			const spots = cells(scale)
			let list = around(ctx, tokens)
			const passing = list.length
			const more = open(ctx, tokens)
			// A map is never empty, and a walk never ends in one. When hardly any title passes and there are no more,
			// or none passes yet and more may still come, the places left go to the most alike titles as they come,
			// dimmed, and the card says so.
			const thin = tokens.length > 0 && Boolean(ctx.list) && (more ? passing === 0 : passing < 6)
			// Which titles pass is kept by title, not by place in the list: the title you came from is taken out of
			// the list for its own place, and a count would then be one off.
			const has: Record<string, boolean> = {}
			if (thin) {
				for (const t of list) has[t.k] = true
				list = list.concat(around(ctx, []).filter((t) => !has[t.k]))
			}
			const own = spec.deco(ctx, list, spots.length)
			const deco: Deco | null = thin
				? (t, rank) => (!has[t.k] && rank < 99 ? { inner: '<i class="rg-dm" aria-hidden="true"></i>', extra: ";--dm:1" } : own ? own(t, rank) : { inner: "", extra: "" })
				: own
			// Enough for this zoom and the next one out.
			const coming = want(ctx, tokens, passing, Math.round(spots.length * 2.2))
			const shown = Math.min(list.length, spots.length)
			const items = [middle(ctx, scale)].concat(lay(ctx, list, spots, scale, coming, deco, nameOf(tokens)))
			const rings = spots.length ? spots[spots.length - 1].b : 0
			// What the server did not draw goes along as plain data: enough for a wide screen's first picture.
			const rest = win ? "" : JSON.stringify(list.slice(shown, 64).map((t) => [t.k, t.t, t.y, t.p]))
			return html({
				cls: "rm rg rg-map rg-big rg-tall",
				rstyle: `--th:${th}px`,
				geo: geoOf(),
				top: spec.top(ctx, tokens),
				bg: `${guides(scale, Math.min(rings, 3))}<span class="rm-key">${thin ? "dimmed = not a match" : "nearer = more alike"}</span>`,
				ctl: zoomCtl(ctx, shown),
				info: spec.card(
					ctx,
					thin
						? more
							? "Looking further out for titles like that. The dimmed ones are the most alike that are not."
							: `${passing ? `Only ${passing} ${passing === 1 ? "title passes" : "titles pass"} that.` : "No title passes that."} The dimmed ones are the most alike that do not.`
						: spec.note(ctx, tokens, list, spots.length, more),
				),
				ck: ctx.c.k,
				// How long a change of size and the dimming of the title you came from take: a zoom's time, for all.
				wstyle: `--pw:${posterW()}px;--sc:${200 * ZOOM}ms;--bk:${200 * ZOOM}ms`,
				rest,
				filter: nameOf(tokens),
				z: zoomOf(ctx),
				hop: posterW() * scale * 1.107 * 1.75,
				items,
			})
		}
		// A control that is pointed at or held: the map dims what would not be there after it, and the form shows the
		// rest in the control itself. The control that was just used stays quiet until the pointer has left it.
		let hush = ""
		let looked: { name: string; arg: string } | null = null
		const lookAt = (within: Element, ctx: MapCtx, name: string | null, arg: string) => {
			const root = within.matches("[data-r-root]") ? within : within.querySelector("[data-r-root]")
			if (!root) return
			const tokens = name === null ? null : spec.will(ctx, name, arg)
			if (tokens) {
				const drawn = root.querySelectorAll("[data-r-w] > button[data-r-k]")
				for (let i = 0; i < drawn.length; i++) {
					const b = drawn[i]
					const t = core.title(b.getAttribute("data-r-k") ?? "")
					const stays = b.hasAttribute("data-r-c") || b.hasAttribute("data-pl-came") || Boolean(t?.s && passes(t, tokens))
					if (stays !== b.hasAttribute("data-r-st")) {
						if (stays) b.setAttribute("data-r-st", "")
						else b.removeAttribute("data-r-st")
					}
				}
				root.setAttribute("data-r-pv", `${name}|${arg}`)
			} else root.removeAttribute("data-r-pv")
			const controls = root.querySelectorAll("[data-r-top] [data-pl-act]")
			for (let i = 0; i < controls.length; i++) {
				const on = tokens !== null && controls[i].getAttribute("data-pl-act") === name && controls[i].getAttribute("data-arg") === arg
				if (on !== controls[i].hasAttribute("data-r-on")) {
					if (on) controls[i].setAttribute("data-r-on", "")
					else controls[i].removeAttribute("data-r-on")
				}
			}
			spec.shown(root, ctx, tokens, name ?? "", arg)
		}
		again = (root) => {
			if (looked && seen) lookAt(root, seen, looked.name, looked.arg)
		}
		rested = (root, key) => {
			if (!seen || root.getAttribute("data-r-at") !== seen.c.k) return
			const t = key ? core.title(key) : undefined
			look(root, seen, t ?? null)
		}
		return {
			carry,
			adopt,
			fit,
			into,
			peek: look,
			stage: picture,
			act: (ctx, name, arg, _el, section) => {
				if (name === "z") {
					const z = zoomOf(ctx)
					const next = Math.max(0, Math.min(zooms().length - 1, z + Number(arg)))
					ctx.st.mem.z = next
					return next !== z
				}
				const done = spec.act(ctx, name, arg)
				if (done) {
					hush = `${name}|${arg}`
					looked = null
					if (section) lookAt(section, ctx, null, "")
				}
				return done
			},
			intent: (ctx, name, arg) => {
				const tokens = spec.will(ctx, name, arg)
				if (tokens?.length) want(ctx, tokens, around(ctx, tokens).length, Math.round(cells(zooms()[zoomOf(ctx)]).length * 1.2))
			},
			// A poster is pressed while a filter is on: the titles that pass it around that title are asked for now.
			near: (ctx, t) => {
				const tokens = spec.tokens(ctx)
				if (!tokens.length || !t.s || core.floor(t.k, nameOf(tokens)) !== undefined) return
				core.more(t.k, pageOf(nameOf(tokens), 0))
			},
			preview: (section, ctx, name, arg) => {
				if (name === null) {
					hush = ""
					looked = null
					lookAt(section, ctx, null, "")
				} else if (`${name}|${arg}` !== hush) {
					looked = { name, arg }
					lookAt(section, ctx, name, arg)
				}
			},
		}
	}
	return { words, word, emo, low, tok, passes, around, gaps, withOrWithout, make, when }
}
