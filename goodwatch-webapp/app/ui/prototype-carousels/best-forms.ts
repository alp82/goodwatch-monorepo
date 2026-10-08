// PROTOTYPE for "Prototype native-scroll carousels on title pages", ninth round. Throwaway code: not for production.
//
// Three forms that combine what the owner kept from eight rounds: one thumb gesture that moves continuously (the
// seventh round's scrub strip), taps that answer at once, directions that keep their meaning for a whole walk (the
// fourth and fifth rounds' rings), and the fingerprint on screen as the thing you play with, without a picker.
// They share four traits per walk, in plain words, chosen for the page's title (best-meta.ts), and a pack that
// reaches further along exactly those traits (server/prototype-play.server.ts), so that a trait leads to other
// titles and not to the same crowd in another order.
// - best1, trait strip: one trait at a time, less to the left and more to the right. The four bars are the
//   fingerprint of the title under the marker and the switch at once. Posters shrink away from the marker, and a
//   small map of the whole strip is the scrubber.
// - best2, trait compass: three traits as six directions on a honeycomb, all visible, near and far. The cells
//   between two directions hold the titles that are both.
// - best3, more and less: four steppers. A plus or a minus bends the road of similar titles that way, two taps
//   make a combination, and the road keeps its bend while you walk.
//
// `bestKit` holds what the forms share. Both it and each form are functions with no outside references, because
// they run as the page's inline script (see play-engine.ts).
import type { BestExtra } from "~/ui/prototype-carousels/best-meta"
import type {
	PlayCore,
	PlayCtx,
	PlayForm,
	PlayState,
	PlayTitle,
} from "~/ui/prototype-carousels/play-engine"

export type BestKit = ReturnType<typeof bestKit>
type BestForm = (core: PlayCore, kit: BestKit) => PlayForm
/** A place on a strip. `g` starts a group (a level), `l` is the group's label. */
interface BestItem {
	t: PlayTitle
	g?: boolean
	l?: string
}
type Strip = HTMLElement

