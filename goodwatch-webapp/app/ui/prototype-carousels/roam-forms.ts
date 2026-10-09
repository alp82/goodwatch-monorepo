// PROTOTYPE for "Prototype native-scroll carousels on title pages", tenth round. Throwaway code: not for production.
//
// Five forms with one title in the middle and the related titles around it, in which distance from the middle is
// similarity: the nearest place holds the most alike title, and every place further out a less alike one. What the
// forms differ in is what the angle means, and how a visitor goes further out:
// - roam1, rings: the angle is nothing but tidy packing. Three switches from the title's fingerprint change who is
//   around (two traits it is strong on can be turned off, one it has little of can be turned on). A zoom shows
//   more rings.
// - roam2, spiral: the same order as one arm that winds outward from the middle. A sideways drag winds it on, so
//   the arm never ends.
// - roam3, open field: a wide map that pans sideways with the browser's own scrolling, further and further from the
//   middle on both sides. Each poster says the one way it differs most.
// - roam4, neighborhoods: the angle is a group of titles that are alike each other, with a caption for what the
//   group has more or less of. No control at all.
// - roam5, with and without: the switches of roam1 as four sides that are all visible at once.
//
// What they share is in `roamKit`: the lattice and its order, the filter of flipped switches, asking for more titles
// before the visitor runs out, and a way to put a new picture into the stage that keeps the posters that stay, so
// that they glide to their new places instead of being drawn again. Both the kit and each form are functions with
// no outside references, because they run as the page's inline script (see play-engine.ts).
import type {
	PlayCore,
	PlayCtx,
	PlayForm,
	PlayState,
	PlayTitle,
} from "~/ui/prototype-carousels/play-engine"
import type { RoamExtra } from "~/ui/prototype-carousels/roam-meta"

export type RoamKit = ReturnType<typeof roamKit>
type RoamForm = (core: PlayCore, kit: RoamKit) => PlayForm
/** A place on the lattice, in px from the middle. `b` is its ring, `a` its angle clockwise from the top. */
interface Cell {
	x: number
	y: number
	b: number
	a: number
	d: number
}
/** A poster (or an empty place) in a picture. */
interface Item {
	k: string
	html: string
	style: string
	sig: string
	far: boolean
}
/** A picture: the parts of the stage as markup, and the posters one by one. */
interface View {
	form: string
	mem: string
	geo: string
	top: string
	bg: string
	ctl: string
	info: string
	center: string
	ck: string
	wstyle: string
	items: Item[]
}

