// PROTOTYPE for "Prototype native-scroll carousels on title pages", seventh round. Throwaway code: not for production.
//
// The engine of the play forms (play1 to play10). One function with no outside references, because it runs in three
// places from the same source: on the server (the section's first picture), as the page's inline script (taps work
// before hydration), and from a lazy chunk (a page opened by a navigation inside the app).
//
// What it does differently from the earlier rounds' scripts: a step never waits for the server. The browser holds a
// pack per title (see server/prototype-play.server.ts) and draws the new stage from it in the same task as the tap.
// - The page title's pack loads when the section wakes: within 600 px of the viewport, or on first touch.
// - On idle, the packs of the first PREFETCH titles on the stage load, and the pack of a title being pressed or
//   hovered loads at once. At most SESSION_CAP packs per page visit.
// - A step onto a title whose pack isn't there yet shows the title in the middle at once, with calm placeholders
//   around it, and fills in when the pack arrives.
// - Nothing is ever "busy": a tap during a transition is a tap. Animations start after the new content is in place
//   and last 150 ms at most.
//
// The standing rule holds: posters are buttons, a step changes neither the URL nor the scroll position nor the
// section's height, and "Open" is its own link.
//
// The forms are in play-forms.ts. Each gets this engine's `core` and returns how to draw its stage.
import type { PlayMeta } from "~/ui/prototype-carousels/play-meta"

export type RawTitle = [string, string, string, string, number, string]
export interface RawPack {
	c: RawTitle
	n: RawTitle[]
}

/** A title as the engine holds it. `n` is the similarity to the center of the pack it came from. */
export interface PlayTitle {
	k: string
	t: string
	y: string
	p: string
	n: number
	s: number[] | null
	/** Per axis, the two halves of its level: kept once computed. */
	h?: Record<string, { plus: number; minus: number | null }>
}
export interface PlayAxis {
	id: string
	name: string
	low: string
	high: string
	lowWord: string
	highWord: string
	lowMost: string
	highMost: string
	plus: string[]
	top?: number
	minus: string[]
	highFrom: number
	lowFrom: number
	step?: number
	emoji: [string, string]
}
export interface PlayDirection {
	id: string
	axis: PlayAxis
	sign: 1 | -1
	slot: number
	label: string
	word: string
	emoji: string
}
export interface PlayPick {
	t: PlayTitle
	delta: number
	rank: number
}
export interface PlayEntry {
	k: string
	via: string
	// biome-ignore lint/suspicious/noExplicitAny: each form keeps its own small state here.
	ui: Record<string, any>
}
export interface PlayState {
	form: string
	root: string
	axes: string[]
	traits: string[]
	trail: PlayEntry[]
	/** What a form remembers for the whole walk. */
	// biome-ignore lint/suspicious/noExplicitAny: each form keeps its own small memory here.
	mem: Record<string, any>
}
export interface PlayCtx {
	st: PlayState
	e: PlayEntry
	/** The title you stand on. */
	c: PlayTitle
	/** Its neighborhood, nearest first, or null while the pack is on its way and nothing can stand in for it. */
	list: PlayTitle[] | null
	/**
	 * True while the neighborhood is a stand-in: the titles around the title you came from, ordered by how alike they
	 * are to this one. Every claim about a title is still computed from its own levels, but a direction that looks
	 * empty may not be, so nothing is said to end.
	 */
	soft: boolean
	/** The title you came from, and the page's title. */
	prev: PlayTitle | null
	root: PlayTitle
}
export interface PlayForm {
	hint: string
	stage: (ctx: PlayCtx) => string
	/** The line under the name, when the form has more to say than the default. */
	why?: (ctx: PlayCtx) => string | null
	/** A control of the form. Returns true when the stage has to be drawn again. */
	act?: (
		ctx: PlayCtx,
		name: string,
		arg: string,
		el: Element,
		section: Element,
	) => boolean
	/** After the stage is in the document: scroll positions, measurements. */
	after?: (section: Element, ctx: PlayCtx) => void
	/** Leaves the form's deeper state. Returns false when there was none. */
	leave?: (ctx: PlayCtx, section: Element) => boolean
	/** What a step carries over from the stage it leaves. */
	carry?: (ui: PlayEntry["ui"], button: Element) => PlayEntry["ui"]
	/** Before the first draw in the browser: what the form has to remember of the server's picture. */
	adopt?: (st: PlayState, stage: Element) => void
	/** False when the form moves its own picture on a step, and the tapped poster must not fly on top of that. */
	fly?: boolean
	/** A range input or a scrolled strip changed. */
	input?: (ctx: PlayCtx, el: Element, section: Element) => void
}
export interface PlayCore {
	M: PlayMeta
	esc: (value: unknown) => string
	val: (title: PlayTitle, key: string) => number
	axisOf: (id: string) => PlayAxis | undefined
	level: (axis: PlayAxis, title: PlayTitle) => number
	far: (
		axis: PlayAxis,
		sign: 1 | -1,
		center: PlayTitle,
		title: PlayTitle,
	) => number | null
	band: (axis: PlayAxis, delta: number) => number
	dirs: (st: PlayState) => PlayDirection[]
	opp: (id: string) => string
	ranks: (
		direction: PlayDirection,
		center: PlayTitle,
		list: PlayTitle[],
		sizes: number[],
		skip?: Record<string, unknown>,
	) => PlayPick[]
	diffs: (
		center: PlayTitle,
		title: PlayTitle,
		max: number,
	) => { k: string; d: number }[]
	shared: (center: PlayTitle, title: PlayTitle, max: number) => string[]
	own: (title: PlayTitle, count: number) => string[]
	sayDiff: (list: { k: string; d: number }[]) => string
	marks: (list: { k: string; d: number }[]) => string
	chip: (key: string, extra?: string, attrs?: string) => string
	poster: (
		title: PlayTitle | undefined,
		options?: {
			via?: string
			cls?: string
			style?: string
			attrs?: string
			inner?: string
			came?: boolean
			big?: boolean
		},
	) => string
	center: (ctx: PlayCtx, cls?: string, style?: string, attrs?: string) => string
	src: (path: string, big?: boolean) => string
	sim: (a: PlayTitle, b: PlayTitle) => number
	title: (key: string) => PlayTitle | undefined
	listOf: (key: string) => PlayTitle[] | null
	need: (key: string) => void
}