export function bestKit(core: PlayCore, X: BestExtra) {
	const { esc, val } = core
	// A poster's place on a strip and the extra room before a new level: the strip's positions are computed from
	// them, so nothing is measured (best-css.ts has the same numbers).
	const PITCH = 38
	const GAP = 12
	const word = (key: string) => X.w[key]?.[0] ?? core.M.traits[key]?.l ?? key
	const emo = (key: string) => X.w[key]?.[1] ?? core.M.traits[key]?.e ?? ""
	const low = (key: string) => word(key).toLowerCase()
	const nm = (key: string) => `<i>${emo(key)}</i> ${esc(word(key))}`
	const hue = (key: string) => core.M.traits[key]?.c ?? "#fbbf24"

	/** The walk's traits: the ones the page title's pack was widened along. Every later pack is asked for the same. */
	const traits = (ctx: PlayCtx, mode: string): string[] => {
		const mem = ctx.st.mem
		if (!mem.tr) {
			const own = core.packTraits(ctx.root.k)
			if (own?.length) mem.tr = own
		}
		core.query(mem.tr ? `&v=2&tr=${mem.tr.join(",")}` : `&v=2${mode}`)
		return (mem.tr as string[] | undefined) ?? []
	}
	const adopt = (st: PlayState, stage: Element) => {
		try {
			const kept = stage.firstElementChild?.getAttribute("data-b-mem")
			if (kept) Object.assign(st.mem, JSON.parse(kept))
		} catch {}
		if (st.mem.tr) core.query(`&v=2&tr=${(st.mem.tr as string[]).join(",")}`)
	}
	const memAttr = (ctx: PlayCtx) => ` data-b-mem="${esc(JSON.stringify(ctx.st.mem))}"`

	/** The titles a form can show: where you stand, the neighborhood nearest first, where you came from, the page. */
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
	/** One trait as a ladder: every level that has titles, lowest first, at most `cap` per level, nearest first. */
	const ladder = (ctx: PlayCtx, key: string, cap: number): BestItem[] => {
		const pin: Record<string, boolean> = {}
		pin[ctx.c.k] = true
		pin[ctx.root.k] = true
		if (ctx.prev) pin[ctx.prev.k] = true
		if (ctx.e.ui.f) pin[ctx.e.ui.f] = true
		const by: PlayTitle[][] = []
		for (let level = 0; level <= 10; level++) by.push([])
		for (const t of pool(ctx)) by[Math.max(0, Math.min(10, val(t, key)))].push(t)
		const items: BestItem[] = []
		by.forEach((group, level) => {
			let free = cap
			let first = true
			for (const t of group) {
				if (!pin[t.k] && free-- <= 0) continue
				items.push(first ? { t, g: true, l: String(level) } : { t })
				first = false
			}
		})
		return items
	}
	const xs = (items: BestItem[]) => {
		let x = -PITCH / 2
		return items.map((item, i) => {
			x += PITCH + (item.g && i ? GAP : 0)
			return x
		})
	}

	/** How a title differs from the one you stand on, on the walk's traits, in a few plain words. */
	const differs = (ctx: PlayCtx, from: PlayTitle, t: PlayTitle, lead: string[] = []) => {
		const keys = lead.concat(((ctx.st.mem.tr as string[]) ?? []).filter((key) => lead.indexOf(key) < 0))
		const told: string[] = []
		for (const key of keys) {
			const d = val(t, key) - val(from, key)
			const led = lead.indexOf(key) >= 0
			if (!d || (!led && Math.abs(d) < 2)) continue
			const text = `${d > 0 ? "more" : "less"} ${esc(low(key))}`
			told.push(led ? `<b>${text}</b> <small>${val(t, key)}, here ${val(from, key)}</small>` : text)
		}
		return told
	}
	const sentence = (parts: string[]) => {
		const text = parts.join(", ")
		return text.charAt(0) === "<" ? text.replace(/^<b>(.)/, (_, ch) => `<b>${ch.toUpperCase()}`) : text.charAt(0).toUpperCase() + text.slice(1)
	}
	/** Where a walk has led, against the title it came from. */
	const journey = (ctx: PlayCtx) => {
		if (!ctx.prev?.s) return ""
		const told = differs(ctx, ctx.prev, ctx.c)
		return `From ${esc(ctx.prev.t)}: ${told.length ? told.join(", ") : "much the same mix"}.`
	}

	/** The card of the title under the marker: its poster, name, a reason, a way to walk there, and "Open". */
	const head = (ctx: PlayCtx, t: PlayTitle, reason: string) => {
		const here = t.k === ctx.c.k
		const came = Boolean(ctx.prev && t.k === ctx.prev.k)
		const step = ` data-pl-step="${t.k}" data-t="${esc(t.t)}" data-y="${esc(t.y)}" data-pl-far=""${came ? ' data-pl-came=""' : ""}`
		const img = `<img alt="${here ? "" : esc(t.t)}" decoding="async" src="${esc(core.src(t.p))}">`
		const open =
			t.k === ctx.root.k
				? '<span class="bs-this">this page</span>'
				: `<a class="bs-open" data-pl-nav=""${here ? ' data-pl-open=""' : ""} href="${esc(core.href(t))}">Open<span class="pl-sr"> ${esc(t.t)}</span></a>`
		return `${here ? `<span class="bs-big bs-here">${img}</span>` : `<button type="button" class="bs-big"${step}>${img}</button>`}<div class="bs-tx"><p class="bs-nm"><b>${esc(
			t.t,
		)}</b><small>${esc(t.y)}${t.k.charAt(0) === "s" ? " · Show" : ""}</small></p><p class="bs-rs">${reason}</p></div><p class="bs-ac">${
			here
				? '<span class="bs-you">You are here</span>'
				: `<button type="button" class="bs-cta"${step}>${came ? "← Back to here" : "Explore from here ›"}</button>`
		}${open}</p>`
	}
	/** The strip: posters in a row that scrolls sideways, with the marker where `mk` says. */
	const rail = (ctx: PlayCtx, items: BestItem[], fk: string, empty = "") => {
		const x = xs(items)
		let at = 0
		items.forEach((item, i) => {
			if (item.t.k === fk) at = i
		})
		const cells = items
			.map((item, i) => {
				const t = item.t
				const attrs = ` data-k="${t.k}" data-x="${x[i]}"${item.g && i ? ' data-g=""' : ""}${t.k === fk ? ' data-on=""' : ""}`
				const pin = t.k === ctx.c.k ? '<span class="bs-pin">you</span>' : t.k === ctx.root.k ? '<span class="bs-pin bs-pg">page</span>' : ""
				return t.k === ctx.c.k
					? `<span class="bs-i bs-me"${attrs}><img alt="" decoding="async" src="${esc(core.src(t.p))}">${pin}</span>`
					: core.poster(t, {
							cls: "bs-i",
							came: Boolean(ctx.prev && t.k === ctx.prev.k),
							inner: pin,
							attrs: `${attrs}${Math.abs(i - at) > 4 ? ' data-pl-far=""' : ""}`,
						})
			})
			.join("")
		return `<div class="bs-rail"><div class="bs-strip" data-b-strip="" data-pl-input="">${cells}</div><span class="bs-mark" aria-hidden="true"></span>${
			empty ? `<p class="bs-none">${empty}</p>` : ""
		}<button type="button" class="bs-nd" data-pl-act="nd" data-arg="-1" aria-label="One title to the left">‹</button><button type="button" class="bs-nd" data-pl-act="nd" data-arg="1" aria-label="One title to the right">›</button></div>`
	}
	/** The whole strip in small: a cell per title in the strip's order, the level under the first of each level. */
	const map = (ctx: PlayCtx, items: BestItem[], fk: string, name: string) => {
		const x = xs(items)
		let at = 0
		let last = -1
		const cells = items
			.map((item, i) => {
				const t = item.t
				if (t.k === fk) at = i
				const level = item.l === undefined ? last : Number(item.l)
				const skipped = item.g && last >= 0 && level - last > 1
				last = level
				return `<i data-k="${t.k}" data-x="${x[i]}"${item.g ? ` data-l="${esc(item.l)}"` : ""}${skipped ? ' data-skip=""' : ""}${t.k === fk ? ' data-on=""' : ""}${
					t.k === ctx.c.k ? ' data-me=""' : t.k === ctx.root.k ? ' data-pg=""' : ""
				}></i>`
			})
			.join("")
		return `<div class="bs-map" data-b-map="" data-pl-drag="" role="group" aria-label="${esc(`All ${items.length} titles by ${name}. Drag to move along.`)}" style="--n:${items.length};--i:${at}"><span class="bs-win" aria-hidden="true"></span>${cells}</div>`
	}
	const stripOf = (s: Element) => s.querySelector("[data-b-strip]") as Strip | null
	/** The title under the marker of a strip. */
	const under = (strip: Strip) => {
		const left = strip.scrollLeft
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
		return key
	}
	const mark = (s: Element, key: string) => {
		const strip = stripOf(s)
		strip?.querySelector("[data-on]")?.removeAttribute("data-on")
		strip?.querySelector(`[data-k="${key}"]`)?.setAttribute("data-on", "")
		const small = s.querySelector("[data-b-map]") as HTMLElement | null
		if (!small) return
		small.querySelector("[data-on]")?.removeAttribute("data-on")
		const cells = small.querySelectorAll("[data-k]")
		for (let i = 0; i < cells.length; i++)
			if (cells[i].getAttribute("data-k") === key) {
				cells[i].setAttribute("data-on", "")
				small.style.setProperty("--i", String(i))
			}
	}
	/** The arrows beside a strip: with a mouse there may be no way to scroll sideways. */
	const nudge = (s: Element, by: number) => {
		const strip = stripOf(s)
		const items = strip ? strip.querySelectorAll("[data-k]") : []
		for (let i = 0; i < items.length; i++) {
			if (!items[i].hasAttribute("data-on")) continue
			const to = items[i + by]
			if (strip && to) strip.scrollLeft = Number(to.getAttribute("data-x"))
			break
		}
	}
	/** After a draw: the focused title under the marker, and how much of the strip the small map's window covers. */
	const settle = (s: Element) => {
		const strip = stripOf(s)
		const mine = strip?.querySelector("[data-on]")
		if (strip && mine) strip.scrollLeft = Number(mine.getAttribute("data-x"))
		const small = s.querySelector("[data-b-map]") as HTMLElement | null
		if (strip && small) small.style.setProperty("--vis", String(Math.max(1, Math.round(strip.clientWidth / PITCH))))
	}

	return { X, PITCH, word, emo, low, nm, hue, traits, adopt, memAttr, pool, ladder, xs, differs, sentence, journey, head, rail, map, stripOf, under, mark, nudge, settle }
}

