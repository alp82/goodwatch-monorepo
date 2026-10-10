// The engine of the related map. It runs in three places from the same source: on the server (the section's first
// picture), as the page's inline script (taps work before hydration), and from a lazy chunk (a page opened by a
// navigation inside the app).
//
// A step never waits for the server. The browser holds a pack per title (see server/related-map.server.ts) and draws
// the new picture from it in the same task as the tap.
// - The page title's pack loads when the section wakes: within 600 px of the viewport, or on first touch.
// - Once a person uses the page, the packs of the first PREFETCH titles on the map load on idle, and the pack of a
//   title being pressed or pointed at loads at once. At most SESSION_CAP packs per page visit are asked for ahead.
// - A step onto a title whose pack isn't there yet shows the title in the middle at once, with what is known around
//   the title you came from or with calm placeholders, and fills in when the pack arrives.
// - A pack request that fails is asked for again for as long as someone stands on that title.
// - Nothing is ever "busy": a tap during a transition is a tap.
//
// The standing rule: posters are buttons, a step changes neither the URL nor the scroll position nor the section's
// height, and "Open" is its own link.
//
// The form (trail.ts) gets this engine's `core` and returns how to draw the picture.
import type { MapMeta } from "./traits"

/** A title in a pack: key ("m603", "s1396"), title, year, poster path, similarity in thousandths, level string. */
export type RawTitle = [string, string, string, string, number, string]
export interface RawPack {
	c: RawTitle
	n: RawTitle[]
	/** Per filter, the similarity down to which the titles are all there. 0: there are no more. */
	fl?: Record<string, number>
}

/** A title as the engine holds it. `n` is the similarity to the center of the pack it came from. */
export interface MapTitle {
	k: string
	t: string
	y: string
	p: string
	n: number
	s: number[] | null
}
export interface MapEntry {
	k: string
	// biome-ignore lint/suspicious/noExplicitAny: the form keeps its own small state here.
	ui: Record<string, any>
}
export interface MapState {
	root: string
	trail: MapEntry[]
	/** What the form remembers for the whole walk. */
	// biome-ignore lint/suspicious/noExplicitAny: the form keeps its own small memory here.
	mem: Record<string, any>
}
export interface MapCtx {
	st: MapState
	e: MapEntry
	/** The title you stand on. */
	c: MapTitle
	/** Its neighborhood, nearest first, or null while the pack is on its way and nothing can stand in for it. */
	list: MapTitle[] | null
	/**
	 * True while the neighborhood is a stand-in: the titles around the title you came from, ordered by how alike they
	 * are to this one. Every claim about a title is still computed from its own levels, but a filter that looks empty
	 * may not be, so nothing is said to end.
	 */
	soft: boolean
	/** The title you came from, and the page's title. */
	prev: MapTitle | null
	root: MapTitle
}
export interface MapForm {
	stage: (ctx: MapCtx) => string
	/** A control of the form. Returns true when the picture has to be drawn again. */
	act: (
		ctx: MapCtx,
		name: string,
		arg: string,
		el: Element,
		section: Element,
	) => boolean
	/** What a step carries over from the picture it leaves. */
	carry: (ui: MapEntry["ui"], button: Element) => MapEntry["ui"]
	/** Before the first draw in the browser: what the form has to remember of the server's picture. */
	adopt: (st: MapState, stage: Element) => void
	/** Puts a new picture into the stage itself, keeping what stays. False: the engine replaces it. */
	into: (stage: Element, ctx: MapCtx) => boolean
	/** The stage's size is known or changed. True when the picture has to be drawn again for it. */
	fit: (section: Element, ctx: MapCtx) => boolean
	/** A poster is pointed at, focused, or held with a finger (`title`), or no longer (null). */
	peek: (section: Element, ctx: MapCtx, title: MapTitle | null) => void
	/** A control is being pressed or pointed at: what it would need can be asked for now. */
	intent: (ctx: MapCtx, name: string, arg: string) => void
	/** A poster is pressed: what the form will need around that title can be asked for now. */
	near: (ctx: MapCtx, title: MapTitle) => void
	/** A control is pointed at or held with a finger (`name`), or no longer (null). */
	preview: (
		section: Element,
		ctx: MapCtx,
		name: string | null,
		arg: string,
	) => void
}
export interface MapCore {
	esc: (value: unknown) => string
	val: (title: MapTitle, key: string) => number
	poster: (
		title: MapTitle,
		options?: {
			cls?: string
			style?: string
			attrs?: string
			inner?: string
			came?: boolean
		},
	) => string
	src: (path: string) => string
	title: (key: string) => MapTitle | undefined
	href: (title: MapTitle) => string
	/** More of a title's neighborhood, merged into its pack when it arrives. True while on its way. */
	more: (key: string, suffix: string) => boolean
	/** Down to which similarity a title's pack is complete under a filter. Undefined: not known. 0: all there. */
	floor: (key: string, filter: string) => number | undefined
	/** The browser's window, or null on the server. */
	// biome-ignore lint/suspicious/noExplicitAny: the browser's window.
	win: any
}