export function roamKit(core: PlayCore, X: RoamExtra) {
	const { esc, val } = core
	const win = core.win
	const WORDS = Object.keys(X.w)
	const word = (key: string) => X.w[key]?.[0] ?? core.M.traits[key]?.l ?? key
	const emo = (key: string) => X.w[key]?.[1] ?? core.M.traits[key]?.e ?? ""
	const low = (key: string) => word(key).toLowerCase()
	const hue = (key: string) => core.M.traits[key]?.c ?? "#fbbf24"
	const ZOOM = [1, 0.72, 0.54]

	// --- The stage's size and the lattice ---------------------------------------------------------------------
	// The server draws for a phone. The browser measures the map when the section wakes and draws again if needed.
	const box = { w: 348, h: 366 }
	const posterW = () => (box.w >= 600 ? 60 : Math.max(44, Math.min(56, Math.floor((box.w - 4) / 5.43))))
	const geoOf = () => `${box.w}|${box.h}`
	/** How much wider than tall the rings are: a wide stage gets wide rings, so that every ring is whole. */
	const stretch = () => Math.max(1, Math.min(2.4, (box.w / box.h) * 0.95))
	const memo: Record<string, Cell[]> = {}
	/**
	 * The places of a lattice of posters that are fully inside `width` by the map's height, nearest first: ring by
	 * ring, and around each ring clockwise from the top. Consecutive places are neighbors, so the order is a spiral.
	 */
	const cells = (scale: number, width = box.w, wide = stretch()): Cell[] => {
		const id = `${geoOf()}|${scale}|${width}|${wide}`
		if (memo[id]) return memo[id]
		const w = posterW() * scale
		const h = w * 1.5
		const p = w * 1.107
		const q = h * 1.0715
		const out: Cell[] = []
		const cols = Math.ceil(width / 2 / p) + 1
		const rows = Math.ceil(box.h / 2 / q) + 1
		for (let i = -cols; i <= cols; i++)
			for (let j = -rows; j <= rows; j++) {
				const x = i * p
				const y = (j + (i % 2 ? 0.5 : 0)) * q
				if (!i && !j) continue
				if (Math.abs(x) + w / 2 > width / 2 - 1 || Math.abs(y) + h / 2 > box.h / 2 - 1) continue
				// The four corners stay free: for the key, the control, and the captions.
				if (Math.abs(x) + w / 2 > width / 2 - 78 && Math.abs(y) + h / 2 > box.h / 2 - 44) continue
				const d = Math.sqrt((x / wide) * (x / wide) + y * y)
				let a = Math.atan2(x / wide, -y)
				if (a < 0) a += Math.PI * 2
				out.push({ x, y, d, a, b: Math.max(1, Math.ceil((d - 0.8 * w) / (1.107 * w))) })
			}
		out.sort((m, n) => m.b - n.b || m.a - n.a)
		memo[id] = out
		return out
	}
	/** The outer edge of a ring, as the half height of its ellipse. */
	const ringEdge = (ring: number, scale: number) => (0.8 + 1.107 * ring) * posterW() * scale + 3
	const guides = (scale: number, rings: number) => {
		const wide = stretch()
		let out = ""
		for (let ring = 1; ring <= rings; ring++) {
			const r = ringEdge(ring, scale)
			out += `<ellipse rx="${Math.round(r * wide)}" ry="${Math.round(r)}"/>`
		}
		return `<svg class="rm-g" viewBox="${-box.w / 2} ${-box.h / 2} ${box.w} ${box.h}" aria-hidden="true">${out}</svg>`
	}

	// --- The walk's switches, and who passes them ---------------------------------------------------------------
	/** The walk's switches ("spectacle-", "romance+"): the ones the page title's pack came with. */
	const switches = (ctx: PlayCtx, none = false): string[] => {
		const mem = ctx.st.mem
		if (none) mem.tr = []
		else if (!mem.tr) {
			const own = core.packTraits(ctx.root.k)
			if (own) mem.tr = own
		}
		const flipped = flips(ctx)
		core.query(`${base(ctx)}${flipped.length > 1 ? `&f=${encodeURIComponent(flipped.join(","))}` : ""}`)
		return (mem.tr as string[] | undefined) ?? []
	}
	const base = (ctx: PlayCtx) => {
		const tr = ctx.st.mem.tr as string[] | undefined
		return `&v=4${tr ? `&tr=${tr.length ? encodeURIComponent(tr.join(",")) : "0"}` : ""}`
	}
	/** The switches that are flipped, in a fixed order: the filter's name. */
	const flips = (ctx: PlayCtx): string[] => ((ctx.st.mem.w as string[] | undefined) ?? []).slice().sort()
	const passes = (t: PlayTitle, names: string[]) => {
		for (const name of names) {
			const level = val(t, name.slice(0, -1))
			if (name.charAt(name.length - 1) === "+" ? level < X.hi : level > X.lo) return false
		}
		return true
	}
	/**
	 * The titles around the one you stand on that pass a filter, most alike first. Only down to the similarity the
	 * pack is complete to, so that a page that arrives later adds titles further out and pushes none aside.
	 */
	const around = (ctx: PlayCtx, names: string[]): PlayTitle[] => {
		if (!ctx.list) return []
		let out = names.length ? ctx.list.filter((t) => t.s && passes(t, names)) : ctx.list
		if (!ctx.soft) {
			const floor = core.floor(ctx.c.k, names.join(","))
			if (floor) out = out.filter((t) => t.n * 1000 >= floor - 0.01)
		}
		// One title per franchise, the most alike one, and one more of the franchise you stand on.
		const seen: Record<string, boolean> = {}
		return out.filter((t) => {
			const name = stem(t)
			if (!name) return true
			if (seen[name]) return false
			seen[name] = true
			return true
		})
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
	const page: Record<string, number> = {}
	/** Makes sure `count` titles are there under a filter, or on their way. Never waited for. True: on their way. */
	const want = (ctx: PlayCtx, names: string[], have: number, count: number): boolean => {
		if (!win || ctx.soft || !ctx.list || have >= count) return false
		const filter = names.join(",")
		if (core.floor(ctx.c.k, filter) === 0) return false
		const id = `${ctx.c.k}|${filter}`
		// The pack itself is the first page of the plain order. A filter starts at its own first page.
		let d = page[id] ?? (filter ? 0 : 1)
		const ask = () => core.more(ctx.c.k, `${base(ctx)}&f=${encodeURIComponent(filter)}&d=${d}`)
		if (ask()) return true
		if (d >= 6) return false
		d++
		page[id] = d
		return ask()
	}
	/** After a flip: the filters one more flip away are asked for, so that the next flip is drawn from memory too. */
	const next = (ctx: PlayCtx, tr: string[], names: string[]) => {
		if (!win || ctx.soft || !ctx.list || !names.length) return
		for (const other of tr) {
			if (names.indexOf(other) >= 0) continue
			const pair = names.concat([other]).sort()
			if (core.floor(ctx.c.k, pair.join(",")) === undefined) want(ctx, pair, 0, 1)
		}
	}
	/** True when there may be more titles under a filter than the pack holds. */
	const open = (ctx: PlayCtx, names: string[]) => !ctx.list || ctx.soft || core.floor(ctx.c.k, names.join(",")) !== 0

	// --- Words ----------------------------------------------------------------------------------------------------
	/** The one way a title differs most from another, on the plain traits: at least `least` levels. */
	const most = (from: PlayTitle, t: PlayTitle, least: number) => {
		let key = ""
		let best = 0
		for (const k of WORDS) {
			const d = val(t, k) - val(from, k)
			if (Math.abs(d) > Math.abs(best)) {
				best = d
				key = k
			}
		}
		return Math.abs(best) >= least ? { k: key, d: best } : null
	}
	const journey = (ctx: PlayCtx) => {
		if (!ctx.prev?.s || !ctx.c.s) return ""
		const told = WORDS.map((k) => ({ k, d: val(ctx.c, k) - val(ctx.prev as PlayTitle, k) }))
			.filter((e) => Math.abs(e.d) >= 2)
			.sort((a, b) => Math.abs(b.d) - Math.abs(a.d))
			.slice(0, 3)
			.map((e) => `${e.d > 0 ? "more" : "less"} ${esc(low(e.k))}`)
		return `From ${esc(ctx.prev.t)}: ${told.length ? told.join(", ") : "much the same mix"}.`
	}
	const says = (names: string[]) =>
		names.map((name) => `<b>${name.charAt(name.length - 1) === "+" ? "with" : "without"} ${esc(low(name.slice(0, -1)))}</b>`).join(" and ")
	const info = (ctx: PlayCtx, why: string) => {
		const c = ctx.c
		const link =
			c.k === ctx.root.k
				? '<span class="bs-this">this page</span>'
				: `<a class="bs-open" data-pl-nav="" data-pl-open="" href="${esc(core.href(c))}">Open<span class="pl-sr"> ${esc(c.t)}</span></a>`
		return `<p class="rm-nm"><b data-pl-here="">${esc(c.t)}</b><small>${esc(c.y)}${c.k.charAt(0) === "s" ? " · Show" : ""}</small>${link}</p><p class="rm-why" data-pl-why="" aria-live="polite">${why}</p>`
	}
	/** The switches as chips: lit means the titles around have the trait. */
	const chips = (ctx: PlayCtx, tr: string[]) => {
		const flipped = flips(ctx)
		return `<div class="rm-sw" role="group" aria-label="What the titles around have"><span class="rm-swl">With</span>${tr
			.map((name) => {
				const key = name.slice(0, -1)
				const on = (name.charAt(name.length - 1) === "-") !== flipped.indexOf(name) >= 0
				return `<button type="button" class="rm-ch" data-pl-act="sw" data-arg="${name}" aria-pressed="${on}" style="--c:${hue(key)}"><i>${emo(key)}</i>${esc(word(key))}</button>`
			})
			.join("")}</div>`
	}
	const flip = (ctx: PlayCtx, name: string) => {
		const mem = ctx.st.mem
		const w = ((mem.w as string[] | undefined) ?? []).slice()
		const at = w.indexOf(name)
		if (at >= 0) w.splice(at, 1)
		else w.push(name)
		mem.w = w
	}
	const zoomOf = (ctx: PlayCtx) => Math.max(0, Math.min(ZOOM.length - 1, Number(ctx.st.mem.z) || 0))
	const zoomCtl = (ctx: PlayCtx, shown: number, cls = "") => {
		const z = zoomOf(ctx)
		return `<div class="rm-z ${cls}" role="group" aria-label="How far out the map reaches"><button type="button" data-pl-act="z" data-arg="1" aria-label="Further out: more titles"${
			z >= ZOOM.length - 1 ? " disabled" : ""
		}>−</button><span>${shown}</span><button type="button" data-pl-act="z" data-arg="-1" aria-label="Closer: larger posters"${z <= 0 ? " disabled" : ""}>+</button></div>`
	}
	const zoomAct = (ctx: PlayCtx, arg: string) => {
		const z = zoomOf(ctx)
		const next = Math.max(0, Math.min(ZOOM.length - 1, z + Number(arg)))
		ctx.st.mem.z = next
		return next !== z
	}

	// --- A picture and its posters --------------------------------------------------------------------------------
	const place = (x: number, y: number, s: number, extra = "") => `--x:${Math.round(x * 10) / 10}px;--y:${Math.round(y * 10) / 10}px;--s:${Math.round(s * 1000) / 1000}${extra}`
	const item = (ctx: PlayCtx, t: PlayTitle, x: number, y: number, s: number, far: boolean, label = "", extra = ""): Item => {
		const came = Boolean(ctx.prev && t.k === ctx.prev.k)
		const style = place(x, y, s, extra)
		const sig = `${came ? "c" : ""}|${label}`
		return {
			k: t.k,
			style,
			sig,
			far,
			html: core.poster(t, { cls: "rm-p", style, came, inner: label, attrs: ` data-r-k="${t.k}" data-r-g="${esc(sig)}"${far ? ' data-pl-far=""' : ""}` }),
		}
	}
	const hole = (id: string, x: number, y: number, s: number): Item => {
		const style = place(x, y, s)
		return { k: id, style, sig: "", far: true, html: `<span class="pl-ph rm-p" style="${style}" data-r-k="${id}" data-r-g="" aria-hidden="true"></span>` }
	}
	const centerOf = (ctx: PlayCtx, scale: number) => core.center(ctx, "rm-c", `--s:${Math.round(scale * 1000) / 1000}`, ` data-r-c="${ctx.c.k}"`)
	const viewOf = (ctx: PlayCtx, form: string, parts: { top: string; bg: string; ctl: string; why: string; items: Item[]; scale: number; world?: string }): View => ({
		form,
		mem: JSON.stringify(ctx.st.mem),
		geo: geoOf(),
		top: parts.top,
		bg: parts.bg,
		ctl: parts.ctl,
		info: info(ctx, parts.why),
		center: centerOf(ctx, parts.scale),
		ck: ctx.c.k,
		wstyle: `--pw:${posterW()}px${parts.world ?? ""}`,
		items: parts.items,
	})
	let last: View | null = null
	/** The stage's markup for a picture. `scroll`: the map pans sideways with the browser's own scrolling. */
	const html = (view: View, scroll = false) => {
		last = view
		const world = `<div class="rm-w" data-r-w="" data-pl-slop="" style="${view.wstyle}">${view.center}${view.items.map((entry) => entry.html).join("")}</div>`
		return `<div class="rm rm-${view.form}" data-r-form="${view.form}" data-r-geo="${view.geo}" data-r-mem="${esc(view.mem)}"><div class="rm-top" data-r-top="">${view.top}</div><div class="rm-map" data-r-map=""${
			scroll ? "" : ' data-pl-pan=""'
		}><div class="rm-bg" data-r-bg="">${view.bg}</div>${
			scroll ? `<div class="rm-sc" data-r-sc="" data-pl-input="" data-pl-pan="mouse">${world}</div>` : world
		}<div class="rm-ctl" data-r-ctl="">${view.ctl}</div></div><div class="rm-info" data-r-info="">${view.info}</div></div>`
	}
	const part = (root: Element, name: string, markup: string) => {
		const el = root.querySelector(`[data-r-${name}]`) as (HTMLElement & { __h?: string }) | null
		if (!el || el.__h === markup) return
		// The server's markup is not compared: it is replaced once, by the same thing.
		el.innerHTML = markup
		el.__h = markup
	}
	/**
	 * Puts the picture drawn last into the stage and keeps every poster that stays: it gets its new place and
	 * glides there. New posters fade in, and the ones that left are removed.
	 */
	const into = (stage: Element, _ctx?: PlayCtx): boolean => {
		const view = last
		const root = stage.firstElementChild
		if (!view || !root || root.getAttribute("data-r-form") !== view.form) return false
		const world = root.querySelector("[data-r-w]") as HTMLElement | null
		if (!world) return false
		root.setAttribute("data-r-mem", view.mem)
		root.setAttribute("data-r-geo", view.geo)
		part(root, "top", view.top)
		part(root, "bg", view.bg)
		part(root, "ctl", view.ctl)
		part(root, "info", view.info)
		world.style.cssText = view.wstyle
		const center = world.querySelector("[data-r-c]") as HTMLElement | null
		if (!center || center.getAttribute("data-r-c") !== view.ck) {
			if (center) center.outerHTML = view.center
			else world.insertAdjacentHTML("afterbegin", view.center)
		} else center.style.cssText = view.center.match(/style="([^"]*)"/)?.[1] ?? ""
		const wanted: Record<string, Item> = {}
		for (const entry of view.items) wanted[entry.k] = entry
		const have: Record<string, HTMLElement> = {}
		const nodes = world.querySelectorAll("[data-r-k]")
		for (let i = 0; i < nodes.length; i++) {
			const node = nodes[i] as HTMLElement
			const k = node.getAttribute("data-r-k") ?? ""
			if (!wanted[k] || have[k]) node.remove()
			else have[k] = node
		}
		let fresh = ""
		for (const entry of view.items) {
			const node = have[entry.k]
			if (!node) fresh += entry.html
			else if (node.getAttribute("data-r-g") !== entry.sig) node.outerHTML = entry.html
			else {
				node.style.cssText = entry.style
				if (entry.far) node.setAttribute("data-pl-far", "")
				else node.removeAttribute("data-pl-far")
			}
		}
		if (fresh) world.insertAdjacentHTML("beforeend", fresh)
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
		const tr = st.mem.tr as string[] | undefined
		if (tr) core.query(`&v=4&tr=${tr.length ? encodeURIComponent(tr.join(",")) : "0"}`)
	}
	/** Where the lattice's titles go when nothing but the order decides: the i-th most alike at the i-th place. */
	const inOrder = (ctx: PlayCtx, list: PlayTitle[], spots: Cell[], scale: number, coming = false) => {
		const items: Item[] = []
		for (let i = 0; i < spots.length; i++) {
			const t = list[i]
			if (t) items.push(item(ctx, t, spots[i].x, spots[i].y, scale, i >= 8))
			// A place whose title is on its way is a calm empty place until it is there.
			else if (!ctx.list || coming) items.push(hole(`h${i}`, spots[i].x, spots[i].y, scale))
		}
		return items
	}
	/**
	 * The lattice split into sides around the middle, clockwise from the top: each side's places, nearest first, and
	 * where its caption goes. Places on a border go to the side clockwise of it.
	 */
	const sides = (spots: Cell[], count: number) => {
		const out: { cells: Cell[]; ax: number; ay: number }[] = []
		const span = (Math.PI * 2) / count
		for (let k = 0; k < count; k++) {
			const mid = (k + 0.5) * span
			out.push({ cells: [], ax: Math.sin(mid), ay: -Math.cos(mid) })
		}
		for (const cell of spots) {
			let a = Math.atan2(cell.x / box.w, -cell.y / box.h) + 0.02
			if (a < 0) a += Math.PI * 2
			out[Math.min(count - 1, Math.floor(a / span))].cells.push(cell)
		}
		for (const side of out) side.cells.sort((m, n) => m.d - n.d)
		return out
	}
	/** A side's caption, at the edge of the map in the side's direction. */
	const caption = (side: { ax: number; ay: number }, text: string, color: string) => {
		const m = Math.max(Math.abs(side.ax), Math.abs(side.ay)) || 1
		const x = side.ax / m
		const y = side.ay / m
		// The lower right corner is the control's: the caption there stands beside it.
		const h = x < -0.4 ? "left:0" : x > 0.4 ? (y > 0.4 ? "right:76px" : "right:0") : "left:50%;translate:-50% 0"
		const v = y < -0.4 ? "top:0" : y > 0.4 ? "bottom:0" : "top:50%;margin-top:-.6875rem"
		return `<span class="rm-cap" style="${h};${v};--c:${color}">${text}</span>`
	}
	const spokes = (count: number) => {
		let out = ""
		const span = 360 / count
		for (let k = 0; k < count; k++) {
			const a = (k * span * Math.PI) / 180 - 0.02
			out += `<line x1="0" y1="0" x2="${Math.round(Math.sin(a) * box.w * 2)}" y2="${Math.round(-Math.cos(a) * box.h * 2)}"/>`
		}
		return `<svg class="rm-g rm-sp" viewBox="${-box.w / 2} ${-box.h / 2} ${box.w} ${box.h}" aria-hidden="true">${out}</svg>`
	}
	return { X, WORDS, ZOOM, box, word, emo, low, hue, posterW, cells, guides, ringEdge, stretch, switches, base, flips, passes, around, want, next, open, most, journey, says, info, chips, flip, zoomOf, zoomCtl, zoomAct, place, item, hole, viewOf, html, into, fit, adopt, inOrder, sides, caption, spokes, geoOf }
}