/**
 * best1, trait strip: the seventh round's strip along one trait with its real levels (the eighth round's honest
 * ruler), and three things changed. The traits are four, chosen for the title, and they are the bars of the card:
 * a tap on a bar lines the strip up along it, and while you scrub the bars show the fingerprint of whatever is
 * under the marker. Posters shrink away from the marker, so about ten are in view on a phone. A small map shows the
 * whole strip with where you stand, and dragging it scrubs.
 */
const best1: BestForm = (core, kit) => {
	core.query("&v=2")
	let memo: { e: unknown; l: unknown; a: string; items: ReturnType<BestKit["ladder"]> } | null = null
	const model = (ctx: PlayCtx) => {
		const mem = ctx.st.mem
		const tr = kit.traits(ctx, "")
		if (!mem.a || tr.indexOf(mem.a) < 0) {
			// The trait with the most to see on both sides of where you stand.
			let best = -1
			for (const key of tr) {
				const own = core.val(ctx.c, key)
				let less = 0
				let more = 0
				for (const t of ctx.list ?? []) {
					if (core.val(t, key) < own) less++
					else if (core.val(t, key) > own) more++
				}
				const value = 2 * Math.min(less, more) + Math.max(less, more)
				if (value > best) {
					best = value
					mem.a = key
				}
			}
		}
		const a = (mem.a as string) ?? ""
		if (!memo || memo.e !== ctx.e || memo.l !== ctx.list || memo.a !== a)
			memo = { e: ctx.e, l: ctx.list, a, items: a ? kit.ladder(ctx, a, 3) : [{ t: ctx.c }] }
		return { tr, a, items: memo.items }
	}
	const reason = (ctx: PlayCtx, t: PlayTitle, a: string) => {
		if (t.k !== ctx.c.k) {
			const told = kit.differs(ctx, ctx.c, t, [a])
			return told.length
				? `${kit.sentence(told)} than ${core.esc(ctx.c.t)}.`
				: `The same ${core.esc(kit.low(a))} as ${core.esc(ctx.c.t)}, and much the same mix.`
		}
		return kit.journey(ctx) || "Swipe the posters below, or tap a trait to sort them by it."
	}
	const bars = (ctx: PlayCtx, t: PlayTitle, tr: string[], a: string) =>
		tr
			.map(
				(key) =>
					`<button type="button" class="bs-b" data-pl-act="tr" data-arg="${key}" data-b-bar="${key}" aria-pressed="${key === a}" style="--c:${kit.hue(key)}"><em>${kit.nm(
						key,
					)}</em><s><u style="width:${core.val(t, key) * 10}%"></u><q style="left:${core.val(ctx.c, key) * 10}%"></q></s><b>${core.val(t, key)}</b></button>`,
			)
			.join("")
	const show = (ctx: PlayCtx, s: Element, t: PlayTitle) => {
		const m = model(ctx)
		ctx.e.ui.f = t.k
		const head = s.querySelector("[data-b-head]")
		if (head) {
			head.setAttribute("data-k", t.k)
			head.innerHTML = kit.head(ctx, t, reason(ctx, t, m.a))
		}
		// The bars stay and move: the fingerprint changes under the thumb.
		const all = s.querySelectorAll("[data-b-bar]")
		for (let i = 0; i < all.length; i++) {
			const v = core.val(t, all[i].getAttribute("data-b-bar") ?? "")
			const fill = all[i].querySelector("u") as HTMLElement | null
			const number = all[i].querySelector("b")
			if (fill) fill.style.width = `${v * 10}%`
			if (number) number.textContent = String(v)
		}
		kit.mark(s, t.k)
	}
	return {
		hint: "Swipe the posters. Tap a trait to sort by it.",
		plain: true,
		settle: false,
		fly: false,
		carry: () => ({}),
		adopt: kit.adopt,
		act: (ctx, name, arg, _el, s) => {
			if (name === "nd") {
				kit.nudge(s, Number(arg))
				return false
			}
			if (name !== "tr" || ctx.st.mem.a === arg) return false
			ctx.st.mem.a = arg
			return true
		},
		input: (ctx, el, s) => {
			if (!el.hasAttribute("data-b-strip")) return
			const key = kit.under(el as HTMLElement)
			if (!key || s.querySelector("[data-b-head]")?.getAttribute("data-k") === key) return
			const item = model(ctx).items.find((entry) => entry.t.k === key)
			if (item) show(ctx, s, item.t)
		},
		drag: (_ctx, el, s, x) => {
			const cells = el.querySelectorAll("[data-k]")
			const strip = kit.stripOf(s)
			const width = (el as HTMLElement).clientWidth
			if (!cells.length || !strip || !width) return
			const to = cells[Math.max(0, Math.min(cells.length - 1, Math.floor((x / width) * cells.length)))]
			strip.scrollLeft = Number(to.getAttribute("data-x"))
		},
		after: (s) => kit.settle(s),
		stage: (ctx) => {
			const m = model(ctx)
			const kept = ctx.e.ui.f ? m.items.find((item) => item.t.k === ctx.e.ui.f)?.t : undefined
			const f = kept ?? ctx.c
			if (!kept) ctx.e.ui.f = undefined
			const own = m.a ? core.val(ctx.c, m.a) : 0
			return `<div class="bs bs1"${kit.memAttr(ctx)}><b hidden data-pl-here="">${core.esc(ctx.c.t)}</b><div class="bs-f"><div class="bs-hd" data-b-head="" data-k="${f.k}">${kit.head(
				ctx,
				f,
				reason(ctx, f, m.a),
			)}</div><div class="bs-bars" role="group" aria-label="Line the titles up by a trait">${bars(ctx, f, m.tr, m.a)}</div></div>${kit.rail(ctx, m.items, f.k)}${
				m.a
					? `<p class="bs-cap"><span>← less</span><b data-pl-why="">${kit.nm(m.a)} · ${core.esc(ctx.c.t)} has ${own} of 10</b><span>more →</span></p>${kit.map(
							ctx,
							m.items,
							f.k,
							kit.word(m.a),
						)}`
					: ""
			}<span hidden>${core.center(ctx)}</span></div>`
		},
	}
}