export function playEngine(
	M: PlayMeta,
	// biome-ignore lint/suspicious/noExplicitAny: the browser's window, or null on the server.
	win: any,
	forms: Record<string, (core: PlayCore) => PlayForm>,
) {
	const PREFETCH = 8
	const SESSION_CAP = 80
	const IDX: Record<string, number> = {}
	M.keys.forEach((key, i) => {
		IDX[key] = i
	})
	const G: {
		t: Record<string, PlayTitle>
		packs: Record<string, PlayTitle[]>
		soft: Record<string, PlayTitle[]>
		wait: Record<string, Promise<unknown>>
		asked: number
		nav: ((href: string) => void) | null
	} = { t: {}, packs: {}, soft: {}, wait: {}, asked: 0, nav: null }
	const ESC: Record<string, string> = {
		"&": "&amp;",
		"<": "&lt;",
		">": "&gt;",
		'"': "&quot;",
	}
	const esc = (value: unknown) =>
		String(value ?? "").replace(/[&<>"]/g, (ch) => ESC[ch])
	const cap = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)
	const mean = (values: number[]) =>
		values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : 0

	// --- Titles and packs ---------------------------------------------------------------------------------------
	const titleOf = (raw: RawTitle): PlayTitle => {
		const s: number[] = []
		for (let i = 0; i < raw[5].length; i++) {
			const code = raw[5].charCodeAt(i)
			s.push(code === 45 ? -1 : code === 97 ? 10 : code - 48)
		}
		const title = {
			k: raw[0],
			t: raw[1],
			y: raw[2],
			p: raw[3],
			n: raw[4] / 1000,
			s,
		}
		const known = G.t[title.k]
		if (!known?.s) G.t[title.k] = title
		return title
	}
	const take = (raw: RawPack) => {
		const center = titleOf(raw.c)
		G.t[center.k] = center
		G.packs[center.k] = raw.n.map(titleOf)
	}
	const val = (title: PlayTitle, key: string) => {
		const value = title.s ? title.s[IDX[key]] : 0
		return value === undefined || value < 0 ? 0 : value
	}

	// --- The dive model's levels and its test, in the browser (ui/prototype-carousels/dive-model.ts) -------------
	const AX: Record<string, PlayAxis> = {}
	for (const axis of M.axes) AX[axis.id] = axis
	const axisOf = (id: string): PlayAxis | undefined => {
		if (AX[id]) return AX[id]
		const key = id.slice(0, 2) === "t." ? id.slice(2) : ""
		const trait = M.traits[key]
		if (!trait) return undefined
		AX[id] = {
			id,
			name: cap(trait.n),
			low: `Less ${trait.n}`,
			high: `More ${trait.n}`,
			lowWord: `less ${trait.n}`,
			highWord: `more ${trait.n}`,
			lowMost: `low on ${trait.n}`,
			highMost: `rich in ${trait.n}`,
			plus: [key],
			minus: [],
			highFrom: 5,
			lowFrom: 4,
			step: 1.5,
			emoji: [trait.e, trait.e],
		}
		return AX[id]
	}
	const halves = (axis: PlayAxis, title: PlayTitle) => {
		if (!title.h) title.h = {}
		const memo = title.h
		if (memo[axis.id] && title.s) return memo[axis.id]
		const plus = axis.plus.map((key) => val(title, key)).sort((a, b) => b - a)
		const found = {
			plus: mean(plus.slice(0, axis.top ?? plus.length)),
			minus: axis.minus.length
				? mean(axis.minus.map((key) => val(title, key)))
				: null,
		}
		if (title.s) memo[axis.id] = found
		return found
	}
	const level = (axis: PlayAxis, title: PlayTitle) => {
		const h = halves(axis, title)
		return h.minus === null ? h.plus : (h.plus + 10 - h.minus) / 2
	}
	const far = (
		axis: PlayAxis,
		sign: 1 | -1,
		center: PlayTitle,
		title: PlayTitle,
	) => {
		const delta = (level(axis, title) - level(axis, center)) * sign
		if (delta < (axis.step ?? M.minStep)) return null
		const a = halves(axis, center)
		const b = halves(axis, title)
		if ((b.plus - a.plus) * sign < 0) return null
		if (a.minus !== null && b.minus !== null && (a.minus - b.minus) * sign < -1)
			return null
		if (sign > 0 && level(axis, title) < axis.highFrom) return null
		if (sign < 0 && level(axis, center) < axis.lowFrom) return null
		return delta
	}
	const band = (axis: PlayAxis, delta: number) => {
		const step = axis.step ?? M.minStep
		return delta < 2 * step ? 0 : delta < 4 * step ? 1 : 2
	}
	const opp = (id: string) =>
		id.slice(0, -1) + (id.slice(-1) === "+" ? "-" : "+")
	const dirs = (st: PlayState) => {
		const out: PlayDirection[] = []
		st.axes.forEach((id, slot) => {
			const axis = axisOf(id)
			if (!axis) return
			out.push({
				id: `${id}-`,
				axis,
				sign: -1,
				slot,
				label: axis.low,
				word: axis.lowWord,
				emoji: axis.emoji[0],
			})
			out.push({
				id: `${id}+`,
				axis,
				sign: 1,
				slot,
				label: axis.high,
				word: axis.highWord,
				emoji: axis.emoji[1],
			})
		})
		return out
	}
	/** One direction as ranks: per band of the difference in level, the most similar titles, nearest band first. */
	const ranks = (
		direction: PlayDirection,
		center: PlayTitle,
		list: PlayTitle[],
		sizes: number[],
		skip: Record<string, unknown> = {},
	) => {
		const bands: PlayPick[][] = sizes.map(() => [])
		for (const t of list) {
			if (skip[t.k] || t.k === center.k) continue
			const delta = far(direction.axis, direction.sign, center, t)
			if (delta === null) continue
			const rank = Math.min(sizes.length - 1, band(direction.axis, delta))
			bands[rank].push({ t, delta, rank })
		}
		const out: PlayPick[] = []
		bands.forEach((picks, rank) => {
			out.push(
				...picks
					.sort((a, b) => b.t.n - a.t.n)
					.slice(0, sizes[rank])
					.sort((a, b) => a.delta - b.delta),
			)
		})
		return out
	}
	/** How the walk's axes are chosen for the page's title: tone, and the two with the most to see both ways. */
	const startAxes = (center: PlayTitle, list: PlayTitle[]) => {
		const near = list.slice(0, 64)
		const taken = [M.axes[0]]
		const deltasOf = (axis: PlayAxis) => {
			const base = level(axis, center)
			const d = near.map((t) => level(axis, t) - base)
			const m = mean(d)
			return { d, m, sd: Math.sqrt(mean(d.map((v) => (v - m) ** 2))) }
		}
		while (taken.length < 3) {
			const against = taken.map(deltasOf)
			let best: PlayAxis | undefined
			let bestValue = -1
			for (const axis of M.axes) {
				if (taken.includes(axis)) continue
				const count = (sign: 1 | -1) =>
					near.filter((t) => far(axis, sign, center, t) !== null).length
				const up = count(1)
				const down = count(-1)
				const own = deltasOf(axis)
				let same = 0
				for (const other of against) {
					const correlation =
						own.sd && other.sd
							? mean(own.d.map((v, i) => (v - own.m) * (other.d[i] - other.m))) /
								(own.sd * other.sd)
							: 0
					same = Math.max(same, Math.abs(correlation))
				}
				const value =
					(2 * Math.min(up, down, 10) + 0.5 * Math.min(up + down, 20)) *
					(1 - 0.5 * same) *
					(level(axis, center) >= 6.5 ? 1.25 : 1)
				if (value > bestValue) {
					best = axis
					bestValue = value
				}
			}
			if (!best) break
			taken.push(best)
		}
		return taken.map((axis) => axis.id)
	}

	// --- Traits ---------------------------------------------------------------------------------------------------
	/** How a title differs from the center: a trait counts from two points, when the higher score is at least 6. */
	const diffs = (center: PlayTitle, title: PlayTitle, max: number) => {
		if (!center.s || !title.s) return []
		const found: { k: string; d: number; v: number }[] = []
		for (const key of M.keys) {
			if (!M.traits[key].on) continue
			const a = val(center, key)
			const b = val(title, key)
			const d = b - a
			if (Math.abs(d) < 2 || Math.max(a, b) < 6) continue
			found.push({
				k: key,
				d,
				v: Math.abs(d) + 0.4 * (Math.max(a, b) - 6) + (d > 0 ? 0.3 : 0),
			})
		}
		return found.sort((a, b) => b.v - a.v).slice(0, max)
	}
	/** The traits two titles are both strong on. */
	const shared = (center: PlayTitle, title: PlayTitle, max: number) => {
		if (!center.s || !title.s) return []
		return M.keys
			.filter(
				(key) =>
					M.traits[key].on && val(center, key) >= 7 && val(title, key) >= 7,
			)
			.sort(
				(a, b) =>
					Math.min(val(center, b), val(title, b)) -
					Math.min(val(center, a), val(title, a)),
			)
			.slice(0, max)
	}
	/** A title's own traits, strongest first. */
	const own = (title: PlayTitle, count: number) =>
		M.keys
			.filter((key) => M.traits[key].on && val(title, key) >= 6)
			.sort((a, b) => val(title, b) - val(title, a))
			.slice(0, count)
	const sayDiff = (list: { k: string; d: number }[]) =>
		list
			.map(
				({ k, d }) =>
					`${d > 0 ? "more" : "less"} ${M.traits[k].e} ${M.traits[k].n}`,
			)
			.join(", ")
	const marks = (list: { k: string; d: number }[]) =>
		list
			.map(
				({ k, d }) =>
					`<i class="pl-mk" data-s="${d > 0 ? "+" : "-"}" style="--c:${M.traits[k].c}" title="${esc(
						`${d > 0 ? "More" : "Less"} ${M.traits[k].n}`,
					)}">${M.traits[k].e}<b>${d > 0 ? "▲" : "▼"}</b></i>`,
			)
			.join("")
	const chip = (key: string, extra = "", attrs = "") =>
		`<span class="pl-tr" style="--c:${M.traits[key].c}"${attrs}><i>${M.traits[key].e}</i>${esc(M.traits[key].l)}${extra}</span>`
	/** How alike two titles are, from their levels alone: for the forms that compare titles of different packs. */
	const sim = (a: PlayTitle, b: PlayTitle) => {
		if (!a.s || !b.s) return 0
		let dot = 0
		let aa = 0
		let bb = 0
		for (let i = 0; i < a.s.length; i++) {
			const x = Math.max(0, a.s[i])
			const y = Math.max(0, b.s[i])
			dot += x * y
			aa += x * x
			bb += y * y
		}
		return aa && bb ? dot / Math.sqrt(aa * bb) : 0
	}

	// --- Markup ---------------------------------------------------------------------------------------------------
	const src = (path: string, big = false) =>
		`${M.image}/${big ? "w342" : "w154"}/${path}`
	const hrefOf = (title: PlayTitle) =>
		`/${title.k.charAt(0) === "m" ? "movie" : "show"}/${title.k.slice(1)}-${title.t
			.toLowerCase()
			.replace(/[^\w- ]+/g, "")
			.replace(/ +/g, "-")}`
	/** A poster you can step onto. Never a link. Without a title: a calm empty place. */
	const lazy = win ? "" : ' loading="lazy"'
	const poster: PlayCore["poster"] = (title, options = {}) => {
		const style = options.style ? ` style="${options.style}"` : ""
		if (!title)
			return `<span class="pl-ph ${options.cls ?? ""}"${style} aria-hidden="true"></span>`
		return `<button type="button" class="pl-p ${options.cls ?? ""}"${style} data-pl-step="${title.k}"${
			options.via ? ` data-via="${esc(options.via)}"` : ""
		} data-t="${esc(title.t)}" data-y="${esc(title.y)}"${
			options.came ? ' data-pl-came=""' : ""
		}${options.attrs ?? ""}><img alt="${esc(
			options.came ? `Back to ${title.t}` : title.t,
		)}"${lazy} decoding="async" src="${esc(src(title.p, options.big))}">${options.came ? '<span class="pl-cm" aria-hidden="true">← back</span>' : ""}${options.inner ?? ""}</button>`
	}
	const center: PlayCore["center"] = (ctx, cls = "", style = "", attrs = "") =>
		`<span class="pl-c ${cls}"${style ? ` style="${style}"` : ""}${attrs} data-pl-center=""><img alt="${esc(
			`${ctx.c.t} (${ctx.c.y})`,
		)}" decoding="async" src="${esc(src(ctx.c.p))}"></span>`

	const core: PlayCore = {
		M,
		esc,
		val,
		axisOf,
		level,
		far,
		band,
		dirs,
		opp,
		ranks,
		diffs,
		shared,
		own,
		sayDiff,
		marks,
		chip,
		poster,
		center,
		src,
		sim,
		title: (key) => G.t[key],
		listOf: (key) => G.packs[key] ?? null,
		need: (key) => {
			if (win) ask(key, true)
		},
	}
	const built: Record<string, PlayForm> = {}
	const formOf = (name: string): PlayForm | undefined => {
		if (!built[name] && forms[name]) built[name] = forms[name](core)
		return built[name]
	}

	/** A stand-in for a pack that is on its way: what is known around the title you came from, seen from here. */
	const softOf = (key: string, from: string) => {
		if (G.soft[key]) return G.soft[key]
		const c = G.t[key]
		const source = G.packs[from] ?? G.soft[from]
		if (!source || !c?.s) return null
		const origin = G.t[from]
		G.soft[key] = source
			.concat(origin?.s ? [origin] : [])
			.filter((t) => t.k !== key)
			.map((t) => ({ ...t, n: sim(c, t) }))
			.sort((a, b) => b.n - a.n)
		return G.soft[key]
	}
	const ctxOf = (st: PlayState): PlayCtx => {
		const e = st.trail[st.trail.length - 1]
		const before = st.trail[st.trail.length - 2]
		const real = G.packs[e.k] ?? null
		const list = real ?? (before ? softOf(e.k, before.k) : null)
		return {
			st,
			e,
			c: G.t[e.k],
			list,
			soft: Boolean(list) && !real,
			prev: before ? (G.t[before.k] ?? null) : null,
			root: G.t[st.root],
		}
	}
	const barOf = (ctx: PlayCtx, form: PlayForm) => {
		const { st } = ctx
		if (st.trail.length < 2)
			return `<p class="pl-hint" data-pl-hint="">${esc(form.hint)}</p>`
		const crumbs = st.trail
			.map((entry, i) => {
				const title = G.t[entry.k]
				return i === st.trail.length - 1
					? `<li><span aria-current="step">${esc(title.t)}</span></li>`
					: `<li><button type="button" data-pl-to="${i}" aria-label="${esc(`Back to ${title.t}`)}">${esc(title.t)}</button></li>`
			})
			.join("")
		return `<button type="button" class="pl-back" data-pl-back=""><span aria-hidden="true">←</span> Back</button><ol class="pl-crumbs" data-pl-crumbs="" aria-label="Where you walked">${crumbs}</ol>`
	}
	const whyOf = (ctx: PlayCtx, form: PlayForm) => {
		const own = form.why?.(ctx)
		if (own) return own
		if (!ctx.prev) return esc(form.hint)
		if (!ctx.c.s || !ctx.prev.s) return `Next to ${esc(ctx.prev.t)}.`
		const via = ctx.e.via ? dirOf(ctx.st, ctx.e.via) : undefined
		const told = diffs(ctx.prev, ctx.c, via ? 2 : 3)
		const head = via
			? `${cap(via.word)} than ${esc(ctx.prev.t)}`
			: `Next to ${esc(ctx.prev.t)}`
		return told.length
			? `${head}${via ? ", and " : ": "}${sayDiff(told)}.`
			: `${head}${via ? "." : ": much the same mix."}`
	}
	const dirOf = (st: PlayState, id: string) =>
		dirs(st).find((direction) => direction.id === id)
	const cardOf = (ctx: PlayCtx, form: PlayForm) =>
		`<p class="pl-here"><b data-pl-here="">${esc(ctx.c.t)}</b><span class="pl-meta">${esc(ctx.c.y)}${
			ctx.c.k.charAt(0) === "s" ? " · Show" : ""
		}</span>${
			ctx.c.k === ctx.st.root
				? '<span class="pl-this">this page</span>'
				: `<a class="pl-open" data-pl-nav="" data-pl-open="" href="${esc(hrefOf(ctx.c))}">Open<span class="pl-sr"> ${esc(ctx.c.t)}</span></a>`
		}</p><p class="pl-why" data-pl-why="" aria-live="polite">${whyOf(ctx, form)}</p>`
	/** The fingerprint of the title you stand on: its strongest traits with their levels, and how they moved. */
	const printOf = (ctx: PlayCtx) => {
		if (!ctx.c.s) return ""
		const keys = own(ctx.c, 8)
		return keys
			.map((key) => {
				const trait = M.traits[key]
				const now = val(ctx.c, key)
				const was = ctx.root.s && ctx.c.k !== ctx.root.k ? val(ctx.root, key) : now
				const moved = now - was
				return `<span class="pl-fi" style="--c:${trait.c};--v:${now}"><i>${trait.e}</i><b>${esc(trait.l)}</b><s><u></u></s><em>${now}${
					Math.abs(moved) >= 2 ? `<small>${moved > 0 ? "▲" : "▼"}</small>` : ""
				}</em></span>`
			})
			.join("")
	}
	const parts = (st: PlayState) => {
		const ctx = ctxOf(st)
		const form = formOf(st.form) as PlayForm
		return {
			ctx,
			form,
			bar: barOf(ctx, form),
			stage: form.stage(ctx),
			card: cardOf(ctx, form),
			print: printOf(ctx),
		}
	}

	/** The section's inner markup, for the server and for a section that starts in the browser. */
	const section = (input: {
		form: string
		root: string
		title: string
		pack: RawPack | null
		links: { href: string; text: string }[]
	}) => {
		if (input.pack) take(input.pack)
		const rootTitle = G.t[input.root]
		const head = `<h2 class="pl-h">Titles like ${esc(input.title)}</h2>`
		const links = input.links.length
			? `<p class="pl-more"><span>Open a page:</span>${input.links
					.map(
						(link) =>
							`<a data-pl-nav="" href="${esc(link.href)}">${esc(link.text)}</a>`,
					)
					.join("")}</p>`
			: ""
		if (!rootTitle || !formOf(input.form))
			return `${head}<div class="pl-bar" data-pl-bar=""></div><div class="pl-body"><div class="pl-stage pl-${esc(
				input.form,
			)}" data-pl-stage="" data-pl-cold=""></div><div class="pl-side"><div class="pl-card" data-pl-card=""></div><div class="pl-fp" data-pl-fp=""></div></div></div>${links}`
		const list = G.packs[input.root] ?? []
		const st: PlayState = {
			form: input.form,
			root: input.root,
			axes: startAxes(rootTitle, list),
			traits: own(rootTitle, 8),
			trail: [{ k: input.root, via: "", ui: {} }],
			mem: {},
		}
		const p = parts(st)
		return `${head}<div class="pl-bar" data-pl-bar="" data-axes="${st.axes.join(",")}" data-traits="${st.traits.join(
			",",
		)}" data-y="${esc(rootTitle.y)}" data-p="${esc(rootTitle.p)}">${p.bar}</div><div class="pl-body"><div class="pl-stage pl-${esc(
			input.form,
		)}" data-pl-stage="" data-pl-at="${input.root}">${p.stage}</div><div class="pl-side"><div class="pl-card" data-pl-card="">${p.card}</div><div class="pl-fp" data-pl-fp="">${p.print}</div></div></div>${links}`
	}

	if (!win) return { section }

	// --- The browser ----------------------------------------------------------------------------------------------
	const doc = win.document as Document
	const still = () =>
		win.matchMedia?.("(prefers-reduced-motion: reduce)").matches
	const q = (root: Element, selector: string) => root.querySelector(selector)
	const sec = (el: Element | null) => (el?.closest?.("[data-play]") ?? null) as
		| (HTMLElement & { __pl?: PlayState; __awake?: boolean })
		| null
	const stateOf = (s: HTMLElement & { __pl?: PlayState }) => {
		const root = s.getAttribute("data-pl-root") ?? ""
		if (!s.__pl || s.__pl.root !== root) {
			// The same element with another title: a navigation inside the app. It starts over, awake if it was.
			const own = s as HTMLElement & { __awake?: boolean; __own?: boolean }
			if (s.__pl && own.__awake) win.setTimeout(() => wake(own), 0)
			own.__awake = false
			own.__own = false
			const bar = q(s, "[data-pl-bar]")
			if (!G.t[root])
				G.t[root] = {
					k: root,
					t: s.getAttribute("data-pl-title") ?? "",
					y: bar?.getAttribute("data-y") ?? "",
					p: bar?.getAttribute("data-p") ?? "",
					n: 1,
					s: null,
				}
			s.__pl = {
				form: s.getAttribute("data-play") ?? "",
				root,
				axes: (bar?.getAttribute("data-axes") ?? "").split(",").filter(Boolean),
				traits: (bar?.getAttribute("data-traits") ?? "")
					.split(",")
					.filter(Boolean),
				trail: [{ k: root, via: "", ui: {} }],
				mem: {},
			}
		}
		return s.__pl
	}
	function ask(key: string, urgent: boolean): Promise<unknown> {
		if (G.packs[key]) return Promise.resolve()
		if (!G.wait[key]) {
			if (!urgent && G.asked >= SESSION_CAP) return Promise.resolve()
			G.asked++
			G.wait[key] = win
				.fetch(`/api/prototype-play?key=${key}`, {
					priority: urgent ? "high" : "low",
				})
				.then((response: Response) => {
					if (!response.ok) throw new Error(String(response.status))
					return response.json()
				})
				.then((raw: RawPack) => {
					take(raw)
					arrived(key)
				})
				.catch(() => {
					delete G.wait[key]
				})
		}
		return G.wait[key]
	}
	// For measuring and for seeing a cold step: `?plcold=1` switches every prefetch off.
	const noAhead = () =>
		Boolean(win.__noAhead) || /[?&]plcold=1/.test(win.location.search)
	const idle = (run: () => void) =>
		win.requestIdleCallback
			? win.requestIdleCallback(run, { timeout: 600 })
			: win.setTimeout(run, 120)
	/** One hop ahead: the packs of the first titles on the stage. */
	const ahead = (s: HTMLElement) => {
		if (noAhead()) return
		idle(() => {
			const seen: Record<string, boolean> = {}
			let asked = 0
			const steps = s.querySelectorAll("[data-pl-stage] [data-pl-step]")
			for (let i = 0; i < steps.length && asked < PREFETCH; i++) {
				const key = steps[i].getAttribute("data-pl-step") ?? ""
				if (seen[key] || steps[i].hasAttribute("data-pl-far")) continue
				seen[key] = true
				asked++
				if (!G.packs[key]) ask(key, false)
			}
		})
	}
	let beat = 0
	let keyboard = false
	/** Every write first, then whatever has to be read: one layout per step. */
	const adopt = (s: HTMLElement & { __pl?: PlayState; __own?: boolean }) => {
		if (s.__own) return
		s.__own = true
		const stage = q(s, "[data-pl-stage]")
		if (stage?.firstChild) formOf(stateOf(s).form)?.adopt?.(stateOf(s), stage)
	}
	const draw = (
		s: HTMLElement & { __pl?: PlayState },
		kind = "",
		from: DOMRect | null = null,
	) => {
		const st = stateOf(s)
		if (!formOf(st.form) || !G.t[st.trail[st.trail.length - 1].k]) return null
		adopt(s)
		// Someone walking with the keyboard keeps their place: the section takes the focus that the redrawn stage loses.
		// A tap with a finger or the mouse has no need for it.
		const had =
			keyboard && s.contains(doc.activeElement) && doc.activeElement !== s
		const t0 = win.performance.now()
		const p = parts(st)
		const t1 = win.performance.now()
		const stage = q(s, "[data-pl-stage]") as HTMLElement
		stage.innerHTML = p.stage
		stage.setAttribute("data-pl-at", p.ctx.c.k)
		if (p.ctx.list) stage.removeAttribute("data-pl-cold")
		else stage.setAttribute("data-pl-cold", "")
		if (p.ctx.soft) stage.setAttribute("data-pl-soft", "")
		else stage.removeAttribute("data-pl-soft")
		if (kind && !still()) stage.setAttribute("data-pl-in", `${kind}${++beat % 2}`)
		else stage.removeAttribute("data-pl-in")
		const bar = q(s, "[data-pl-bar]")
		if (bar) bar.innerHTML = p.bar
		const card = q(s, "[data-pl-card]")
		if (card) card.innerHTML = p.card
		const print = q(s, "[data-pl-fp]")
		if (print && p.print) print.innerHTML = p.print
		const t2 = win.performance.now()
		if (had) s.focus({ preventScroll: true })
		const crumbs = bar && q(bar, "[data-pl-crumbs]")
		if (crumbs) crumbs.scrollLeft = crumbs.scrollWidth
		p.form.after?.(s, p.ctx)
		// The tapped poster becomes the middle one: it starts where the tap was and settles within 150 ms.
		const target = from && !still() ? (q(stage, "[data-pl-center]") as HTMLElement | null) : null
		if (from && target?.animate) {
			const to = target.getBoundingClientRect()
			if (to.width && from.width)
				target.animate(
					[
						{
							transformOrigin: "0 0",
							transform: `translate(${from.left - to.left}px,${from.top - to.top}px) scale(${from.width / to.width})`,
						},
						{ transformOrigin: "0 0", transform: "none" },
					],
					{ duration: 150, easing: "cubic-bezier(.2,.8,.3,1)" },
				)
		}
		// How long the three parts of a draw took (model and markup, into the document, layout): for the checks.
		if (win.__plT) win.__plT.push([t1 - t0, t2 - t1, win.performance.now() - t2])
		return p
	}
	function arrived(key: string) {
		const all = doc.querySelectorAll("[data-play]")
		for (let i = 0; i < all.length; i++) {
			const s = all[i] as HTMLElement & { __pl?: PlayState }
			const st = stateOf(s)
			const here = st.trail[st.trail.length - 1].k
			const stage = q(s, "[data-pl-stage]")
			const cold = stage?.hasAttribute("data-pl-cold")
			const soft = stage?.hasAttribute("data-pl-soft")
			if (here === key && soft && stage) {
				// The stage shows a stand-in. What it shows stays where it is, so that nothing moves under a finger:
				// those titles go first in the pack, and the pack fills the gaps and everything drawn later.
				const shown: PlayTitle[] = []
				const known: Record<string, boolean> = {}
				const drawn = stage.querySelectorAll("[data-pl-step]")
				for (let n = 0; n < drawn.length; n++) {
					const t = G.t[drawn[n].getAttribute("data-pl-step") ?? ""]
					if (!t?.s || known[t.k] || t.k === key) continue
					known[t.k] = true
					shown.push({ ...t, n: 1.01 - shown.length * 0.0001 })
				}
				G.packs[key] = shown.concat(G.packs[key].filter((t) => !known[t.k]))
			}
			if (here === key && (cold || soft)) {
				if (!st.axes.length && G.packs[st.root])
					st.axes = startAxes(G.t[st.root], G.packs[st.root])
				if (!st.traits.length) st.traits = own(G.t[st.root], 8)
				// Placeholders fill in with a short fade. A stand-in is corrected without one.
				draw(s, cold ? "fill" : "")
				ahead(s)
			} else if (here === key) ahead(s)
			// A form that shows a second title's neighborhood asked for this pack.
			else if (q(s, `[data-pl-wants="${key}"]`)) draw(s)
		}
	}
	function wake(s: HTMLElement & { __awake?: boolean; __pl?: PlayState }) {
		if (s.__awake) return
		s.__awake = true
		const st = stateOf(s)
		ask(st.root, true).then(() => {
			const stage = q(s, "[data-pl-stage]")
			// A section that started without a picture (its pack missed the page's render) draws itself now.
			if (stage && !stage.firstChild && st.trail.length === 1) {
				stage.setAttribute("data-pl-cold", "")
				arrived(st.root)
			}
			if (st.trail.length === 1 && G.t[st.root])
				formOf(st.form)?.after?.(s, ctxOf(st))
			ahead(s)
		})
	}
	const back = (s: HTMLElement, index: number) => {
		const st = stateOf(s)
		if (index < 0 || index >= st.trail.length - 1) return
		st.trail.length = index + 1
		draw(s, "step")
		ahead(s)
	}
	const step = (s: HTMLElement, button: Element) => {
		const st = stateOf(s)
		if (button.hasAttribute("data-pl-came")) {
			back(s, st.trail.length - 2)
			return
		}
		const key = button.getAttribute("data-pl-step") ?? ""
		if (!G.t[key])
			G.t[key] = {
				k: key,
				t: button.getAttribute("data-t") ?? "",
				y: button.getAttribute("data-y") ?? "",
				p: (q(button, "img")?.getAttribute("src") ?? "").replace(
					/^.*\/w\d+\//,
					"",
				),
				n: 0,
				s: null,
			}
		const form = formOf(st.form)
		const here = st.trail[st.trail.length - 1]
		adopt(s)
		const from = button.getBoundingClientRect()
		st.trail.push({
			k: key,
			via: button.getAttribute("data-via") ?? "",
			ui: form?.carry ? form.carry(here.ui, button) : {},
		})
		draw(s, "step", form?.fly === false ? null : from)
		if (G.packs[key]) ahead(s)
		else ask(key, true)
	}
	const hit = (event: Event, selector: string) => {
		const target = event.target as Element | null
		return target?.closest ? target.closest(selector) : null
	}
	const say = (s: Element, text: string | null) => {
		const why = q(s, "[data-pl-why]") as (HTMLElement & { __d?: string | null }) | null
		if (!why) return
		if (text === null) {
			if (why.__d != null) {
				why.innerHTML = why.__d
				why.__d = null
			}
			return
		}
		if (why.__d == null) why.__d = why.innerHTML
		why.textContent = text
	}
	// A tap on one of the section's own controls is this script's alone: it is handled in the capture phase at the
	// window and stopped there, so that no other listener of the page (the app's root, analytics) runs before the new
	// stage is painted. `?plshare=1` leaves the events alone, for comparing.
	const OWN = "[data-pl-step],[data-pl-act],[data-pl-to],[data-pl-back]"
	const share = /[?&]plshare=1/.test(win.location.search)
	const mine = (event: Event) => {
		if (!share && hit(event, OWN) && sec(event.target as Element))
			event.stopImmediatePropagation()
	}
	for (const type of ["pointerup", "mousedown", "mouseup", "touchend"])
		win.addEventListener(type, mine, { capture: true, passive: true })
	win.addEventListener("click", (event: MouseEvent) => {
		const s = sec(event.target as Element)
		if (!s) return
		const link = hit(event, "a[data-pl-nav]")
		if (link) {
			if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button)
				return
			if (G.nav) {
				event.preventDefault()
				G.nav(link.getAttribute("href") ?? "")
			}
			return
		}
		mine(event)
		keyboard = event.detail === 0
		wake(s)
		const st = stateOf(s)
		const form = formOf(st.form)
		const to = hit(event, "[data-pl-to]")
		if (to) {
			back(s, Number(to.getAttribute("data-pl-to")))
			return
		}
		if (hit(event, "[data-pl-back]")) {
			if (!form?.leave?.(ctxOf(st), s)) back(s, st.trail.length - 2)
			return
		}
		const control = hit(event, "[data-pl-act]")
		if (control && form?.act) {
			adopt(s)
			const again = form.act(
				ctxOf(st),
				control.getAttribute("data-pl-act") ?? "",
				control.getAttribute("data-arg") ?? "",
				control,
				s,
			)
			if (again) {
				draw(s)
				ahead(s)
			}
			return
		}
		const button = hit(event, "[data-pl-step]")
		if (button) {
			// For the checks: when the tap happened, by the browser's clock.
			if (win.__plClicks) win.__plClicks.push(event.timeStamp)
			step(s, button)
		}
	}, true)
	const changed = (event: Event) => {
		const el = hit(event, "[data-pl-input]")
		const s = sec(el)
		if (!s || !el) return
		const st = stateOf(s)
		adopt(s)
		formOf(st.form)?.input?.(ctxOf(st), el, s)
	}
	doc.addEventListener("input", changed)
	doc.addEventListener("scroll", changed, true)
	/** A poster being pressed or pointed at: its pack is wanted now. */
	const intent = (event: Event) => {
		mine(event)
		const button = hit(event, "[data-pl-step]")
		const s = sec(button)
		if (!s || !button) {
			const any = sec(event.target as Element)
			if (any) wake(any)
			return
		}
		wake(s)
		if (!button.hasAttribute("data-pl-came") && !noAhead())
			ask(button.getAttribute("data-pl-step") ?? "", true)
	}
	win.addEventListener("pointerdown", intent, true)
	win.addEventListener("touchstart", intent, { capture: true, passive: true })
	const over = (event: Event) => {
		const button = hit(event, "[data-pl-step]")
		const s = sec(button)
		if (!s || !button) return
		intent(event)
		const st = stateOf(s)
		const c = G.t[st.trail[st.trail.length - 1].k]
		const t = G.t[button.getAttribute("data-pl-step") ?? ""]
		const name = `${button.getAttribute("data-t")} (${button.getAttribute("data-y")})`
		if (button.hasAttribute("data-pl-came")) say(s, `${name}: where you came from.`)
		else if (t?.s && c?.s) {
			const told = diffs(c, t, 3)
			say(
				s,
				told.length
					? `${name}: ${sayDiff(told)}.`
					: `${name}: much the same mix as ${c.t}.`,
			)
		} else say(s, name)
	}
	const out = (event: Event) => {
		const button = hit(event, "[data-pl-step]")
		const s = sec(button)
		const related = (event as MouseEvent).relatedTarget as Node | null
		if (!s || !button || (related && button.contains(related))) return
		say(s, null)
	}
	doc.addEventListener("mouseover", over)
	doc.addEventListener("mouseout", out)
	doc.addEventListener("focusin", (event: Event) => {
		const button = hit(event, "[data-pl-step]")
		if (button?.matches(":focus-visible")) over(event)
	})
	doc.addEventListener("focusout", out)

	const boot = () => {
		const all = doc.querySelectorAll("[data-play]")
		for (let i = 0; i < all.length; i++) {
			const s = all[i] as HTMLElement & { __awake?: boolean; __seen?: boolean }
			stateOf(s)
			if (s.__seen) continue
			s.__seen = true
			if (win.IntersectionObserver) {
				const watch = new win.IntersectionObserver(
					(entries: IntersectionObserverEntry[]) => {
						if (!entries.some((entry) => entry.isIntersecting)) return
						watch.disconnect()
						wake(s)
					},
					{ rootMargin: "600px 0px" },
				)
				watch.observe(s)
			} else wake(s)
		}
	}
	win.__gwPlay = Object.assign(G, { boot, section, take })
	boot()
	return { section }
}