/**
 * roam1, rings. The owner's idea as it was said: closeness to the middle is similarity, and above the map a few of
 * the title's defining traits as switches. Turning one off brings in the titles that are alike without it; the
 * posters that stay glide to their new places.
 */
const roam1: RoamForm = (core, kit) => {
	core.query("&v=4")
	return {
		hint: "Nearer the middle = more alike. Tap a poster to walk.",
		plain: true,
		truth: true,
		carry: () => ({}),
		adopt: kit.adopt,
		fit: kit.fit,
		into: kit.into,
		act: (ctx, name, arg) => {
			if (name === "z") return kit.zoomAct(ctx, arg)
			if (name !== "sw") return false
			kit.flip(ctx, arg)
			return true
		},
		stage: (ctx) => {
			const tr = kit.switches(ctx)
			const names = kit.flips(ctx)
			const scale = kit.ZOOM[kit.zoomOf(ctx)]
			const spots = kit.cells(scale)
			const list = kit.around(ctx, names)
			// Enough for this zoom and the next one out.
			const coming = kit.want(ctx, names, list.length, Math.round(spots.length * 2.2))
			kit.next(ctx, tr, names)
			const items = kit.inOrder(ctx, list, spots, scale, coming)
			const rings = spots.length ? spots[spots.length - 1].b : 0
			const why = names.length
				? `Like <b>${core.esc(ctx.c.t)}</b>, ${kit.says(names)}.${list.length < spots.length && !kit.open(ctx, names) ? ` These ${list.length} are all there are.` : ""}`
				: kit.journey(ctx) || "Turn a switch off or on to change who is around. − shows more."
			return kit.html(
				kit.viewOf(ctx, "roam1", {
					top: kit.chips(ctx, tr),
					bg: `${kit.guides(scale, Math.min(rings, 3))}<span class="rm-key">nearer = more alike</span>`,
					ctl: kit.zoomCtl(ctx, Math.min(list.length, spots.length)),
					why,
					items,
					scale,
				}),
			)
		},
	}
}