/** The address of a title's pack, and with a suffix of a further page of it. */
export const PACK_PATH = "/api/related-map?key="

/** The section in the document. */
const SECTION = "[data-related-map]"

export function relatedMapEngine(
	M: MapMeta,
	// biome-ignore lint/suspicious/noExplicitAny: the browser's window, or null on the server.
	win: any,
	makeForm: (core: MapCore) => MapForm,
) {
	const PREFETCH = 8
	const SESSION_CAP = 80
	const IDX: Record<string, number> = {}
	M.keys.forEach((key, i) => {
		IDX[key] = i
	})
	const G: {
		t: Record<string, MapTitle>
		packs: Record<string, MapTitle[]>
		soft: Record<string, MapTitle[]>
		wait: Record<string, Promise<unknown>>
		asked: number
		nav: ((href: string) => void) | null
		fl: Record<string, Record<string, number>>
		ex: Record<string, number>
		late: Record<string, RawPack[]>
		extra: number
		dom: Record<string, MapTitle[]>
		again: Record<string, number>
		none: Record<string, boolean>
		used: boolean
	} = {
		t: {},
		packs: {},
		soft: {},
		wait: {},
		asked: 0,
		nav: null,
		fl: {},
		ex: {},
		late: {},
		extra: 0,
		dom: {},
		again: {},
		none: {},
		used: false,
	}
	const ESC: Record<string, string> = {
		"&": "&amp;",
		"<": "&lt;",
		">": "&gt;",
		'"': "&quot;",
	}
	const esc = (value: unknown) =>
		String(value ?? "").replace(/[&<>"]/g, (ch) => ESC[ch])

	// --- Titles and packs ---------------------------------------------------------------------------------------
	const titleOf = (raw: RawTitle): MapTitle => {
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
	const floors = (key: string, fl: Record<string, number> | undefined) => {
		if (!fl) return
		const mine = G.fl[key] ?? {}
		G.fl[key] = mine
		for (const filter in fl)
			mine[filter] =
				mine[filter] === undefined
					? fl[filter]
					: Math.min(mine[filter], fl[filter])
	}
	/** More of a neighborhood: the titles the pack doesn't hold yet, put in by similarity. */
	const merge = (key: string, raw: RawPack) => {
		const have: Record<string, boolean> = {}
		for (const t of G.packs[key]) have[t.k] = true
		const fresh = raw.n
			.filter((entry) => !have[entry[0]] && entry[0] !== key)
			.map(titleOf)
		if (fresh.length)
			G.packs[key] = G.packs[key].concat(fresh).sort((a, b) => b.n - a.n)
		floors(key, raw.fl)
	}
	const take = (raw: RawPack) => {
		const center = titleOf(raw.c)
		G.t[center.k] = center
		G.packs[center.k] = raw.n.map(titleOf)
		floors(center.k, raw.fl)
		for (const late of G.late[center.k] ?? []) merge(center.k, late)
		delete G.late[center.k]
	}
	const val = (title: MapTitle, key: string) => {
		const value = title.s ? title.s[IDX[key]] : 0
		return value === undefined || value < 0 ? 0 : value
	}
	/** How alike two titles are, from their levels alone: for a stand-in, whose titles come from another pack. */
	const sim = (a: MapTitle, b: MapTitle) => {
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
	const src = (path: string) => `${M.image}/w154/${path}`
	const hrefOf = (title: MapTitle) =>
		`/${title.k.charAt(0) === "m" ? "movie" : "show"}/${title.k.slice(1)}-${title.t
			.toLowerCase()
			.replace(/[^\w- ]+/g, "")
			.replace(/ +/g, "-")}`
	/** A poster you can step onto. Never a link. */
	const lazy = win ? "" : ' loading="lazy"'
	const poster: MapCore["poster"] = (title, options = {}) =>
		`<button type="button" class="pl-p ${options.cls ?? ""}"${
			options.style ? ` style="${options.style}"` : ""
		} data-pl-step="${title.k}" data-t="${esc(title.t)}" data-y="${esc(title.y)}"${
			options.came ? ' data-pl-came=""' : ""
		}${options.attrs ?? ""}><img alt="${esc(
			options.came ? `Back to ${title.t}` : title.t,
		)}"${lazy} decoding="async" draggable="false" src="${esc(src(title.p))}">${options.came ? '<span class="pl-cm" aria-hidden="true">← back</span>' : ""}${options.inner ?? ""}</button>`

	const core: MapCore = {
		esc,
		val,
		poster,
		src,
		title: (key) => G.t[key],
		href: (title) => hrefOf(title),
		more: (key, suffix) => (win ? more(key, suffix) : false),
		floor: (key, filter) => G.fl[key]?.[filter],
		win,
	}
	const form = makeForm(core)

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
	const ctxOf = (st: MapState): MapCtx => {
		const e = st.trail[st.trail.length - 1]
		const before = st.trail[st.trail.length - 2]
		const real = G.packs[e.k] ?? null
		// Before a title's pack is there: what is known around the title you came from, or what the server drew.
		const list =
			real ?? (before ? softOf(e.k, before.k) : null) ?? G.dom[e.k] ?? null
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

	/** The section's inner markup for a title page: the picture of the page's title, and the plain title links. */
	const section = (input: {
		root: string
		title: string
		pack: RawPack
		links: { href: string; text: string }[]
	}) => {
		take(input.pack)
		const rootTitle = G.t[input.root]
		const st: MapState = {
			root: input.root,
			trail: [{ k: input.root, ui: {} }],
			mem: {},
		}
		// Out of sight and out of the tab order: the map shows the same titles. Crawlers and screen readers find them.
		const links = input.links.length
			? `<p class="pl-more"><span>Open a page:</span>${input.links
					.map(
						(link) =>
							`<a data-pl-nav="" tabindex="-1" href="${esc(link.href)}">${esc(link.text)}</a>`,
					)
					.join("")}</p>`
			: ""
		return `<h2 class="pl-h">Titles like ${esc(input.title)}</h2><div class="pl-body"><div class="pl-stage pl-map" data-pl-stage="" data-pl-at="${input.root}" data-y="${esc(
			rootTitle.y,
		)}" data-p="${esc(rootTitle.p)}">${form.stage(ctxOf(st))}</div></div>${links}`
	}

	if (!win) return { section }

	// --- The browser ----------------------------------------------------------------------------------------------
	type Section = HTMLElement & {
		__pl?: MapState
		__awake?: boolean
		__own?: boolean
		__seen?: boolean
		__stage?: Element
		__sizes?: ResizeObserver
	}
	const doc = win.document as Document
	const q = (root: Element, selector: string) => root.querySelector(selector)
	const sec = (el: Element | null) =>
		(el?.closest?.(SECTION) ?? null) as Section | null
	const sections = () => {
		const all = doc.querySelectorAll(SECTION)
		const out: Section[] = []
		for (let i = 0; i < all.length; i++) out.push(all[i] as Section)
		return out
	}
	const stateOf = (s: Section) => {
		const root = s.getAttribute("data-pl-root") ?? ""
		if (!s.__pl || s.__pl.root !== root) {
			// The same element with another title: a navigation inside the app. It starts over, awake if it was.
			if (s.__pl && s.__awake) win.setTimeout(() => wake(s), 0)
			s.__awake = false
			s.__own = false
			const stage = q(s, "[data-pl-stage]")
			if (!G.t[root])
				G.t[root] = {
					k: root,
					t: s.getAttribute("data-pl-title") ?? "",
					y: stage?.getAttribute("data-y") ?? "",
					p: stage?.getAttribute("data-p") ?? "",
					n: 1,
					s: null,
				}
			s.__pl = { root, trail: [{ k: root, ui: {} }], mem: {} }
			if (!G.packs[root]) harvest(s, root)
		}
		return s.__pl
	}
	const here = (st: MapState) => st.trail[st.trail.length - 1].k
	/** The titles the server drew, in its order: enough to lay the picture out again before the pack is there. */
	function harvest(s: Element, root: string) {
		const out: MapTitle[] = []
		const seen: Record<string, boolean> = {}
		const add = (k: string, t: string, y: string, p: string) => {
			if (!k || seen[k] || k === root) return
			seen[k] = true
			const title = { k, t, y, p, n: 1 - out.length * 0.0001, s: null }
			if (!G.t[k]) G.t[k] = title
			out.push(G.t[k].s ? { ...G.t[k], n: title.n } : title)
		}
		const drawn = s.querySelectorAll("[data-pl-stage] [data-pl-step]")
		for (let i = 0; i < drawn.length; i++) {
			const b = drawn[i]
			add(
				b.getAttribute("data-pl-step") ?? "",
				b.getAttribute("data-t") ?? "",
				b.getAttribute("data-y") ?? "",
				(q(b, "img")?.getAttribute("src") ?? "").replace(/^.*\/w\d+\//, ""),
			)
		}
		try {
			const rest = JSON.parse(
				q(s, "[data-pl-rest]")?.getAttribute("data-pl-rest") ?? "[]",
			) as string[][]
			for (const entry of rest) add(entry[0], entry[1], entry[2], entry[3])
		} catch {}
		if (out.length) G.dom[root] = out
	}
	const fetchPack = (url: string, urgent: boolean): Promise<RawPack> =>
		win
			.fetch(url, { priority: urgent ? "high" : "low" })
			.then((response: Response) => {
				if (!response.ok) throw new Error(String(response.status))
				return response.json()
			})
	function ask(key: string, urgent: boolean): Promise<unknown> {
		if (G.packs[key] || G.none[key]) return Promise.resolve()
		if (!G.wait[key]) {
			if (!urgent && G.asked >= SESSION_CAP) return Promise.resolve()
			G.asked++
			G.wait[key] = fetchPack(PACK_PATH + key, urgent)
				.then((raw) => {
					take(raw)
					arrived(key)
				})
				.catch((error: Error) => {
					delete G.wait[key]
					// The server has no pack for this title, and will not have one in a moment.
					if (error?.message === "404") {
						G.none[key] = true
						return
					}
					// A pack that failed for the title someone stands on is asked for again: a few times further and
					// further apart, then every quarter of a minute. A stand-in is never left for good because a request
					// was lost.
					const tries = (G.again[key] ?? 0) + 1
					G.again[key] = tries
					win.setTimeout(() => again(key), tries <= 4 ? 1200 * tries : 15000)
				})
		}
		return G.wait[key]
	}
	/** Asks for the pack of a title again when someone still stands on it without one. */
	function again(key: string) {
		if (G.packs[key]) return
		for (const s of sections()) if (here(stateOf(s)) === key) ask(key, true)
	}
	win.addEventListener("online", () => {
		for (const s of sections()) if (s.__awake) again(here(stateOf(s)))
	})
	function more(key: string, suffix: string): boolean {
		const id = key + suffix
		if (G.ex[id]) return G.ex[id] === 1
		if (G.extra >= 120) return false
		G.extra++
		G.ex[id] = 1
		// Whoever stands on the title gets the new titles into the picture. Nothing waits for this.
		const redraw = () => {
			for (const s of sections())
				if (here(stateOf(s)) === key && G.packs[key]) draw(s)
		}
		fetchPack(PACK_PATH + key + suffix, false)
			.then((raw) => {
				G.ex[id] = 2
				if (G.packs[key]) merge(key, raw)
				else G.late[key] = (G.late[key] ?? []).concat([raw])
				redraw()
			})
			.catch(() => {
				// A page that failed is asked for again by the next picture, which is drawn in a moment.
				G.ex[id] = 0
				win.setTimeout(redraw, 1500)
			})
		return true
	}
	const idle = (run: () => void) =>
		win.requestIdleCallback
			? win.requestIdleCallback(run, { timeout: 600 })
			: win.setTimeout(run, 120)
	/**
	 * One hop ahead: the packs of the first titles on the map. Only once a person uses the page: a crawler or a
	 * visitor who never touches it asks for the page title's pack and no other.
	 */
	const ahead = (s: Section) => {
		if (!G.used) return
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
	const USE = ["pointerdown", "pointermove", "touchstart", "keydown", "wheel"]
	const used = () => {
		G.used = true
		for (const type of USE) win.removeEventListener(type, used, true)
		for (const s of sections()) if (s.__awake) ahead(s)
	}
	for (const type of USE)
		win.addEventListener(type, used, { capture: true, passive: true })
	let keyboard = false
	const adopt = (s: Section) => {
		if (s.__own) return
		s.__own = true
		const stage = q(s, "[data-pl-stage]")
		if (stage?.firstChild) form.adopt(stateOf(s), stage)
	}
	const draw = (s: Section) => {
		const st = stateOf(s)
		if (!G.t[here(st)]) return
		adopt(s)
		// Someone walking with the keyboard keeps their place: the section takes the focus that the redrawn picture
		// loses. A tap with a finger or the mouse has no need for it.
		const had =
			keyboard && s.contains(doc.activeElement) && doc.activeElement !== s
		const ctx = ctxOf(st)
		const markup = form.stage(ctx)
		const stage = q(s, "[data-pl-stage]") as HTMLElement
		if (!(stage.firstChild && form.into(stage, ctx))) stage.innerHTML = markup
		stage.setAttribute("data-pl-at", ctx.c.k)
		if (ctx.list) stage.removeAttribute("data-pl-cold")
		else stage.setAttribute("data-pl-cold", "")
		if (ctx.soft) stage.setAttribute("data-pl-soft", "")
		else stage.removeAttribute("data-pl-soft")
		if (had && !s.contains(doc.activeElement)) s.focus({ preventScroll: true })
		// A picture that is drawn again under a finger that holds a poster (more titles arrived) keeps showing it.
		if (peeking?.on && !peeking.ctl && peeking.s === s) {
			const t = G.t[peeking.k]
			if (t && t.k !== ctx.c.k) form.peek(s, ctx, t)
		}
	}
	function arrived(key: string) {
		for (const s of sections()) {
			const st = stateOf(s)
			if (here(st) !== key) continue
			const stage = q(s, "[data-pl-stage]")
			// Placeholders fill in, and a stand-in is corrected: the titles move to their true places.
			if (
				stage?.hasAttribute("data-pl-cold") ||
				stage?.hasAttribute("data-pl-soft")
			)
				draw(s)
			ahead(s)
		}
	}
	function wake(s: Section) {
		if (s.__awake) return
		s.__awake = true
		const st = stateOf(s)
		adopt(s)
		ask(st.root, true).then(() => {
			fitted(s)
			ahead(s)
		})
		fitted(s)
	}
	/** The form lays its picture out for the stage's size: it hears the size when the section wakes and when it changes. */
	function fitted(s: Section) {
		const st = stateOf(s)
		if (!G.t[here(st)]) return
		adopt(s)
		// Without the neighborhood there is nothing to lay out again: the server's picture stays until it is there.
		const ctx = ctxOf(st)
		if (form.fit(s, ctx) && ctx.list) draw(s)
	}
	let sized = 0
	win.addEventListener("resize", () => {
		win.clearTimeout(sized)
		sized = win.setTimeout(() => {
			for (const s of sections()) if (s.__awake) fitted(s)
		}, 150)
	})
	const back = (s: Section, index: number) => {
		const st = stateOf(s)
		if (index < 0 || index >= st.trail.length - 1) return
		st.trail.length = index + 1
		draw(s)
		// A title whose pack was lost while the walk was elsewhere is asked for again.
		const key = here(st)
		if (G.packs[key]) ahead(s)
		else ask(key, true)
	}
	const step = (s: Section, button: Element) => {
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
		adopt(s)
		st.trail.push({
			k: key,
			ui: form.carry(st.trail[st.trail.length - 1].ui, button),
		})
		draw(s)
		if (G.packs[key]) ahead(s)
		else ask(key, true)
	}
	let swallow = 0
	let pressed: { el: Element; at: number } | null = null
	const hit = (event: Event, selector: string) => {
		const target = event.target as Element | null
		return target?.closest ? target.closest(selector) : null
	}
	// A tap on one of the section's own controls is this script's alone: it is handled in the capture phase at the
	// window and stopped there, so that no other listener of the page (the app's root, analytics) runs before the new
	// picture is painted.
	const OWN = "[data-pl-step],[data-pl-act],[data-pl-to],[data-pl-back]"
	const mine = (event: Event) => {
		// A finger that was held on a poster to look at it lifts: that is not a tap (see `hold`).
		if (event.type === "pointerup") {
			if ((event as PointerEvent).pointerType === "touch")
				touched = event.timeStamp
			unpeek(event)
		}
		if (hit(event, OWN) && sec(event.target as Element))
			event.stopImmediatePropagation()
	}
	for (const type of ["pointerup", "mousedown", "mouseup", "touchend"])
		win.addEventListener(type, mine, { capture: true, passive: true })
	win.addEventListener(
		"click",
		(event: MouseEvent) => {
			// The list of steps closes on a tap anywhere else.
			const lists = doc.querySelectorAll("details[data-pl-hist][open]")
			for (let i = 0; i < lists.length; i++)
				if (!lists[i].contains(event.target as Node))
					lists[i].removeAttribute("open")
			const s = sec(event.target as Element)
			if (!s) return
			// The lift of a finger that held a poster or a chip is not a tap.
			if (event.timeStamp - swallow < 400 && event.detail !== 0) {
				swallow = 0
				event.preventDefault()
				event.stopImmediatePropagation()
				return
			}
			const link = hit(event, "a[data-pl-nav]")
			if (link) {
				if (
					event.metaKey ||
					event.ctrlKey ||
					event.shiftKey ||
					event.altKey ||
					event.button
				)
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
			const to = hit(event, "[data-pl-to]")
			if (to) {
				back(s, Number(to.getAttribute("data-pl-to")))
				return
			}
			if (hit(event, "[data-pl-back]")) {
				back(s, st.trail.length - 2)
				return
			}
			const control = hit(event, "[data-pl-act]")
			if (control) {
				pressed = null
				adopt(s)
				const changed = form.act(
					ctxOf(st),
					control.getAttribute("data-pl-act") ?? "",
					control.getAttribute("data-arg") ?? "",
					control,
					s,
				)
				if (changed) {
					draw(s)
					ahead(s)
				}
				return
			}
			// A press that began on a poster is a tap on that poster, wherever it ends: posters that glide to a new
			// place may have moved on by the time the finger lifts.
			const began =
				pressed &&
				event.timeStamp - pressed.at < 700 &&
				pressed.el.isConnected &&
				sec(pressed.el) === s
					? pressed.el
					: null
			pressed = null
			let button =
				hit(event, "[data-pl-step]") ?? (event.detail !== 0 ? began : null)
			// A tap that lands in the gap between posters of the map goes to the poster next to it.
			const gap = button ? null : hit(event, "[data-pl-slop]")
			if (gap && event.detail !== 0) {
				let near = 18
				const all = gap.querySelectorAll("[data-pl-step]")
				for (let i = 0; i < all.length; i++) {
					const r = all[i].getBoundingClientRect()
					const dx = Math.max(r.left - event.clientX, 0, event.clientX - r.right)
					const dy = Math.max(r.top - event.clientY, 0, event.clientY - r.bottom)
					if (dx + dy < near) {
						near = dx + dy
						button = all[i]
					}
				}
			}
			if (button) {
				// The pan now moves other posters under the pointer: none of them is pointed at until the pointer moves.
				rest = { x: event.clientX, y: event.clientY }
				step(s, button)
			}
		},
		true,
	)
	/** A poster being pressed or pointed at: its pack is wanted now. */
	const intent = (event: Event) => {
		if (event.type === "pointerdown") pressed = null
		mine(event)
		const button = hit(event, "[data-pl-step]")
		const s = sec(button)
		if (!s || !button) {
			const any = sec(event.target as Element)
			if (any) {
				wake(any)
				const control = wanted(event, any) ? hit(event, "[data-pl-act]") : null
				if (control && event.type === "pointerdown")
					holdControl(event as PointerEvent, control, any)
			}
			return
		}
		wake(s)
		if (wanted(event, s)) return
		if (event.type === "pointerdown") {
			pressed = { el: button, at: event.timeStamp }
			hold(event as PointerEvent, button, s)
			const st = stateOf(s)
			const t = G.t[button.getAttribute("data-pl-step") ?? ""]
			if (t && !button.hasAttribute("data-pl-came") && G.t[here(st)])
				form.near(ctxOf(st), t)
		}
		if (!button.hasAttribute("data-pl-came"))
			ask(button.getAttribute("data-pl-step") ?? "", true)
	}
	/** A control being pressed or pointed at: the form may ask for what it would need. */
	function wanted(event: Event, s: Section) {
		const control = hit(event, "[data-pl-act]")
		if (!control) return false
		const st = stateOf(s)
		if (G.t[here(st)]) {
			adopt(s)
			form.intent(
				ctxOf(st),
				control.getAttribute("data-pl-act") ?? "",
				control.getAttribute("data-arg") ?? "",
			)
		}
		return true
	}
	// A finger that stays on a poster is what pointing at it is for a mouse: the form shows that title in its card
	// for as long as the finger stays, and lifting it is then not a tap. A tap stays a tap: nothing waits for this.
	let touched = -1e9
	// A finger that rests is never still. Once the hold is on it lasts until that finger lifts: the finger may roll or
	// drift, the page does not scroll under it (`touchmove` below), other pointers do not end it, and a picture that
	// is drawn again under it shows the held title again.
	let peeking: {
		s: Section
		timer: number
		on: boolean
		x: number
		y: number
		ctl: boolean
		id: number
		k: string
	} | null = null
	/** Where the pointer was when a step began. */
	let rest: { x: number; y: number } | null = null
	const unpeek = (event: Event | null) => {
		if (!peeking) return
		// Only the finger that holds lets go.
		const id = (event as PointerEvent | null)?.pointerId
		if (event && id !== undefined && id !== peeking.id) return
		win.clearTimeout(peeking.timer)
		if (peeking.on) {
			const st = stateOf(peeking.s)
			if (peeking.ctl) form.preview(peeking.s, ctxOf(st), null, "")
			else form.peek(peeking.s, ctxOf(st), null)
			if (event?.type === "pointerup") swallow = event.timeStamp
			pressed = null
		}
		peeking = null
	}
	function hold(event: PointerEvent, button: Element, s: Section) {
		unpeek(null)
		const st = stateOf(s)
		if (event.pointerType !== "touch") return
		touched = event.timeStamp
		const own = {
			s,
			on: false,
			x: event.clientX,
			y: event.clientY,
			timer: 0,
			ctl: false,
			id: event.pointerId,
			k: button.getAttribute("data-pl-step") ?? "",
		}
		own.timer = win.setTimeout(() => {
			if (peeking !== own || !button.isConnected) return
			const t = G.t[button.getAttribute("data-pl-step") ?? ""]
			if (!t) return
			own.on = true
			form.peek(s, ctxOf(st), t)
		}, 280)
		peeking = own
	}
	// The same for a control: a finger that stays on it shows what it would do, and lifting it then does not do it.
	function holdControl(event: PointerEvent, control: Element, s: Section) {
		unpeek(null)
		const st = stateOf(s)
		if (event.pointerType !== "touch") return
		touched = event.timeStamp
		if (!G.t[here(st)]) return
		// The control itself may have been drawn again since the press: what it stands for is what counts.
		const name = control.getAttribute("data-pl-act") ?? ""
		const arg = control.getAttribute("data-arg") ?? ""
		const own = {
			s,
			on: false,
			x: event.clientX,
			y: event.clientY,
			timer: 0,
			ctl: true,
			id: event.pointerId,
			k: "",
		}
		own.timer = win.setTimeout(() => {
			if (peeking !== own) return
			own.on = true
			form.preview(s, ctxOf(st), name, arg)
		}, 280)
		peeking = own
	}
	win.addEventListener(
		"pointermove",
		(event: PointerEvent) => {
			// Before the hold is on, a finger that travels is a swipe. Once it is on, only lifting it ends it.
			if (
				peeking &&
				!peeking.on &&
				event.pointerId === peeking.id &&
				Math.hypot(event.clientX - peeking.x, event.clientY - peeking.y) > 10
			)
				unpeek(null)
			// The pointer moves again after a step: whatever is under it now is pointed at.
			if (
				rest &&
				event.pointerType === "mouse" &&
				Math.abs(event.clientX - rest.x) + Math.abs(event.clientY - rest.y) >= 4
			) {
				rest = null
				over(event)
			}
		},
		true,
	)
	for (const type of ["pointerup", "pointercancel"])
		win.addEventListener(type, unpeek, true)
	// While a hold is on, the page does not scroll under the finger: a scroll would cancel the pointer, and the hold
	// with it. Before the hold is on nothing is prevented, so a swipe that starts on a poster scrolls as ever.
	const steady = (event: Event) => {
		if (peeking?.on && event.cancelable) event.preventDefault()
	}
	// A long press does not lift the poster's image for a drag either.
	win.addEventListener(
		"dragstart",
		(event: Event) => {
			if (sec(hit(event, "[data-pl-step]"))) event.preventDefault()
		},
		true,
	)
	win.addEventListener(
		"contextmenu",
		(event: Event) => {
			if (sec(hit(event, "[data-pl-step]"))) event.preventDefault()
		},
		true,
	)
	win.addEventListener("pointerdown", intent, true)
	win.addEventListener("touchstart", intent, { capture: true, passive: true })
	const over = (event: Event) => {
		const button = hit(event, "[data-pl-step]")
		const s = sec(button)
		if (!s || !button) return
		// The mouse events a browser makes up after a touch are not a mouse pointing at anything.
		if (event.type === "mouseover" && event.timeStamp - touched < 1200) return
		// Nor is a poster that the pan carries under a pointer that has not moved since the tap.
		if (rest && event.type === "mouseover") {
			const at = event as MouseEvent
			if (Math.abs(at.clientX - rest.x) + Math.abs(at.clientY - rest.y) < 4)
				return
			rest = null
		}
		if (event.type === "pointermove") {
			if (!button.hasAttribute("data-pl-came"))
				ask(button.getAttribute("data-pl-step") ?? "", true)
		} else intent(event)
		const st = stateOf(s)
		const c = G.t[here(st)]
		const t = G.t[button.getAttribute("data-pl-step") ?? ""]
		if (t && c) form.peek(s, ctxOf(st), t)
	}
	const out = (event: Event) => {
		const button = hit(event, "[data-pl-step]")
		const s = sec(button)
		const related = (event as MouseEvent).relatedTarget as Node | null
		if (!s || !button || (related && button.contains(related))) return
		// A finger holds a poster: no mouse or focus event that the browser makes up for the touch ends that.
		if (peeking?.on && !peeking.ctl) return
		const st = stateOf(s)
		if (G.t[here(st)]) form.peek(s, ctxOf(st), null)
	}
	const lookOf = (event: Event, on: boolean) => {
		const control = hit(event, "[data-pl-act]")
		const s = sec(control)
		if (!s || !control) return
		if (on) wanted(event, s)
		const related = (event as MouseEvent).relatedTarget as Node | null
		if (
			event.timeStamp - touched < 1200 ||
			(!on && related && control.contains(related))
		)
			return
		const st = stateOf(s)
		if (!G.t[here(st)]) return
		adopt(s)
		if (on)
			form.preview(
				s,
				ctxOf(st),
				control.getAttribute("data-pl-act") ?? "",
				control.getAttribute("data-arg") ?? "",
			)
		else form.preview(s, ctxOf(st), null, "")
	}
	doc.addEventListener("mouseover", (event: Event) => lookOf(event, true))
	doc.addEventListener("mouseout", (event: Event) => lookOf(event, false))
	doc.addEventListener("mouseover", over)
	doc.addEventListener("mouseout", out)
	doc.addEventListener("focusin", (event: Event) => {
		const button = hit(event, "[data-pl-step]")
		if (button?.matches(":focus-visible")) over(event)
	})
	doc.addEventListener("focusout", out)
	// Escape closes the open list of steps, and the focus goes back to the control that opened it.
	doc.addEventListener("keydown", (event: KeyboardEvent) => {
		if (event.key !== "Escape") return
		const list = hit(event, "details[data-pl-hist][open]")
		if (!list || !sec(list)) return
		list.removeAttribute("open")
		;(q(list, "summary") as HTMLElement | null)?.focus()
	})

	const boot = () => {
		for (const s of sections()) {
			stateOf(s)
			// The form hears the stage's size after the first layout and before the first paint, so the server's
			// picture (drawn for a phone) is never seen at another width. A navigation inside the app puts a new stage
			// into the same section.
			const stage = q(s, "[data-pl-stage]")
			if (stage && stage !== s.__stage && win.ResizeObserver) {
				s.__sizes?.disconnect()
				s.__sizes = new win.ResizeObserver(() => fitted(s))
				s.__sizes?.observe(stage)
				s.__stage = stage
			}
			if (s.__seen) continue
			s.__seen = true
			s.addEventListener("touchmove", steady, { passive: false })
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
	win.__gwRelatedMap = Object.assign(G, { boot })
	boot()
	return { section }
}