/**
 * best2, trait compass: the fifth round's six ways as a honeycomb. Three traits, each with "more" on one side of
 * the middle and "less" on the opposite side, for the whole walk. The first ring is a bit, the second is much, and
 * the cells between two directions hold titles that went both ways: a combination without a mode. The title you
 * came from sits on the opposite side of the step.
 */
const best2: BestForm = (core, kit) => {
	core.query("&v=2&m=mid")
	type XY = [number, number]
	// In units of the column and row pitch, from the middle. Up, upper right, lower right; the opposites are mirrors.
	const VEC: XY[] = [
		[0, -1],
		[1, -0.5],
		[1, 0.5],
	]
	const ARROW = ["↑", "↗", "↘", "↓", "↙", "↖"]
	interface Dir {
		id: string
		k: string
		s: 1 | -1
		v: XY
		arrow: string
	}
	const dirsOf = (tr: string[]) => {
		const out: Dir[] = []
		tr.slice(0, 3).forEach((k, i) => {
			out.push({ id: `${k}+`, k, s: 1, v: VEC[i], arrow: ARROW[i] })
		})
		tr.slice(0, 3).forEach((k, i) => {
			out.push({ id: `${k}-`, k, s: -1, v: [-VEC[i][0], -VEC[i][1]], arrow: ARROW[i + 3] })
		})
		return out
	}
	const place = (v: XY) => `--x:${v[0]};--y:${v[1]}`
	const why = (ctx: PlayCtx) => kit.journey(ctx) || "Six ways out of here, a bit and much. Tap a poster to walk there."
	return {
		hint: "Six ways to go. Tap a poster to walk there.",
		plain: true,
		carry: () => ({}),
		adopt: kit.adopt,
		stage: (ctx) => {
			const tr = kit.traits(ctx, "&m=mid")
			const dirs = dirsOf(tr)
			const c = ctx.c
			const d = (t: PlayTitle, dir: Dir) => (core.val(t, dir.k) - core.val(c, dir.k)) * dir.s
			const all = kit.pool(ctx).filter((t) => t.k !== c.k && !(ctx.prev && t.k === ctx.prev.k))
			const used: Record<string, boolean> = {}
			// A title fits a direction best when it moved on that trait and stayed put on the other two.
			const drift = (t: PlayTitle, skip: string[]) => {
				let sum = 0
				for (const k of tr.slice(0, 3)) if (skip.indexOf(k) < 0) sum += Math.abs(core.val(t, k) - core.val(c, k))
				return sum
			}
			const best = (fits: (t: PlayTitle) => number | null) => {
				let found: PlayTitle | undefined
				let value = -1e9
				for (const t of all) {
					if (used[t.k]) continue
					const v = fits(t)
					if (v !== null && v > value) {
						value = v
						found = t
					}
				}
				if (found) used[found.k] = true
				return found
			}
			// Where you came from: on the opposite side of the step.
			const via = ctx.prev ? String(ctx.e.via || "").split("|") : []
			const back = via.map((id) => id.slice(0, -1) + (id.slice(-1) === "+" ? "-" : "+")).sort().join("|")
			const cells: string[] = []
			let placed = false
			const cell = (t: PlayTitle | undefined, v: XY, id: string, label: string, ring: number) => {
				const came = !placed && Boolean(ctx.prev && back === id.split("|").sort().join("|"))
				if (came) placed = true
				const shown = came ? (ctx.prev as PlayTitle) : t
				const cap = label ? `<span class="bh-lb">${label}</span>` : ""
				cells.push(
					shown
						? core.poster(shown, { cls: `bh-p bh-r${ring}`, style: place(v), via: id, came, inner: cap })
						: `<span class="pl-ph bh-p bh-r${ring}" style="${place(v)}" aria-hidden="true">${cap}</span>`,
				)
			}
			const near = dirs.map((dir) =>
				best((t) => {
					const delta = d(t, dir)
					return delta >= 1 && delta <= 2 ? delta + t.n * 10 - 0.6 * drift(t, [dir.k]) : null
				}),
			)
			const far = dirs.map((dir) =>
				best((t) => {
					const delta = d(t, dir)
					return delta >= 3 ? Math.min(delta, 5) + t.n * 10 - 0.6 * drift(t, [dir.k]) : null
				}),
			)
			// Around the hexagon, each direction's neighbor: up, upper right, lower right, down, lower left, upper left.
			const round = dirs.length === 6 ? [dirs[0], dirs[1], dirs[2], dirs[3], dirs[4], dirs[5]] : []
			const both = round.map((a, i) => {
				const b = round[(i + 1) % 6]
				const fit = (least: number) => (t: PlayTitle) => {
					const da = d(t, a)
					const db = d(t, b)
					return da >= least && db >= least ? da + db + t.n * 10 : null
				}
				return { a, b, t: best(fit(2)) ?? best(fit(1)) }
			})
			dirs.forEach((dir, i) => {
				cell(near[i], dir.v, dir.id, "", 1)
				cell(
					far[i],
					[dir.v[0] * 2, dir.v[1] * 2],
					dir.id,
					`<i>${kit.emo(dir.k)} ${dir.s > 0 ? "more" : "less"}</i>${core.esc(kit.low(dir.k))}`,
					2,
				)
			})
			for (const pair of both) cell(pair.t, [pair.a.v[0] + pair.b.v[0], pair.a.v[1] + pair.b.v[1]], `${pair.a.id}|${pair.b.id}`, "", 2)
			const spokes = tr
				.slice(0, 3)
				.map((k, i) => `<i class="bh-sp" data-i="${i}" style="--c:${kit.hue(k)}"></i>`)
				.join("")
			const open =
				c.k === ctx.root.k
					? '<span class="bs-this">this page</span>'
					: `<a class="bs-open" data-pl-nav="" data-pl-open="" href="${core.esc(core.href(c))}">Open<span class="pl-sr"> ${core.esc(c.t)}</span></a>`
			const levels = tr
				.slice(0, 3)
				.map(
					(k) =>
						`<span class="bh-lv" style="--c:${kit.hue(k)}"><em>${kit.nm(k)}</em><s><u style="width:${core.val(c, k) * 10}%"></u>${
							c.k === ctx.root.k || !ctx.root.s ? "" : `<q style="left:${core.val(ctx.root, k) * 10}%"></q>`
						}</s><b>${core.val(c, k)}</b></span>`,
				)
				.join("")
			return `<div class="bh"${kit.memAttr(ctx)}><div class="bh-map">${spokes}${core.center(ctx, "bh-c")}${cells.join("")}</div><div class="bh-info"><p class="bs-nm"><b data-pl-here="">${core.esc(
				c.t,
			)}</b><small>${core.esc(c.y)}${c.k.charAt(0) === "s" ? " · Show" : ""}</small>${open}</p><p class="bh-why" data-pl-why="" aria-live="polite">${why(ctx)}</p><div class="bh-lvs">${levels}</div></div></div>`
		},
	}
}