/**
 * roam2, spiral. The same order, drawn as what it is: one arm that leaves the middle and winds outward. A sideways
 * drag (or the two arrows) winds the arm on: the nearest titles slide into the middle and less alike ones come in at
 * the outer end. The arm is fed from further pages of the pack, so it does not end.
 */
const roam2: RoamForm = (core, kit) => {
	core.query("&v=4")
	let held = 0
	let dragging = false
	type Spot = { x: number; y: number; s: number; a: number }
	let memo: { id: string; arm: Spot[]; line: string } | null = null
	/**
	 * The arm: a spiral that leaves the middle to the right and turns clockwise, wider than tall on a wide stage.
	 * Posters shrink along it and are set as close as they fit. It runs on past the edge of the map, so the map cuts
	 * it off where there is more.
	 */
	const armOf = () => {
		const id = kit.geoOf()
		if (memo && memo.id === id) return memo
		const w = kit.posterW()
		const h = w * 1.5
		const half = kit.box.h / 2
		// From the middle poster's edge to the first place, and from one turn to the next.
		const wide = Math.max(0.86, Math.min(1.9, (kit.box.w / 2 - 20) / (half - 14)))
		const pitch = h * 0.86
		const r0 = Math.max((w * 1.1 + w) / 2 / wide + 8 / wide, h * 1.03 - pitch / 4 + 12)
		const lift = -Math.min(8, half * 0.04)
		const radius = (a: number) => r0 + (pitch * (a - Math.PI / 2)) / (Math.PI * 2)
		const point = (a: number) => ({ x: wide * radius(a) * Math.sin(a), y: -radius(a) * Math.cos(a) + lift })
		const roomy = kit.box.w >= 600
		// The first places keep the full size: they are the ones a visitor looks at first.
		const size = (u: number) => Math.max(roomy ? 0.6 : 0.5, 1 - (roomy ? 0.024 : 0.05) * Math.max(0, u - 3))
		const arm: Spot[] = []
		let a = Math.PI / 2
		for (let i = 0; i < 40; i++) {
			const s = size(i)
			const before = arm[i - 1]
			if (before)
				for (let n = 0; n < 400; n++) {
					a += 0.015
					const p = point(a)
					if (Math.abs(p.x - before.x) >= ((s + before.s) * w) / 2 + 5 || Math.abs(p.y - before.y) >= ((s + before.s) * h) / 2 + 5) break
				}
			const p = point(a)
			// The arm ends where a poster would lie outside the map altogether.
			if (Math.abs(p.x) - (s * w) / 2 > kit.box.w / 2 - 8 || Math.abs(p.y) - (s * h) / 2 > half - 8) {
				if (arm.length > 6) break
			}
			arm.push({ x: p.x, y: p.y, s, a })
		}
		let line = ""
		for (let t = 0; t <= a + 0.6; t += 0.12) {
			// From the middle out to the first place, then along the arm.
			const p = t < Math.PI / 2 ? { x: (wide * r0 * t) / (Math.PI / 2), y: lift } : point(t)
			line += `${Math.round(p.x)},${Math.round(p.y)} `
		}
		memo = { id, arm, line }
		return memo
	}
	const model = (ctx: PlayCtx) => {
		const tr = kit.switches(ctx)
		const names = kit.flips(ctx)
		const { arm, line } = armOf()
		const list = kit.around(ctx, names)
		const max = Math.max(0, list.length - arm.length)
		const o = Math.max(0, Math.min(max, Number(ctx.e.ui.o) || 0))
		return { tr, names, arm, line, list, max, o }
	}
	const stepOf = (count: number) => Math.max(4, Math.round(count / 2))
	const form: PlayForm = {
		hint: "One arm, most alike first. Drag sideways to wind it on.",
		plain: true,
		truth: true,
		carry: () => ({}),
		adopt: kit.adopt,
		fit: kit.fit,
		into: kit.into,
		act: (ctx, name, arg) => {
			if (name === "sw") {
				kit.flip(ctx, arg)
				ctx.e.ui.o = 0
				return true
			}
			if (name !== "wd") return false
			const m = model(ctx)
			const next = Math.max(0, Math.min(m.max, Math.round(m.o) + Number(arg) * stepOf(m.arm.length)))
			if (next === m.o) return false
			ctx.e.ui.o = next
			return true
		},
		pan: (ctx, _el, s, dx, phase) => {
			const m = model(ctx)
			if (phase === 0) held = m.o
			dragging = phase === 1
			// A finger's width of drag is about one place along the arm. To the left winds outward.
			ctx.e.ui.o = Math.max(0, Math.min(m.max, phase === 2 ? Math.round(m.o) : held - dx / (kit.posterW() * 0.8)))
			const stage = s.querySelector("[data-pl-stage]")
			if (!stage) return
			const again = stage.firstElementChild
			if (phase === 2) again?.removeAttribute("data-r-drag")
			else again?.setAttribute("data-r-drag", "")
			// Only the stage: the posters get their places along the arm, nothing else is touched.
			form.stage(ctx)
			kit.into(stage)
		},
		stage: (ctx) => {
			const m = model(ctx)
			const n = m.arm.length
			// The arm in view, and what two more windings need.
			const coming = kit.want(ctx, m.names, m.list.length, Math.ceil(m.o) + n * 3)
			kit.next(ctx, m.tr, m.names)
			const at = (u: number) => {
				// A place along the arm: between two of its places, or on its way into the middle.
				if (u <= 0) {
					const first = m.arm[0] ?? { x: 0, y: 0, s: 1 }
					const f = Math.max(0, 1 + u)
					return { x: first.x * f, y: first.y * f, s: first.s * (0.6 + 0.4 * f), o: f }
				}
				const i = Math.min(n - 1, Math.floor(u))
				const a = m.arm[i]
				const b = m.arm[Math.min(n - 1, i + 1)]
				const f = Math.min(1, u - i)
				return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, s: a.s + (b.s - a.s) * f, o: u > n - 1 ? Math.max(0, n - u) : 1 }
			}
			const items: ReturnType<RoamKit["item"]>[] = []
			const from = Math.max(0, Math.floor(m.o) - (dragging ? 1 : 0))
			const to = Math.min(m.list.length - 1, Math.ceil(m.o) + n - 1)
			for (let j = from; j <= to; j++) {
				const u = j - m.o
				if (u <= -1 || u > n - 0.01) continue
				const p = at(u)
				items.push(kit.item(ctx, m.list[j], p.x, p.y, p.s, j - from >= 8, "", p.o < 1 ? `;opacity:${Math.round(p.o * 100) / 100}` : ""))
			}
			if (!ctx.list || (coming && m.list.length < n)) m.arm.forEach((spot, i) => i >= m.list.length && items.push(kit.hole(`h${i}`, spot.x, spot.y, spot.s)))
			const first = Math.round(m.o) + 1
			const lastShown = Math.min(m.list.length, Math.round(m.o) + n)
			const more = m.o < m.max || kit.open(ctx, m.names)
			const why = m.names.length
				? `Like <b>${core.esc(ctx.c.t)}</b>, ${kit.says(m.names)}.`
				: kit.journey(ctx) || "The arm starts with the most alike title and winds outward: along it, less and less alike."
			return kit.html(
				kit.viewOf(ctx, "roam2", {
					top: kit.chips(ctx, m.tr),
					bg: `<svg class="rm-g rm-arm" viewBox="${-kit.box.w / 2} ${-kit.box.h / 2} ${kit.box.w} ${kit.box.h}" aria-hidden="true"><polyline points="${m.line}"/></svg>`,
					ctl: `<div class="rm-z rm-wd" role="group" aria-label="Wind the arm"><button type="button" data-pl-act="wd" data-arg="-1" aria-label="Wind back: more alike"${
						m.o <= 0 ? " disabled" : ""
					}>‹</button><span>${m.list.length ? `${first}–${lastShown}` : ""}</span><button type="button" data-pl-act="wd" data-arg="1" aria-label="Wind on: further out"${more ? "" : " disabled"}>›</button></div>`,
					why,
					items,
					scale: 1,
				}),
			)
		},
	}
	return form
}

/**
 * roam3, open field. Free roam that leaves the page's scrolling alone: the map is much wider than the stage and
 * pans sideways with the browser's own scrolling (a finger, a trackpad, the arrows, or a drag with the mouse), and
 * a vertical swipe is the page's. The middle is where you stand, every column further out is less alike, on both
 * sides. No switches: each poster says the one way it differs most.
 */
const roam3: RoamForm = (core, kit) => {
	core.query("&v=4&tr=0")
	const MOST = 1320
	let view = 0
	let from = 0
	let stood: unknown = null
	let home = true
	type Scroller = HTMLElement & { __on?: string }
	const world = () => {
		// Wide enough for every title the pack can grow to: a column holds three or four posters.
		const w = kit.posterW()
		const room = (kit.box.h / 2 - 1 - w * 0.75) / (w * 1.5 * 1.0715)
		const perColumn = Math.max(1, (2 * Math.floor(room) + 1 + 2 * Math.floor(room + 0.5)) / 2)
		return Math.max(kit.box.w, Math.ceil(MOST / perColumn + 4) * w * 1.107)
	}
	const scroller = (s: Element) => s.querySelector("[data-r-sc]") as Scroller | null
	/** Turns the browser's scrolling on, with the title you stand on in the middle. */
	const arm = (s: Element) => {
		const sc = scroller(s)
		if (!sc || !sc.clientWidth) return
		if (sc.__on !== kit.geoOf() || home) {
			sc.__on = kit.geoOf()
			home = false
			sc.setAttribute("data-r-on", "")
			sc.scrollLeft = (world() - sc.clientWidth) / 2
			view = 0
		}
	}
	const form: PlayForm = {
		hint: "Nearer the middle = more alike. Swipe sideways to roam.",
		plain: true,
		truth: true,
		carry: () => ({}),
		adopt: kit.adopt,
		fit: kit.fit,
		into: kit.into,
		after: (s) => arm(s),
		act: (_ctx, name, arg, _el, s) => {
			const sc = scroller(s)
			if (!sc) return false
			if (name === "home") sc.scrollTo({ left: (world() - sc.clientWidth) / 2, behavior: "smooth" })
			if (name === "pg") sc.scrollBy({ left: Number(arg) * sc.clientWidth * 0.75, behavior: "smooth" })
			return false
		},
		pan: (_ctx, _el, s, dx, phase) => {
			const sc = scroller(s)
			if (!sc) return
			if (phase === 0) from = sc.scrollLeft
			sc.scrollLeft = from - dx
		},
		input: (ctx, el, s) => {
			const sc = el as Scroller
			if (!sc.hasAttribute("data-r-sc") || !sc.__on) return
			const x = sc.scrollLeft + sc.clientWidth / 2 - world() / 2
			// A new picture when the view has moved a third of the stage: the posters near it are put in, the far ones out.
			if (Math.abs(x - view) < kit.box.w / 3) return
			view = x
			const stage = s.querySelector("[data-pl-stage]")
			if (!stage) return
			form.stage(ctx)
			kit.into(stage)
		},
		stage: (ctx) => {
			kit.switches(ctx, true)
			// Another title in the middle: the view starts over there.
			if (stood !== ctx.e) {
				stood = ctx.e
				view = 0
				home = true
			}
			const wide = world()
			const spots = kit.cells(1, wide, 1)
			const list = kit.around(ctx, [])
			// Only what is near the view is in the document.
			const reach = kit.box.w * 1.1
			let furthest = 0
			const items: ReturnType<RoamKit["item"]>[] = []
			for (let i = 0; i < spots.length; i++) {
				const cell = spots[i]
				if (Math.abs(cell.x - view) > reach) continue
				const t = list[i]
				if (i > furthest) furthest = i
				if (t) {
					const d = ctx.c.s && t.s ? kit.most(ctx.c, t, 3) : null
					items.push(
						kit.item(ctx, t, cell.x, cell.y, 1, i >= 8, d ? `<span class="rm-lb" style="--c:${kit.hue(d.k)}"><i>${d.d > 0 ? "more" : "less"}</i>${core.esc(kit.low(d.k))}</span>` : ""),
					)
				} else if (!ctx.list || kit.open(ctx, [])) items.push(kit.hole(`h${i}`, cell.x, cell.y, 1))
			}
			kit.want(ctx, [], list.length, furthest + Math.round(spots.length ? (kit.box.w / (kit.posterW() * 1.107)) * 8 : 0))
			const away = Math.abs(view) > kit.box.w * 0.4
			const why = kit.journey(ctx) || "The middle is where you stand. Every column further out is less alike, on both sides."
			return kit.html(
				kit.viewOf(ctx, "roam3", {
					top: `<p class="rm-say"><span>← less alike</span><b>most alike in the middle</b><span>less alike →</span></p>`,
					bg: "",
					ctl: `<button type="button" class="rm-pg" data-pl-act="pg" data-arg="-1" aria-label="Pan to the left">‹</button><button type="button" class="rm-pg" data-pl-act="pg" data-arg="1" aria-label="Pan to the right">›</button>${
						away ? `<button type="button" class="rm-home" data-pl-act="home">${view < 0 ? "" : "← "}Back to ${core.esc(ctx.c.t)}${view < 0 ? " →" : ""}</button>` : ""
					}`,
					why,
					items,
					scale: 1,
					world: `;width:${Math.round(wide)}px`,
				}),
				true,
			)
		},
	}
	return form
}