/**
 * best3, more and less: the eighth round's recipe with the choosing made direct. Four steppers, one per trait, show
 * where the title you stand on is. A plus or a minus bends the road: the titles that have more (or less) of it,
 * from a bit to much. A second tap on another stepper makes a combination, a tap on a lit sign drops it. The bend
 * stays while you walk, so "keep going funnier" is a string of taps.
 */
const best3: BestForm = (core, kit) => {
	core.query("&v=2")
	type Mix = [string, number][]
	let memo: { e: unknown; l: unknown; r: string; items: { t: PlayTitle; g?: boolean }[] } | null = null
	const delta = (ctx: PlayCtx, t: PlayTitle, entry: [string, number]) => (core.val(t, entry[0]) - core.val(ctx.c, entry[0])) * entry[1]
	const model = (ctx: PlayCtx) => {
		const mem = ctx.st.mem
		const tr = kit.traits(ctx, "")
		mem.r ??= []
		const r = (mem.r as Mix).filter((entry) => tr.indexOf(entry[0]) >= 0)
		const sig = JSON.stringify(r)
		if (!memo || memo.e !== ctx.e || memo.l !== ctx.list || memo.r !== sig) {
			const all = kit.pool(ctx).filter((t) => t.k !== ctx.c.k)
			let road: PlayTitle[]
			if (!r.length) road = all.slice(0, 18)
			else {
				const score = (t: PlayTitle) => r.reduce((sum, entry) => sum + delta(ctx, t, entry), 0)
				let fit = all.filter((t) => r.every((entry) => delta(ctx, t, entry) >= 2))
				if (fit.length < 4) fit = all.filter((t) => r.every((entry) => delta(ctx, t, entry) >= 1))
				// From a bit to much, and at most three titles per size of step, nearest first.
				const seen: Record<string, number> = {}
				road = fit
					.filter((t) => {
						const k = String(score(t))
						seen[k] = (seen[k] ?? 0) + 1
						return seen[k] <= 3
					})
					.map((t, i) => ({ t, i }))
					.sort((p, q) => score(p.t) - score(q.t) || p.i - q.i)
					.map((p) => p.t)
					.slice(0, 20)
			}
			memo = { e: ctx.e, l: ctx.list, r: sig, items: [{ t: ctx.c } as { t: PlayTitle; g?: boolean }].concat(road.map((t, i) => (i ? { t } : { t, g: true }))) }
		}
		return { tr, r, items: memo.items }
	}
	const says = (r: Mix) => r.map((entry) => `<b>${entry[1] > 0 ? "more" : "less"} ${core.esc(kit.low(entry[0]))}</b>`).join(" and ")
	const reason = (ctx: PlayCtx, t: PlayTitle, r: Mix, place: number, of: number) => {
		if (t.k === ctx.c.k) return kit.journey(ctx) || "The road starts here. Swipe it to the left."
		const told = kit.differs(ctx, ctx.c, t, r.map((entry) => entry[0]))
		const than = ` than ${core.esc(ctx.c.t)}.`
		return r.length
			? `${kit.sentence(told)}${than}`
			: `${place} of ${of} closest${told.length ? `: ${told.join(", ")}${than}` : ", and much the same mix."}`
	}
	const show = (ctx: PlayCtx, s: Element, t: PlayTitle) => {
		const m = model(ctx)
		ctx.e.ui.f = t.k
		const head = s.querySelector("[data-b-head]")
		if (head) {
			head.setAttribute("data-k", t.k)
			head.innerHTML = kit.head(ctx, t, reason(ctx, t, m.r, m.items.findIndex((item) => item.t.k === t.k), m.items.length - 1))
		}
		kit.mark(s, t.k)
	}
	return {
		hint: "Tap + or − for more or less. Swipe to go further.",
		plain: true,
		settle: false,
		fly: false,
		carry: () => ({}),
		adopt: kit.adopt,
		act: (ctx, name, arg, _el, s) => {
			if (name === "nd") {
				kit.nudge(s, Number(arg))
				return false
			}
			const mem = ctx.st.mem
			if (name === "clear") {
				mem.r = []
				ctx.e.ui.f = undefined
				return true
			}
			if (name !== "mix") return false
			const key = arg.slice(0, -1)
			const sign = arg.slice(-1) === "+" ? 1 : -1
			const r = (mem.r ?? []) as Mix
			const at = r.findIndex((entry) => entry[0] === key)
			if (at >= 0 && r[at][1] === sign) r.splice(at, 1)
			else {
				if (at >= 0) r.splice(at, 1)
				r.push([key, sign])
				// Two at once is a combination anyone can read. A third replaces the oldest.
				if (r.length > 2) r.shift()
			}
			mem.r = r
			ctx.e.ui.f = undefined
			return true
		},
		input: (ctx, el, s) => {
			if (!el.hasAttribute("data-b-strip")) return
			const key = kit.under(el as HTMLElement)
			if (!key || s.querySelector("[data-b-head]")?.getAttribute("data-k") === key) return
			const item = model(ctx).items.find((entry) => entry.t.k === key)
			if (item) show(ctx, s, item.t)
		},
		after: (s) => kit.settle(s),
		stage: (ctx) => {
			const m = model(ctx)
			const kept = ctx.e.ui.f ? m.items.find((item) => item.t.k === ctx.e.ui.f)?.t : undefined
			// The marker starts on the first title of the road, not on the title you already know.
			const f = kept ?? m.items[1]?.t ?? ctx.c
			ctx.e.ui.f = f.k
			const state: Record<string, number> = {}
			for (const entry of m.r) state[entry[0]] = entry[1]
			const steppers = m.tr
				.map((key) => {
					const own = core.val(ctx.c, key)
					const half = (sign: number) =>
						`<button type="button" data-pl-act="mix" data-arg="${key}${sign > 0 ? "+" : "-"}" aria-pressed="${state[key] === sign}"${
							(sign > 0 ? own >= 10 : own <= 0) ? " disabled" : ""
						} aria-label="${core.esc(`${sign > 0 ? "More" : "Less"} ${kit.low(key)}`)}">${sign > 0 ? "+" : "−"}</button>`
					return `<div class="b3-st" style="--c:${kit.hue(key)};--v:${own}"${state[key] ? ` data-s="${state[key] > 0 ? "+" : "-"}"` : ""}>${half(-1)}<span><em>${kit.nm(key)}</em><b>${own}</b></span>${half(1)}</div>`
				})
				.join("")
			const none = m.items.length < 2 ? (m.r.length ? "Nothing close has that. Tap a lit sign to drop it." : "Nothing close yet.") : ""
			return `<div class="bs bs3"${kit.memAttr(ctx)}><b hidden data-pl-here="">${core.esc(ctx.c.t)}</b><p class="b3-say">${
				m.r.length
					? `Like <b>${core.esc(ctx.c.t)}</b>, with ${says(m.r)}. <button type="button" data-pl-act="clear">Clear</button>`
					: `Like <b>${core.esc(ctx.c.t)}</b>. Tap <b>+</b> or <b>−</b> to ask for more or less of something.`
			}</p><div class="b3-mix" role="group" aria-label="More or less of a trait">${steppers}</div><div class="bs-f"><div class="bs-hd" data-b-head="" data-k="${f.k}">${kit.head(
				ctx,
				f,
				reason(ctx, f, m.r, m.items.findIndex((item) => item.t.k === f.k), m.items.length - 1),
			)}</div></div>${kit.rail(ctx, m.items, f.k, none)}<p class="bs-cap"><span>${core.esc(ctx.c.t)}</span><b data-pl-why="">${
				m.r.length ? `further: ${says(m.r)}` : "further from it"
			}</b><span>→</span></p><span hidden>${core.center(ctx)}</span></div>`
		},
	}
}

export const BEST_FORMS: Record<string, BestForm> = { best1, best2, best3 }