/**
 * roam4, neighborhoods. The angle is who a title is alike with: the titles around are sorted into groups of titles
 * that differ from the middle the same way, each group gets a side, and the side's caption says what the group
 * has more or less of. Within a side, nearer is more alike. The fingerprint is in the captions; there is no control.
 */
const roam4: RoamForm = (core, kit) => {
	core.query("&v=4&tr=0")
	const { val } = core
	type Group = { members: PlayTitle[]; mean: number[]; key: string; text: string; color: string }
	/** Groups of titles that differ from the middle the same way: k-means on the plain traits, seeded far apart. */
	const groups = (c: PlayTitle, pool: PlayTitle[], count: number): Group[] => {
		const vec = (t: PlayTitle) => kit.WORDS.map((k) => val(t, k) - val(c, k))
		const vs = pool.map(vec)
		const dist = (a: number[], b: number[]) => {
			let sum = 0
			for (let i = 0; i < a.length; i++) sum += (a[i] - b[i]) * (a[i] - b[i])
			return sum
		}
		const means: number[][] = []
		if (vs.length) means.push(vs[0])
		while (means.length < count && means.length < vs.length) {
			let best = 0
			let far = -1
			vs.forEach((v, i) => {
				let near = 1e9
				for (const m of means) near = Math.min(near, dist(v, m))
				if (near > far) {
					far = near
					best = i
				}
			})
			means.push(vs[best])
		}
		let of: number[] = []
		for (let round = 0; round < 6; round++) {
			of = vs.map((v) => {
				let best = 0
				for (let m = 1; m < means.length; m++) if (dist(v, means[m]) < dist(v, means[best])) best = m
				return best
			})
			means.forEach((_, m) => {
				const mine = vs.filter((_v, i) => of[i] === m)
				if (mine.length) means[m] = mine[0].map((_x, d) => mine.reduce((sum, v) => sum + v[d], 0) / mine.length)
			})
		}
		const out: Group[] = means.map((mean, m) => ({ members: pool.filter((_t, i) => of[i] === m), mean, key: "", text: "", color: "#9ca3af" }))
		// The captions: the strongest mean difference first, and no two sides with the same words.
		const picks: { g: number; k: number; v: number }[] = []
		out.forEach((group, g) => group.mean.forEach((v, k) => picks.push({ g, k, v })))
		picks.sort((a, b) => Math.abs(b.v) - Math.abs(a.v))
		const used: Record<string, boolean> = {}
		for (const pick of picks) {
			const group = out[pick.g]
			const key = `${kit.WORDS[pick.k]}${pick.v > 0 ? "+" : "-"}`
			if (group.key || used[key] || Math.abs(pick.v) < 1) continue
			used[key] = true
			group.key = key
			group.color = kit.hue(kit.WORDS[pick.k])
			group.text = `<i>${kit.emo(kit.WORDS[pick.k])} ${pick.v > 0 ? "more" : "less"}</i> ${core.esc(kit.low(kit.WORDS[pick.k]))}`
		}
		for (const group of out)
			if (!group.key) {
				group.key = "same"
				group.text = "<i>much the</i> same mix"
			}
		return out
	}
	let memo: { e: unknown; l: unknown; n: number; id: string; out: ReturnType<typeof lay> } | null = null
	const lay = (ctx: PlayCtx, scale: number) => {
		const spots = kit.cells(scale)
		const count = kit.box.w >= 600 ? 6 : 4
		const parts = kit.sides(spots, count)
		const list = kit.around(ctx, [])
		// The groups are made from the sixty most alike titles, whatever the zoom, and every title further out joins
		// the group it is nearest to: a side is filled from further away, and nothing changes sides when more arrive.
		const known = list.filter((t) => t.s)
		const found = ctx.c.s ? groups(ctx.c, known.slice(0, 60), count) : []
		if (found.length)
			for (const t of known.slice(60)) {
				let best = 0
				let near = 1e9
				found.forEach((group, g) => {
					let sum = 0
					for (let k = 0; k < kit.WORDS.length; k++) {
						const d = val(t, kit.WORDS[k]) - val(ctx.c, kit.WORDS[k]) - group.mean[k]
						sum += d * d
					}
					if (sum < near) {
						near = sum
						best = g
					}
				})
				found[best].members.push(t)
			}
		// A side keeps its caption from step to step where the caption comes up again.
		const before = (ctx.st.mem.sd as Record<string, number> | undefined) ?? {}
		const seat: (Group | undefined)[] = parts.map(() => undefined)
		const rest: Group[] = []
		for (const group of found) {
			const at = before[group.key]
			if (at !== undefined && at < seat.length && !seat[at]) seat[at] = group
			else rest.push(group)
		}
		rest.sort((a, b) => b.members.length - a.members.length)
		for (let i = 0; i < seat.length; i++) if (!seat[i]) seat[i] = rest.shift()
		const now: Record<string, number> = {}
		seat.forEach((group, i) => {
			if (group) now[group.key] = i
		})
		ctx.st.mem.sd = now
		return { spots, parts, seat, list }
	}
	return {
		hint: "Each side is a neighborhood. Nearer = more alike.",
		plain: true,
		truth: true,
		carry: () => ({}),
		adopt: kit.adopt,
		fit: kit.fit,
		into: kit.into,
		act: (ctx, name, arg) => (name === "z" ? kit.zoomAct(ctx, arg) : false),
		stage: (ctx) => {
			kit.switches(ctx, true)
			const scale = kit.ZOOM[kit.zoomOf(ctx)]
			const id = `${kit.geoOf()}|${scale}`
			const length = ctx.list?.length ?? 0
			if (!memo || memo.e !== ctx.e || memo.l !== ctx.list || memo.n !== length || memo.id !== id) memo = { e: ctx.e, l: ctx.list, n: length, id, out: lay(ctx, scale) }
			const { spots, parts, seat, list } = memo.out
			kit.want(ctx, [], list.length, Math.round(spots.length * 3))
			const items: ReturnType<RoamKit["item"]>[] = []
			let bg = kit.spokes(parts.length)
			let shown = 0
			const missing: ReturnType<RoamKit["hole"]>[] = []
			parts.forEach((side, i) => {
				const group = seat[i]
				side.cells.forEach((cell, n) => {
					const t = group?.members[n]
					if (t) {
						shown++
						items.push(kit.item(ctx, t, cell.x, cell.y, scale, n >= 2, "", `;--oc:${group?.color ?? "#fff"};--sd:${i}`))
					} else if (!ctx.list) items.push(kit.hole(`h${i}-${n}`, cell.x, cell.y, scale))
					else missing.push(kit.hole(`h${i}-${n}`, cell.x, cell.y, scale))
				})
				if (group) bg += kit.caption(side, group.text, group.color)
			})
			// A side with places left is filled from further away: more of the neighborhood is asked for, and the places
			// are calm empty ones until it is there.
			if (missing.length && kit.want(ctx, [], list.length, list.length + 200)) for (const entry of missing) items.push(entry)
			return kit.html(
				kit.viewOf(ctx, "roam4", {
					top: `<p class="rm-say"><b>Neighborhoods around ${core.esc(ctx.c.t)}</b><span>nearer = more alike</span></p>`,
					bg,
					ctl: kit.zoomCtl(ctx, shown),
					why: kit.journey(ctx) || "Titles that are alike each other share a side. The caption says what that side has more or less of.",
					items,
					scale,
				}),
			)
		},
	}
}

/**
 * roam5, with and without. The switches of roam1 without the switching: four sides, one for the most alike titles
 * as they come and one per switch flipped ("without spectacle", "with comedy"), all visible at once, each with the
 * nearest titles that pass. The sides keep their meaning and place for the whole walk.
 */
const roam5: RoamForm = (core, kit) => {
	core.query("&v=4")
	return {
		hint: "Four sides, one trait changed on three of them.",
		plain: true,
		truth: true,
		carry: () => ({}),
		adopt: kit.adopt,
		fit: kit.fit,
		into: kit.into,
		act: (ctx, name, arg) => (name === "z" ? kit.zoomAct(ctx, arg) : false),
		stage: (ctx) => {
			const tr = kit.switches(ctx)
			const scale = kit.ZOOM[kit.zoomOf(ctx)]
			const spots = kit.cells(scale)
			const parts = kit.sides(spots, 4)
			// Clockwise from the top: the first switch, the second, the third, and the most alike at the upper left.
			const order: string[][] = [tr[0] ? [tr[0]] : [], tr[1] ? [tr[1]] : [], tr[2] ? [tr[2]] : [], []]
			const used: Record<string, boolean> = {}
			const items: ReturnType<RoamKit["item"]>[] = []
			let bg = kit.spokes(4)
			let shown = 0
			// The switched sides choose first: their titles are the rarer ones.
			for (const i of [0, 1, 2, 3]) {
				const names = order[i]
				if (i < 3 && !names.length) continue
				const side = parts[i]
				const key = names[0]?.slice(0, -1) ?? ""
				const color = key ? kit.hue(key) : "#fde68a"
				const list = kit.around(ctx, names).filter((t) => !used[t.k])
				kit.want(ctx, names, list.length, side.cells.length * 2 + 4)
				side.cells.forEach((cell, n) => {
					const t = list[n]
					if (t) {
						used[t.k] = true
						shown++
						items.push(kit.item(ctx, t, cell.x, cell.y, scale, n >= 2, "", `;--oc:${color};--sd:${i}`))
					} else if (!ctx.list) items.push(kit.hole(`h${i}-${n}`, cell.x, cell.y, scale))
				})
				bg += kit.caption(side, names.length ? `<i>${kit.emo(key)} ${names[0].endsWith("+") ? "with" : "without"}</i> ${core.esc(kit.low(key))}` : "<i>most</i> alike", color)
			}
			return kit.html(
				kit.viewOf(ctx, "roam5", {
					top: `<p class="rm-say"><b>Like ${core.esc(ctx.c.t)}, four ways</b><span>nearer = more alike</span></p>`,
					bg,
					ctl: kit.zoomCtl(ctx, shown),
					why: kit.journey(ctx) || "One side is the most alike as they come. The other three change one trait each.",
					items,
					scale,
				}),
			)
		},
	}
}

export const ROAM_FORMS: Record<string, RoamForm> = { roam1, roam2, roam3, roam4, roam5 }
