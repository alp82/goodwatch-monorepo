// PROTOTYPE for "Prototype native-scroll carousels on title pages", seventh round. Throwaway code: not for production.
//
// The play forms. Each is one function with no outside references (see play-engine.ts for why): it gets the engine's
// `core` and returns how to draw its stage from the pack of the title you stand on, and what its controls do. A page
// gets the engine and its one form as the inline script.
//
// Places are in units of the stage (`--u`, `--ux`), from its middle, so one table serves the phone and the desktop.
import type {
	PlayCore,
	PlayCtx,
	PlayDirection,
	PlayForm,
	PlayPick,
	PlayTitle,
} from "~/ui/prototype-carousels/play-engine"

import { BEST_FORMS, bestKit } from "~/ui/prototype-carousels/best-forms"
import { bestExtra } from "~/ui/prototype-carousels/best-meta"
import { ROAM_FORMS, roamKit } from "~/ui/prototype-carousels/roam-forms"
import { roamExtra } from "~/ui/prototype-carousels/roam-meta"
import { SCRUB_FORMS, scrubKit } from "~/ui/prototype-carousels/scrub-forms"
import { scrubExtra } from "~/ui/prototype-carousels/scrub-meta"

type Form = (core: PlayCore) => PlayForm

/**
 * play1, six ways: the fifth round's six directions on the instant data path. A direction's "more" opens it into
 * three ranks by panning the map that way: the same posters move, nothing is swapped, and the way back is a back
 * control. The deeper state stays on while you step, so "keep going darker" is a string of taps.
 */
const play1: Form = (core) => {
	type XY = [number, number]
	type Side = "l" | "c" | "r"
	const REST: Record<string, { pl: XY[]; lb: XY; al: Side }> = {
		e: { pl: [[28, 0], [43, 0]], lb: [50, -15.5], al: "r" },
		w: { pl: [[-28, 0], [-43, 0]], lb: [-50, 15.5], al: "l" },
		ne: { pl: [[18, -26.5], [33, -34.5]], lb: [50, -48.5], al: "r" },
		sw: { pl: [[-18, 26.5], [-33, 34.5]], lb: [-50, 48.5], al: "l" },
		nw: { pl: [[-18, -26.5], [-33, -34.5]], lb: [-50, -48.5], al: "l" },
		se: { pl: [[18, 26.5], [33, 34.5]], lb: [50, 48.5], al: "r" },
	}
	const POS = [["w", "e"], ["sw", "ne"], ["se", "nw"]]
	const U = Math.SQRT1_2
	// A direction opened into ranks, given for east and north-east: the others are mirrors. `c` is where the title
	// you stand on goes, which is how far the map pans, and `cs` how much smaller it gets.
	const FANS = {
		e: {
			c: [-30, 2] as XY,
			cs: 0.9,
			w: 15,
			ranks: [-6, 14, 34].map((x) => ({
				pl: [[x, 2], [x, -23], [x, 27]] as XY[],
				word: [x, -39] as XY,
			})),
			back: [-42, 2] as XY,
		},
		ne: {
			c: [-25, 25] as XY,
			cs: 0.82,
			w: 13,
			ranks: [27, 50, 73].map((r) => {
				const base: XY = [-25 + r * U, 25 - r * U]
				const s = 19 * U
				return {
					pl: [base, [base[0] - s, base[1] - s], [base[0] + s, base[1] + s]] as XY[],
					word: [base[0] + s + 2, base[1] + s + 12] as XY,
				}
			}),
			back: [-38, 35] as XY,
		},
	}
	// The corner a fan leaves free, for the way back and the direction's name.
	const EXIT: Record<string, { at: XY; al: Side }> = {
		e: { at: [-50, -49], al: "l" },
		w: { at: [-50, -49], al: "l" },
		ne: { at: [-50, -49], al: "l" },
		sw: { at: [-50, -49], al: "l" },
		nw: { at: [50, -49], al: "r" },
		se: { at: [-50, 49], al: "l" },
	}
	const fanOf = (pos: string) => {
		const base = pos === "e" || pos === "w" ? FANS.e : FANS.ne
		const fx = pos.indexOf("w") >= 0 ? -1 : 1
		const fy = pos.charAt(0) === "s" ? -1 : 1
		const flip = (p: XY): XY => [p[0] * fx, p[1] * fy]
		return {
			c: flip(base.c),
			cs: base.cs,
			w: base.w,
			ranks: base.ranks.map((rank) => ({
				pl: rank.pl.map(flip),
				word: flip(rank.word),
			})),
			back: flip(base.back),
		}
	}
	const r2 = (v: number) => Math.round(v * 10) / 10
	const at = (p: XY) => `--x:${r2(p[0])};--y:${r2(p[1])}`
	const RANK_WORDS = ["a bit", "more", "much"]
	const posOf = (direction: PlayDirection) =>
		POS[direction.slot][direction.sign > 0 ? 1 : 0]
	const model = (ctx: PlayCtx) => {
		const directions = core.dirs(ctx.st)
		const cameAt = ctx.prev && ctx.e.via ? core.opp(ctx.e.via) : ""
		const skip: Record<string, boolean> = {}
		if (ctx.prev) skip[ctx.prev.k] = true
		const shown: Record<string, boolean> = {}
		return directions.map((direction) => {
			const all = ctx.list
				? core.ranks(direction, ctx.c, ctx.list, [3, 3, 3], skip)
				: []
			const came = cameAt === direction.id ? ctx.prev : null
			// At rest: the nearest title of the nearest rank, and the nearest of a further one.
			const rest: PlayPick[] = []
			const free = all.filter((pick) => !shown[pick.t.k])
			if (free[0]) rest.push(free[0])
			const next =
				free.find((pick) => rest[0] && pick.rank > rest[0].rank) ?? free[1]
			if (next && !came) rest.push(next)
			for (const pick of rest) shown[pick.t.k] = true
			return { direction, pos: posOf(direction), all, rest, came }
		})
	}
	type Side1 = ReturnType<typeof model>[number]
	/** A direction's posters. The ones beyond the two at rest are drawn only when the direction opens. */
	const postersOf = (side: Side1, far: boolean, only = false) => {
		const { direction, pos } = side
		const home = REST[pos]
		const fan = fanOf(pos)
		const inWorld = (p: XY, f = fan): XY => [p[0] - f.c[0], p[1] - f.c[1]]
		const taken = [0, 0, 0]
		let posters = ""
		let slot = 0
		if (side.came) {
			// It shows while the opposite direction is open: behind the title you stand on, on its far side.
			const other = fanOf(POS[direction.slot][direction.sign > 0 ? 0 : 1])
			const d = inWorld(other.back, other)
			if (!only)
				posters += core.poster(side.came, {
					via: direction.id,
					came: true,
					cls: "p1-p p1-r p1-k",
					style: `${at(home.pl[0])};--dx:${r2(d[0])};--dy:${r2(d[1])};--dw:${other.w}`,
				})
			slot = 1
		}
		for (const pick of side.all) {
			const place = fan.ranks[pick.rank].pl[taken[pick.rank]++]
			if (!place) continue
			const d = inWorld(place)
			const shown = side.rest.indexOf(pick)
			const spot = shown >= 0 ? home.pl[slot + shown] : null
			if (spot ? only : !far) continue
			posters += core.poster(pick.t, {
				via: direction.id,
				cls: spot ? "p1-p p1-r" : "p1-p",
				attrs: ` data-rk="${pick.rank}"${spot ? "" : ' data-pl-far=""'}`,
				style: `${spot ? at(spot) : at(d)};--dx:${r2(d[0])};--dy:${r2(d[1])};--dw:${fan.w}`,
			})
		}
		return posters
	}
	const clear = (map: Element) => {
		const marked = map.querySelectorAll("[data-on],[data-under]")
		for (let i = 0; i < marked.length; i++) {
			marked[i].removeAttribute("data-on")
			marked[i].removeAttribute("data-under")
		}
	}
	const rest = (ctx: PlayCtx, s: Element) => {
		ctx.e.ui.deep = ""
		const map = s.querySelector("[data-p1]")
		if (!map) return
		map.removeAttribute("data-deep")
		clear(map)
		const why = s.querySelector("[data-pl-why]")
		if (why) why.textContent = "Six ways from here again."
	}
	return {
		hint: "Six ways from here. Tap a poster to step that way, or a way's count to see further along it.",
		carry: (ui) => ({ deep: ui.deep }),
		why: (ctx) => {
			const deep = core.dirs(ctx.st).find((d) => d.id === ctx.e.ui.deep)
			return deep
				? `${deep.emoji} ${core.esc(deep.label)} than ${core.esc(ctx.c.t)}: a bit is nearest, much is farthest.`
				: null
		},
		leave: (ctx, s) => {
			if (!ctx.e.ui.deep) return false
			rest(ctx, s)
			return true
		},
		act: (ctx, name, arg, _el, s) => {
			const map = s.querySelector("[data-p1]") as HTMLElement | null
			if (!map) return false
			if (name === "rest" || ctx.e.ui.deep === arg) {
				if (ctx.e.ui.deep) rest(ctx, s)
				return false
			}
			const side = map.querySelector(`.p1-d[data-dir="${arg}"]`)
			if (!side) return false
			clear(map)
			ctx.e.ui.deep = arg
			side.setAttribute("data-on", "")
			map.querySelector(`.p1-f[data-for="${arg}"]`)?.setAttribute("data-on", "")
			map
				.querySelector(`.p1-d[data-dir="${core.opp(arg)}"]`)
				?.setAttribute("data-under", "")
			if (!side.hasAttribute("data-full")) {
				const found = model(ctx).find((entry) => entry.direction.id === arg)
				if (found) side.insertAdjacentHTML("beforeend", postersOf(found, true, true))
				side.setAttribute("data-full", "")
			}
			const pan = (side.getAttribute("data-pan") ?? "0,0,1").split(",")
			map.style.setProperty("--px", pan[0])
			map.style.setProperty("--py", pan[1])
			map.style.setProperty("--cs", pan[2])
			map.setAttribute("data-deep", arg)
			const deep = core.dirs(ctx.st).find((d) => d.id === arg)
			const why = s.querySelector("[data-pl-why]")
			if (why && deep)
				why.textContent = `${deep.emoji} ${deep.label} than ${ctx.c.t}: a bit is nearest, much is farthest.`
			return false
		},
		stage: (ctx) => {
			const sides = model(ctx)
			const deep = sides.find((side) => side.direction.id === ctx.e.ui.deep)
			const deepFan = deep ? fanOf(deep.pos) : null
			const under = deep ? core.opp(deep.direction.id) : ""
			let world = ""
			let labels = ""
			let layers = ""
			for (const side of sides) {
				const { direction, pos } = side
				const home = REST[pos]
				const fan = fanOf(pos)
				const isOn = deep === side
				let posters = postersOf(side, isOn)
				if (!ctx.list)
					posters += home.pl
						.slice(side.came ? 1 : 0)
						.map((p) => core.poster(undefined, { cls: "p1-p p1-r", style: at(p) }))
						.join("")
				world += `<div class="p1-d" data-dir="${direction.id}" data-pos="${pos}" data-pan="${r2(fan.c[0])},${r2(
					fan.c[1],
				)},${fan.cs}"${isOn ? ' data-on="" data-full=""' : ""}${under === direction.id ? ' data-under=""' : ""}>${posters}</div>`
				const more = side.all.length - side.rest.length
				const word = `<i>${direction.emoji}</i><b>${core.esc(direction.label)}</b>`
				const ended = Boolean(ctx.list) && !ctx.soft && !side.all.length
				labels +=
					more > 0
						? `<button type="button" class="p1-l p1-a${home.al}" style="${at(home.lb)}" data-pl-act="deep" data-arg="${direction.id}" data-label="${pos}" aria-label="${core.esc(
								`${direction.label}: see ${more} more this way`,
							)}">${word}<u>+${more} ›</u></button>`
						: `<span class="p1-l p1-a${home.al}${ended ? " p1-e" : ""}" style="${at(home.lb)}" data-label="${pos}">${word}${
								ended ? "<u>ends</u>" : ""
							}</span>`
				if (more > 0) {
					const exit = EXIT[pos]
					layers += `<div class="p1-f" data-for="${direction.id}"${isOn ? ' data-on=""' : ""}><span class="p1-x p1-a${exit.al}" style="${at(exit.at)}"><button type="button" data-pl-act="rest"><span aria-hidden="true">←</span> All six ways</button><b><i>${direction.emoji}</i>${core.esc(
						direction.label,
					)}</b></span>${fan.ranks
						.map((rank, i) =>
							side.all.some((pick) => pick.rank === i)
								? `<span class="p1-rk" style="${at(rank.word)}">${RANK_WORDS[i]}</span>`
								: "",
						)
						.join("")}</div>`
				}
			}
			return `<div class="p1" data-p1=""${deep ? ` data-deep="${deep.direction.id}"` : ""} style="--px:${deepFan ? r2(deepFan.c[0]) : 0};--py:${
				deepFan ? r2(deepFan.c[1]) : 0
			};--cs:${deepFan ? deepFan.cs : 1}"><div class="p1-w"><svg viewBox="-50 -52 100 104" preserveAspectRatio="none" aria-hidden="true"><line x1="-43" y1="0" x2="43" y2="0"/><line x1="-33" y1="34.5" x2="33" y2="-34.5"/><line x1="-33" y1="-34.5" x2="33" y2="34.5"/></svg><button type="button" class="p1-c" data-pl-act="rest" aria-label="${core.esc(
				`${ctx.c.t} (${ctx.c.y})`,
			)}">${core.center(ctx)}</button>${world}</div><div class="p1-ls">${labels}</div>${layers}</div>`
		},
	}
}

/**
 * play3, honeycomb: a lattice with the title in the middle, six neighbors that each lie one step in a direction, and
 * an outer ring that the stage cuts off. A tap on any cell slides the lattice so that the cell is the middle. The
 * lattice is remembered for the walk: a cell keeps its title while it is still true from where you stand, so the map
 * you come back to is the map you left.
 */
const play3: Form = (core) => {
	const DX = 24
	const DY = 30.5
	const VEC: Record<string, [number, number]> = {
		e: [1, 0],
		ne: [1, -1],
		nw: [0, -1],
		w: [-1, 0],
		sw: [-1, 1],
		se: [0, 1],
	}
	const AROUND = ["e", "ne", "nw", "w", "sw", "se"]
	const POS = [["w", "e"], ["sw", "ne"], ["se", "nw"]]
	const LABELS: Record<string, { at: [number, number]; al: string; arrow: string }> = {
		e: { at: [50, 10.5], al: "r", arrow: "→" },
		w: { at: [-50, 10.5], al: "l", arrow: "←" },
		ne: { at: [50, -48.5], al: "r", arrow: "↗︎" },
		nw: { at: [-50, -48.5], al: "l", arrow: "↖︎" },
		se: { at: [50, 48.5], al: "r", arrow: "↘︎" },
		sw: { at: [-50, 48.5], al: "l", arrow: "↙︎" },
	}
	interface Cell {
		q: number
		r: number
		x: number
		y: number
		/** How the cell is reached: steps in one direction, or in two neighboring ones. */
		parts: [string, number][]
		far: number
		wide: boolean
	}
	const CELLS: Cell[] = []
	for (let q = -3; q <= 3; q++)
		for (let r = -3; r <= 3; r++) {
			const far = Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r))
			if (!far || far > 3) continue
			const x = DX * (q + r / 2)
			const y = DY * r
			if (Math.abs(x) > 74 || Math.abs(y) > 62) continue
			let parts: [string, number][] = []
			for (let i = 0; i < 6; i++) {
				const a = VEC[AROUND[i]]
				const b = VEC[AROUND[(i + 1) % 6]]
				const det = a[0] * b[1] - a[1] * b[0]
				const n1 = (q * b[1] - r * b[0]) / det
				const n2 = (a[0] * r - a[1] * q) / det
				if (n1 < 0 || n2 < 0) continue
				parts = [
					[AROUND[i], n1],
					[AROUND[(i + 1) % 6], n2],
				]
				parts = parts.filter((part) => part[1] > 0)
				break
			}
			CELLS.push({ q, r, x, y, parts, far, wide: Math.abs(x) > 58 })
		}
	CELLS.sort((a, b) => a.far - b.far)
	const model = (ctx: PlayCtx) => {
		const byPos: Record<string, PlayDirection> = {}
		for (const direction of core.dirs(ctx.st))
			byPos[POS[direction.slot][direction.sign > 0 ? 1 : 0]] = direction
		if (!ctx.st.mem.cells) ctx.st.mem.cells = {}
		const memo = ctx.st.mem.cells as Record<string, string>
		const Q = ctx.e.ui.q ?? 0
		const R = ctx.e.ui.r ?? 0
		memo[`${Q},${R}`] = ctx.c.k
		const used: Record<string, boolean> = {}
		used[ctx.c.k] = true
		const fits = (cell: Cell, t: PlayTitle, strict: boolean) => {
			for (const [pos, steps] of cell.parts) {
				const direction = byPos[pos]
				if (!direction) return false
				const delta = core.far(direction.axis, direction.sign, ctx.c, t)
				if (delta === null) return false
				if (strict && core.band(direction.axis, delta) < Math.min(2, steps - 1))
					return false
			}
			return true
		}
		const cells = CELLS.map((cell) => {
			const at = `${Q + cell.q},${R + cell.r}`
			const kept = memo[at] ? core.title(memo[at]) : undefined
			const came = Boolean(kept && ctx.prev && kept.k === ctx.prev.k)
			let title: PlayTitle | undefined
			if (kept && !used[kept.k] && (came || !ctx.c.s || !kept.s || fits(cell, kept, false)))
				title = kept
			return { cell, at, title, came }
		})
		for (const entry of cells) if (entry.title) used[entry.title.k] = true
		if (ctx.list && ctx.c.s)
			for (const entry of cells) {
				if (entry.title) continue
				const free = ctx.list.filter((t) => !used[t.k])
				entry.title =
					free.find((t) => fits(entry.cell, t, true)) ??
					(entry.cell.far > 1 ? free.find((t) => fits(entry.cell, t, false)) : undefined)
				if (entry.title) {
					used[entry.title.k] = true
					memo[entry.at] = entry.title.k
				}
			}
		return { cells, byPos }
	}
	return {
		hint: "Tap any poster and the map slides to it. Each side keeps its meaning.",
		fly: false,
		adopt: (st, stage) => {
			const memo: Record<string, string> = {}
			memo["0,0"] = st.root
			const drawn = stage.querySelectorAll("[data-o]")
			for (let i = 0; i < drawn.length; i++)
				memo[drawn[i].getAttribute("data-o") ?? ""] =
					drawn[i].getAttribute("data-pl-step") ?? ""
			st.mem.cells = memo
		},
		carry: (ui, button) => {
			const o = (button.getAttribute("data-o") ?? "0,0").split(",")
			const dq = Number(o[0])
			const dr = Number(o[1])
			return {
				q: (ui.q ?? 0) + dq,
				r: (ui.r ?? 0) + dr,
				fx: DX * (dq + dr / 2),
				fy: DY * dr,
			}
		},
		stage: (ctx) => {
			const { cells, byPos } = model(ctx)
			let posters = ""
			for (const { cell, title, came } of cells) {
				const style = `--x:${cell.x};--y:${cell.y}`
				const cls = `p3-p${cell.far > 1 ? " p3-o" : ""}${cell.wide ? " p3-x" : ""}`
				const via = byPos[cell.parts[0][0]]?.id ?? ""
				posters += title
					? core.poster(title, {
							via,
							came,
							cls,
							style,
							attrs: ` data-o="${cell.q},${cell.r}"${cell.far > 1 ? ' data-pl-far=""' : ""}`,
						})
					: cell.far > 1 && ctx.list
						? ""
						: core.poster(undefined, { cls, style })
			}
			let labels = ""
			for (const pos of AROUND) {
				const direction = byPos[pos]
				const label = LABELS[pos]
				if (!direction) continue
				const first = cells.find(
					(entry) => entry.cell.far === 1 && entry.cell.parts[0][0] === pos,
				)
				const ended = Boolean(ctx.list) && !ctx.soft && !first?.title
				const west = label.al === "l"
				labels += `<span class="p3-l p3-a${label.al}${ended ? " p3-e" : ""}" style="--x:${label.at[0]};--y:${label.at[1]}" data-label="${pos}">${
					west ? `<u>${label.arrow}</u>` : ""
				}<i>${direction.emoji}</i><b>${core.esc(direction.label)}</b>${ended ? "<em>ends</em>" : ""}${west ? "" : `<u>${label.arrow}</u>`}</span>`
			}
			return `<div class="p3"><div class="p3-m"><div class="p3-w" style="--fx:${ctx.e.ui.fx ?? 0};--fy:${ctx.e.ui.fy ?? 0}">${posters}${core.center(
				ctx,
				"p3-p p3-c",
				"--x:0;--y:0",
			)}</div></div>${labels}</div>`
		},
	}
}

/**
 * play6, diff tiles: a mosaic of mixed sizes. Every tile says at a glance how its title differs from the one you
 * stand on: two marks on a small tile, the differences spelled out on a wide one. A second page lies to the right,
 * cut off by the stage, and scrolls in natively.
 */
const play6: Form = (core) => {
	const FIRST = ["a", "b", "c", "d", "e", "f", "g", "h", "i"]
	const SECOND = ["j", "k", "a", "b", "l", "m", "c", "d", "e", "f", "g", "h", "i"]
	const WIDE: Record<string, boolean> = { f: true, g: true }
	const choose = (ctx: PlayCtx) => {
		if (!ctx.list) return []
		const leads: Record<string, number> = {}
		const out: { t: PlayTitle; d: { k: string; d: number }[] }[] = []
		for (const t of ctx.list) {
			if (ctx.prev && t.k === ctx.prev.k) continue
			const d = core.diffs(ctx.c, t, 3)
			const lead = d[0] ? `${d[0].k}${d[0].d > 0 ? "+" : "-"}` : "="
			if ((leads[lead] ?? 0) >= (lead === "=" ? 3 : 2)) continue
			leads[lead] = (leads[lead] ?? 0) + 1
			out.push({ t, d })
			if (out.length === FIRST.length + SECOND.length) break
		}
		return out
	}
	const tile = (
		pick: { t: PlayTitle; d: { k: string; d: number }[] } | undefined,
		area: string,
	) => {
		const style = `grid-area:${area}`
		if (!pick) return core.poster(undefined, { cls: "p6-t", style })
		const wide = WIDE[area]
		const inner = wide
			? `<span class="p6-w"><b>${core.esc(pick.t.t)}</b>${
					pick.d.length
						? pick.d
								.map(
									({ k, d }) =>
										`<span data-s="${d > 0 ? "+" : "-"}" style="--c:${core.M.traits[k].c}" title="${d > 0 ? "More" : "Less"} ${core.esc(core.M.traits[k].n)}"><u>${d > 0 ? "▲" : "▼"}</u>${core.M.traits[k].e} ${core.esc(core.M.traits[k].n)}</span>`,
								)
								.join("")
						: "<span>much the same mix</span>"
				}</span>`
			: `<span class="p6-m">${pick.d.length ? core.marks(pick.d.slice(0, 2)) : '<i class="pl-mk">≈</i>'}</span>`
		return core.poster(pick.t, {
			cls: `p6-t${wide ? " p6-wd" : ""}`,
			style,
			inner,
			via: pick.d[0] ? `t.${pick.d[0].k}${pick.d[0].d > 0 ? "+" : "-"}` : "",
		})
	}
	return {
		hint: "Each tile says how it differs from the title you stand on. Tap one to stand there. More to the right.",
		stage: (ctx) => {
			const picks = choose(ctx)
			// The wide tiles go to the titles with the most to say.
			const page = (from: number, areas: string[]) => {
				const mine = picks.slice(from, from + areas.length)
				const talkers = mine
					.slice()
					.sort((a, b) => b.d.length - a.d.length)
					.slice(0, 2)
				const rest = mine.filter((pick) => talkers.indexOf(pick) < 0)
				let w = 0
				let n = 0
				return areas
					.map((area) =>
						tile(ctx.list ? (WIDE[area] ? talkers[w++] : rest[n++]) : undefined, area),
					)
					.join("")
			}
			const own = ctx.c.s
				? core
						.own(ctx.c, 3)
						.map(
							(key) =>
								`<i style="--c:${core.M.traits[key].c}">${core.M.traits[key].e} ${core.val(ctx.c, key)}</i>`,
						)
						.join("")
				: ""
			return `<div class="p6"><div class="p6-g p6-1"><span class="p6-c" style="grid-area:C">${core.center(ctx)}<span class="p6-own">${own}</span></span>${page(
				0,
				FIRST,
			)}</div>${
				!ctx.list || picks.length > FIRST.length
					? `<div class="p6-g p6-2">${page(FIRST.length, SECOND)}</div>`
					: ""
			}</div>`
		},
	}
}

/**
 * play7, trait lens: the traits of the title you stand on along the top, and the titles around it below. The bars
 * under a poster say which of those traits it shares. Touching a trait lights up the titles that share it, and two
 * or three traits narrow it to the titles that share all of them. All of it happens in the browser.
 */
const play7: Form = (core) => {
	const SHOWN = 20
	const has = (c: PlayTitle, t: PlayTitle, key: string) =>
		core.val(t, key) >= Math.min(7, core.val(c, key))
	const read = (ctx: PlayCtx) => {
		const chips = ctx.c.s ? core.own(ctx.c, 8) : []
		const pins = ((ctx.e.ui.pins ?? []) as string[]).filter(
			(key) => chips.indexOf(key) >= 0,
		)
		const list = (ctx.list ?? []).filter((t) => !ctx.prev || t.k !== ctx.prev.k)
		const lit = list.filter((t) => pins.every((key) => has(ctx.c, t, key)))
		return { chips, pins, list, lit }
	}
	const names = (pins: string[]) =>
		pins.map((key) => `${core.M.traits[key].e} ${core.M.traits[key].n}`).join(" and ")
	return {
		hint: "Touch a trait to light up the titles that share it. A second trait narrows it down.",
		carry: (ui) => ({ pins: ui.pins }),
		why: (ctx) => {
			const { pins, list, lit } = read(ctx)
			return pins.length
				? `${lit.length} of ${list.length} titles around ${core.esc(ctx.c.t)} share its ${names(pins)}.`
				: null
		},
		act: (ctx, name, arg) => {
			if (name !== "pin") return false
			const pins = read(ctx).pins.slice()
			const at = pins.indexOf(arg)
			if (at >= 0) pins.splice(at, 1)
			else {
				pins.push(arg)
				if (pins.length > 3) pins.shift()
			}
			ctx.e.ui.pins = pins
			return true
		},
		stage: (ctx) => {
			const { chips, pins, list, lit } = read(ctx)
			const dim = list.filter((t) => lit.indexOf(t) < 0)
			const shown = pins.length ? lit.concat(dim).slice(0, SHOWN) : list.slice(0, SHOWN)
			const row = chips
				.map(
					(key) =>
						`<button type="button" class="pl-tr p7-ch" style="--c:${core.M.traits[key].c}" data-pl-act="pin" data-arg="${key}" aria-pressed="${pins.indexOf(key) >= 0}"><i>${core.M.traits[key].e}</i>${core.esc(
							core.M.traits[key].l,
						)}<em>${core.val(ctx.c, key)}</em></button>`,
				)
				.join("")
			const posters = ctx.list
				? shown
						.map((t, i) => {
							const on = !pins.length || lit.indexOf(t) >= 0
							return core.poster(t, {
								cls: `p7-p${on ? "" : " p7-off"}${i >= 14 ? " p7-x" : ""}`,
								attrs: on ? "" : ' data-pl-far=""',
								inner: `<span class="p7-b">${chips
									.map(
										(key) =>
											`<i style="--c:${core.M.traits[key].c}"${has(ctx.c, t, key) ? ' data-on=""' : ""}${
												pins.indexOf(key) >= 0 ? ' data-pin=""' : ""
											}></i>`,
									)
									.join("")}</span>`,
							})
						})
						.join("")
				: Array.from({ length: SHOWN }, (_, i) =>
						core.poster(undefined, { cls: `p7-p${i >= 14 ? " p7-x" : ""}` }),
					).join("")
			const note = pins.length
				? `<b>${lit.length}</b> of ${list.length} share ${names(pins)}`
				: "The bars under a poster are these traits, in this order"
			return `<div class="p7"><div class="p7-chips">${row}</div><p class="p7-n">${note}</p><div class="p7-g">${core.center(ctx, "p7-p p7-me")}${posters}</div></div>`
		},
	}
}

/**
 * play10, pick a path: three titles that each pull a different way, with the differences spelled out. Picking one
 * moves on at once and deals the next three. The picks add up to a path that is drawn above, with what each pick
 * added or took away.
 */
const play10: Form = (core) => {
	const deal = (ctx: PlayCtx) => {
		if (!ctx.list) return []
		const back = ctx.e.via ? core.opp(ctx.e.via) : ""
		const leads: Record<string, boolean> = {}
		const walked: Record<string, boolean> = {}
		for (const entry of ctx.st.trail) walked[entry.k] = true
		const out: { t: PlayTitle; d: { k: string; d: number }[]; lead: string }[] = []
		for (const t of ctx.list) {
			if (walked[t.k]) continue
			const d = core.diffs(ctx.c, t, 3)
			if (!d.length) continue
			const lead = `t.${d[0].k}${d[0].d > 0 ? "+" : "-"}`
			if (leads[lead] || lead === back) continue
			leads[lead] = true
			out.push({ t, d, lead })
			if (out.length === 9) break
		}
		return out
	}
	const markOf = (via: string) => {
		const key = via.slice(2, -1)
		const trait = core.M.traits[key]
		return trait
			? `<i class="pl-mk p10-v" data-s="${via.slice(-1)}" style="--c:${trait.c}" title="${core.esc(
					`${via.slice(-1) === "+" ? "More" : "Less"} ${trait.n}`,
				)}">${trait.e}<b>${via.slice(-1) === "+" ? "▲" : "▼"}</b></i>`
			: '<i class="p10-v">›</i>'
	}
	return {
		hint: "Three ways to go on, each with what it changes. Pick one and the next three are dealt.",
		act: (ctx, name) => {
			if (name !== "deal") return false
			ctx.e.ui.page = (ctx.e.ui.page ?? 0) + 1
			return true
		},
		stage: (ctx) => {
			const all = deal(ctx)
			const pages = Math.max(1, Math.ceil(all.length / 3))
			const page = (ctx.e.ui.page ?? 0) % pages
			const three = all.slice(page * 3, page * 3 + 3)
			const trail = ctx.st.trail
			const from = Math.max(0, trail.length - 5)
			let path = from > 0 ? '<i class="p10-v">…</i>' : ""
			for (let i = from; i < trail.length - 1; i++) {
				const t = core.title(trail[i].k)
				if (!t) continue
				path += `<button type="button" class="p10-s" data-pl-to="${i}" aria-label="${core.esc(`Back to ${t.t}`)}"><img alt="" decoding="async" src="${core.esc(
					core.src(t.p),
				)}"></button>${markOf(trail[i + 1].via)}`
			}
			const cards = [0, 1, 2]
				.map((i) => {
					const pick = three[i]
					if (!pick)
						return ctx.list && !ctx.soft
							? '<span class="p10-none">Nothing else pulls another way from here.</span>'
							: `<span class="p10-k">${core.poster(undefined, { cls: "p10-p" })}</span>`
					return core.poster(pick.t, {
						cls: "p10-k",
						via: pick.lead,
						inner: `<span class="p10-d"><b>${core.esc(pick.t.t)}</b>${pick.d
							.map(
								({ k, d }) =>
									`<span data-s="${d > 0 ? "+" : "-"}" style="--c:${core.M.traits[k].c}" title="${d > 0 ? "More" : "Less"} ${core.esc(core.M.traits[k].n)}"><u>${d > 0 ? "▲" : "▼"}</u>${core.M.traits[k].e} ${core.esc(core.M.traits[k].n)}</span>`,
							)
							.join("")}</span>`,
					})
				})
				.join("")
			return `<div class="p10"><div class="p10-path"><span class="p10-lb">${trail.length > 1 ? "Your path" : "Start"}</span>${path}${core.center(
				ctx,
				"p10-c",
			)}</div><div class="p10-cards">${cards}</div>${
				pages > 1
					? `<button type="button" class="p10-deal" data-pl-act="deal">Deal three others <span aria-hidden="true">↻</span> <small>${page + 1}/${pages}</small></button>`
					: '<span class="p10-deal"></span>'
			}</div>`
		},
	}
}

/**
 * play2, horizon: the sixth round's tilted sea without its selector. All six directions at once, as lanes that run
 * from the title you stand on toward the horizon. A lane holds one title per rank: a bit, more, much, the further
 * the smaller. The two ends of an axis are mirror lanes, left and right.
 */
const play2: Form = (core) => {
	// Per axis, the angle of its high lane from straight ahead. The low lane is its mirror.
	const ANGLES = [78, 47, 17]
	// Per axis, how far out its three ranks stand. The lanes straight ahead start further out and stand closer.
	const RADII = [
		[33, 50, 66],
		[33, 50, 65],
		[38, 50, 60],
	]
	const WIDTHS = [12, 10.5, 9]
	const O: [number, number] = [0, 33]
	const KX = 0.7
	const KY = 1.2
	const r1 = (v: number) => Math.round(v * 10) / 10
	const place = (angle: number, radius: number): [number, number] => {
		const a = (angle * Math.PI) / 180
		return [r1(O[0] + radius * Math.sin(a) * KX), r1(O[1] - radius * Math.cos(a) * KY)]
	}
	const LABELS: { at: [number, number]; al: string }[] = [
		{ at: [50, 9], al: "r" },
		{ at: [50, -33], al: "r" },
		{ at: [2, -49], al: "l" },
	]
	return {
		hint: "Six lanes toward the horizon, nearer titles first. Tap a poster to sail there.",
		stage: (ctx) => {
			const cameAt = ctx.prev && ctx.e.via ? core.opp(ctx.e.via) : ""
			const skip: Record<string, boolean> = {}
			if (ctx.prev) skip[ctx.prev.k] = true
			const used: Record<string, boolean> = {}
			let lanes = ""
			let lines = ""
			let labels = ""
			for (const direction of core.dirs(ctx.st)) {
				const angle = ANGLES[direction.slot] * direction.sign
				const picks = ctx.list
					? core.ranks(direction, ctx.c, ctx.list, [3, 3, 3], skip)
					: []
				const end = place(angle, 80)
				lines += `<line x1="${O[0]}" y1="${O[1]}" x2="${end[0]}" y2="${end[1]}" stroke="url(#p2-g)"/>`
				let posters = ""
				const came = cameAt === direction.id ? ctx.prev : null
				for (let rank = 0; rank < 3; rank++) {
					const at = place(angle, RADII[direction.slot][rank])
					const style = `--x:${at[0]};--y:${at[1]};--w:${WIDTHS[rank]}`
					if (came && rank === 0) {
						posters += core.poster(came, { via: direction.id, came: true, cls: "p2-p", style })
						continue
					}
					const pick = picks.find((entry) => entry.rank === rank && !used[entry.t.k])
					if (pick) used[pick.t.k] = true
					posters += pick
						? core.poster(pick.t, {
								via: direction.id,
								cls: "p2-p",
								style,
								attrs: ` data-rk="${rank}"${rank === 2 ? ' data-pl-far=""' : ""}`,
							})
						: ctx.list && !ctx.soft
							? ""
							: core.poster(undefined, { cls: "p2-p", style })
				}
				lanes += `<div class="p2-d" data-dir="${direction.id}">${posters}</div>`
				const label = LABELS[direction.slot]
				const west = direction.sign < 0
				const ended = Boolean(ctx.list) && !ctx.soft && !picks.length
				labels += `<span class="p2-l p2-a${west ? (label.al === "r" ? "l" : "r") : label.al}${ended ? " p2-e" : ""}" style="--x:${
					label.at[0] * direction.sign
				};--y:${label.at[1]}" data-label="${direction.id}"><i>${direction.emoji}</i><b>${core.esc(direction.label)}</b>${ended ? "<em>ends</em>" : ""}</span>`
			}
			return `<div class="p2"><svg viewBox="-50 -52 100 104" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="p2-g" gradientUnits="userSpaceOnUse" x1="0" y1="33" x2="0" y2="-52"><stop offset="0" stop-color="#7dd3fc" stop-opacity=".55"/><stop offset="1" stop-color="#7dd3fc" stop-opacity=".05"/></linearGradient></defs><ellipse cx="0" cy="33" rx="46" ry="12"/><ellipse cx="0" cy="33" rx="62" ry="38"/><ellipse cx="0" cy="33" rx="78" ry="64"/>${lines}</svg><span class="p2-far">a bit · more · much</span>${lanes}${core.center(
				ctx,
				"p2-c",
				`--x:${O[0]};--y:${O[1] + 2}`,
			)}${labels}</div>`
		},
	}
}

/**
 * play4, trait mixer: four of the title's traits as sliders. Moving one ("more humor") ranks the titles around it
 * again, in the browser, and the posters change while you drag. The marks on a poster say what it really has more
 * or less of, so a wish the neighborhood can't meet shows as such.
 */
const play4: Form = (core) => {
	const keysOf = (ctx: PlayCtx): string[] => {
		if (ctx.st.mem.mix) return ctx.st.mem.mix
		// Traits with room both ways first: a 10 can only go down.
		const found = ctx.root.s
			? core
					.own(ctx.root, 12)
					.sort(
						(a, b) =>
							Number(core.val(ctx.root, a) > 8) - Number(core.val(ctx.root, b) > 8) ||
							core.val(ctx.root, b) - core.val(ctx.root, a),
					)
					.slice(0, 4)
			: ctx.st.traits.slice(0, 4)
		if (ctx.root.s) ctx.st.mem.mix = found
		return found
	}
	const rank = (ctx: PlayCtx, keys: string[]) => {
		const mix = (ctx.e.ui.mix ?? {}) as Record<string, number>
		const moved = keys.filter(
			(key) => mix[key] !== undefined && mix[key] !== core.val(ctx.c, key),
		)
		const list = (ctx.list ?? []).filter((t) => !ctx.prev || t.k !== ctx.prev.k)
		const scored = list
			.map((t) => {
				let score = t.n * 10
				for (const key of keys) {
					const want = mix[key] ?? core.val(ctx.c, key)
					const off = Math.abs(core.val(t, key) - want)
					score -= off * (moved.indexOf(key) >= 0 ? 0.3 : 0.05)
				}
				return { t, score }
			})
			.sort((a, b) => b.score - a.score)
		return { mix, moved, picks: scored.slice(0, 9).map((entry) => entry.t) }
	}
	const gridOf = (ctx: PlayCtx, keys: string[]) => {
		const { moved, picks } = rank(ctx, keys)
		if (!ctx.list)
			return Array.from({ length: 9 }, () => core.poster(undefined, { cls: "p4-p" })).join("")
		return picks
			.map((t) =>
				core.poster(t, {
					cls: "p4-p",
					inner: moved.length
						? `<span class="p4-m">${moved
								.map((key) => {
									const d = core.val(t, key) - core.val(ctx.c, key)
									return `<i style="--c:${core.M.traits[key].c}" data-s="${d > 0 ? "+" : d < 0 ? "-" : "="}">${core.M.traits[key].e}${d > 0 ? `+${d}` : d < 0 ? `−${-d}` : "="}</i>`
								})
								.join("")}</span>`
						: "",
				}),
			)
			.join("")
	}
	const noteOf = (ctx: PlayCtx, keys: string[]) => {
		const { mix, moved, picks } = rank(ctx, keys)
		if (!moved.length) return "Drag a trait. The posters follow while you drag."
		const asked = moved
			.map(
				(key) =>
					`${mix[key] > core.val(ctx.c, key) ? "more" : "less"} ${core.M.traits[key].e} ${core.M.traits[key].n}`,
			)
			.join(", ")
		const short = moved.filter(
			(key) => !picks.some((t) => Math.abs(core.val(t, key) - mix[key]) <= 1),
		)
		return short.length
			? `Asked for ${asked}. Nothing close reaches ${short.map((key) => `${core.M.traits[key].e} ${mix[key]}`).join(" and ")}: the nearest to it are shown.`
			: `Asked for ${asked}.`
	}
	return {
		hint: "Drag a trait up or down and the posters follow. Tap one to stand there.",
		adopt: (st, stage) => {
			const inputs = stage.querySelectorAll("[data-pl-input]")
			const keys: string[] = []
			for (let i = 0; i < inputs.length; i++)
				keys.push(inputs[i].getAttribute("data-key") ?? "")
			if (keys.length) st.mem.mix = keys
		},
		input: (ctx, el, s) => {
			const key = el.getAttribute("data-key") ?? ""
			if (!key) return
			const keys = keysOf(ctx)
			if (!ctx.e.ui.mix) ctx.e.ui.mix = {}
			ctx.e.ui.mix[key] = Number((el as HTMLInputElement).value)
			const row = el.closest(".p4-r") as HTMLElement | null
			if (row) {
				row.style.setProperty("--t", String(ctx.e.ui.mix[key]))
				const out = row.querySelector("output")
				if (out) out.textContent = String(ctx.e.ui.mix[key])
			}
			const grid = s.querySelector("[data-p4-grid]")
			if (grid) grid.innerHTML = gridOf(ctx, keys)
			const note = s.querySelector("[data-p4-note]")
			if (note) note.textContent = noteOf(ctx, keys)
			const reset = s.querySelector("[data-p4-reset]") as HTMLElement | null
			if (reset) reset.hidden = false
		},
		act: (ctx, name) => {
			if (name !== "reset") return false
			ctx.e.ui.mix = {}
			return true
		},
		stage: (ctx) => {
			const keys = keysOf(ctx)
			const mix = (ctx.e.ui.mix ?? {}) as Record<string, number>
			const rows = keys
				.map((key) => {
					const trait = core.M.traits[key]
					const own = core.val(ctx.c, key)
					const want = mix[key] ?? own
					return `<label class="p4-r" style="--c:${trait.c};--o:${own};--t:${want}"><span><i>${trait.e}</i>${core.esc(trait.l)}</span><span class="p4-s"><input type="range" min="0" max="10" step="1" value="${want}" data-pl-input="" data-key="${key}" aria-label="${core.esc(
						`How much ${trait.n}`,
					)}"${ctx.c.s ? "" : " disabled"}><u title="${core.esc(`${ctx.c.t}: ${own}`)}"></u></span><output>${want}</output></label>`
				})
				.join("")
			const any = keys.some((key) => mix[key] !== undefined && mix[key] !== core.val(ctx.c, key))
			return `<div class="p4"><div class="p4-mix">${rows}<p class="p4-n"><span data-p4-note="">${noteOf(ctx, keys)}</span><button type="button" data-pl-act="reset" data-p4-reset=""${any ? "" : " hidden"}>Reset</button></p></div><div class="p4-g">${core.center(
				ctx,
				"p4-p p4-me",
			)}<div class="p4-gg" data-p4-grid="">${gridOf(ctx, keys)}</div></div></div>`
		},
	}
}

/**
 * play5, fingerprint hub: the fingerprint of the title you stand on as a glyph, one spoke per trait, as long as the
 * trait is strong. At the end of a spoke stands the nearest title that pushes that trait further (or holds it as
 * high, when it can't go higher). A step redraws the glyph for the new title: the spokes grow and shrink, and the
 * faint outline keeps the shape of the page's title.
 */
const play5: Form = (core) => {
	const N = 8
	const RX = 41
	const RY = 40
	const r1 = (v: number) => Math.round(v * 10) / 10
	const spoke = (i: number): [number, number] => {
		const a = ((i * 360) / N - 90) * (Math.PI / 180)
		return [Math.cos(a), Math.sin(a)]
	}
	// How far a spoke of a level reaches, as a share of the way to its poster.
	const reach = (level: number) => 0.3 + 0.062 * level
	// The page title's four strongest traits, and four it has room to grow on: a spoke at 10 can only be matched.
	const keysOf = (ctx: PlayCtx): string[] => {
		if (ctx.st.mem.hub) return ctx.st.mem.hub
		if (!ctx.root.s) return ctx.st.traits.slice(0, N)
		const all = core.own(ctx.root, 16)
		const top = all.slice(0, 4)
		const room = all.slice(4).filter((key) => core.val(ctx.root, key) <= 8)
		return top.concat(room, all.slice(4)).filter((key, i, list) => list.indexOf(key) === i).slice(0, N)
	}
	return {
		hint: "Each spoke is a trait of this title. The poster at its end has more of it. Tap one to stand there.",
		adopt: (st, stage) => {
			const spokes = stage.querySelectorAll("[data-spoke]")
			const keys: string[] = []
			for (let i = 0; i < spokes.length; i++)
				keys.push(spokes[i].getAttribute("data-spoke") ?? "")
			if (keys.length) st.mem.hub = keys
		},
		stage: (ctx) => {
			const keys = keysOf(ctx)
			if (ctx.root.s && !ctx.st.mem.hub) ctx.st.mem.hub = keys
			const used: Record<string, boolean> = {}
			if (ctx.prev) used[ctx.prev.k] = true
			let spokes = ""
			let posters = ""
			let shape = ""
			let home = ""
			keys.forEach((key, i) => {
				const trait = core.M.traits[key]
				const [cx, cy] = spoke(i)
				const now = core.val(ctx.c, key)
				const before = ctx.prev?.s ? core.val(ctx.prev, key) : now
				const angle = (i * 360) / N - 90
				const len = Math.sqrt((cx * RX) ** 2 + (cy * RY) ** 2)
				spokes += `<i class="p5-s" data-spoke="${key}" style="--a:${angle}deg;--l:${r1(len)};--v:${reach(now)};--v0:${reach(before)};--c:${trait.c}"><b></b></i>`
				shape += `${r1(cx * RX * reach(now))},${r1(cy * RY * reach(now))} `
				if (ctx.root.s)
					home += `${r1(cx * RX * reach(core.val(ctx.root, key)))},${r1(cy * RY * reach(core.val(ctx.root, key)))} `
				const style = `--x:${r1(cx * RX)};--y:${r1(cy * RY)}`
				let pick: PlayTitle | undefined
				let more = 0
				if (ctx.list && ctx.c.s) {
					const free = ctx.list.filter((t) => !used[t.k])
					pick = free.find((t) => core.val(t, key) >= Math.max(now + 2, 6))
					if (pick) more = core.val(pick, key) - now
					else if (now >= 8) pick = free.find((t) => core.val(t, key) >= now)
				}
				if (pick) used[pick.k] = true
				const tag = `<span class="p5-t" style="--c:${trait.c}"><i>${trait.e}</i>${pick ? (more ? `+${more}` : "=") : ""}</span>`
				posters += pick
					? core.poster(pick, { via: `t.${key}+`, cls: "p5-p", style, inner: tag })
					: ctx.list && !ctx.soft
						? `<span class="p5-p p5-none" style="${style}"><i>${trait.e}</i>${now >= 8 ? "tops out" : "no more nearby"}</span>`
						: core.poster(undefined, { cls: "p5-p", style })
				const lx = cx * (RX * reach(now) + 4.5)
				const ly = cy * (RY * reach(now) + 4.5)
				spokes += `<em class="p5-e" style="--x:${r1(lx)};--y:${r1(ly)}" title="${core.esc(`${trait.l}: ${now}`)}">${now}</em>`
			})
			const came = ctx.prev
				? core.poster(ctx.prev, { came: true, cls: "p5-p p5-k", style: "--x:-43.5;--y:42" })
				: ""
			return `<div class="p5"><svg viewBox="-50 -52 100 104" preserveAspectRatio="none" aria-hidden="true">${
				home && ctx.c.k !== ctx.root.k ? `<polygon class="p5-h" points="${home.trim()}"/>` : ""
			}<polygon points="${shape.trim()}"/></svg>${spokes}${core.center(ctx, "p5-c")}${posters}${came}</div>`
		},
	}
}

/**
 * play8, scrub: the neighborhood laid out along one axis, from its low end to its high end, as a strip that scrolls
 * sideways natively. Whatever is under the marker shows large above, with how far it is from the title you stand
 * on. The chips choose what the strip means.
 */
const play8: Form = (core) => {
	const ITEM = 58
	const titlesOf = (ctx: PlayCtx, axisId: string) => {
		const axis = core.axisOf(axisId) ?? core.M.axes[0]
		const buckets: Record<string, number> = {}
		const list = (ctx.list ?? []).filter((t) => {
			const bucket = String(Math.round(core.level(axis, t) * 2))
			buckets[bucket] = (buckets[bucket] ?? 0) + 1
			return buckets[bucket] <= 3
		})
		const all = list.concat([ctx.c]).sort((a, b) => core.level(axis, a) - core.level(axis, b))
		return { axis, all }
	}
	const axisOfUi = (ctx: PlayCtx) => (ctx.e.ui.axis as string) ?? ctx.st.axes[0] ?? "tone"
	const focusOf = (ctx: PlayCtx, t: PlayTitle | undefined) => {
		const axis = core.axisOf(axisOfUi(ctx)) ?? core.M.axes[0]
		if (!t) return ""
		const here = t.k === ctx.c.k
		const mine = core.level(axis, ctx.c)
		const theirs = core.level(axis, t)
		const up = core.far(axis, 1, ctx.c, t)
		const down = core.far(axis, -1, ctx.c, t)
		const grade = (delta: number, word: string) =>
			`${["A bit ", "", "Much "][core.band(axis, delta)]}${word}`.replace(/^./, (ch) => ch.toUpperCase())
		const said = here
			? "You stand here"
			: up !== null
				? grade(up, axis.highWord)
				: down !== null
					? grade(down, axis.lowWord)
					: `About as ${theirs >= 5 ? axis.highMost : axis.lowMost}`
		const told = here ? [] : core.diffs(ctx.c, t, 3)
		const body = `<span class="p8-big"><img alt="" decoding="async" src="${core.esc(core.src(t.p))}"></span><span class="p8-tx"><b>${core.esc(t.t)}</b><small>${core.esc(t.y)}</small><strong>${core.esc(said)}${
			here ? "" : ` than ${core.esc(ctx.c.t)}`
		}</strong><span class="p8-bars"><i style="--v:${theirs}"><u></u></i><i class="p8-own" style="--v:${mine}"><u></u></i></span><span class="p8-df">${
			told.length ? core.sayDiff(told) : here ? `${axis.emoji[0]} ${core.esc(axis.low)} to the left, ${axis.emoji[1]} ${core.esc(axis.high.toLowerCase())} to the right` : "much the same mix otherwise"
		}</span>${here ? "" : '<em class="p8-go">Stand here ›</em>'}</span>`
		return here
			? `<span class="p8-f p8-here">${body}</span>`
			: `<button type="button" class="p8-f" data-pl-step="${t.k}" data-via="${axis.id}${theirs >= mine ? "+" : "-"}" data-t="${core.esc(t.t)}" data-y="${core.esc(t.y)}" data-pl-far="">${body}</button>`
	}
	const at = (strip: Element) => Math.round((strip as HTMLElement).scrollLeft / ITEM)
	return {
		hint: "Drag the strip sideways to move along one axis. The chips choose what it means.",
		settle: false,
		carry: (ui) => ({ axis: ui.axis }),
		act: (ctx, name, arg) => {
			if (name !== "axis" || axisOfUi(ctx) === arg) return false
			ctx.e.ui.axis = arg
			return true
		},
		input: (ctx, el, s) => {
			if (!el.hasAttribute("data-p8-strip")) return
			const index = at(el)
			const items = el.querySelectorAll("[data-i]")
			const item = items[Math.max(0, Math.min(items.length - 1, index))]
			const key = item?.getAttribute("data-k") ?? ""
			const focus = s.querySelector("[data-p8-focus]")
			if (!focus || focus.getAttribute("data-k") === key) return
			focus.setAttribute("data-k", key)
			focus.innerHTML = focusOf(ctx, core.title(key))
			const on = el.querySelector("[data-on]")
			if (on) on.removeAttribute("data-on")
			item?.setAttribute("data-on", "")
		},
		after: (s, ctx) => {
			const strip = s.querySelector("[data-p8-strip]") as HTMLElement | null
			const mine = strip?.querySelector(`[data-k="${ctx.c.k}"]`)
			if (strip && mine) strip.scrollLeft = Number(mine.getAttribute("data-i")) * ITEM
		},
		stage: (ctx) => {
			const { axis, all } = titlesOf(ctx, axisOfUi(ctx))
			const chips = core.M.axes
				.map(
					(a) =>
						`<button type="button" class="p8-ch" data-pl-act="axis" data-arg="${a.id}" aria-pressed="${a.id === axis.id}">${core.esc(a.name)}</button>`,
				)
				.join("")
			const strip = all
				.map((t, i) =>
					t.k === ctx.c.k
						? `<span class="p8-i p8-me" data-i="${i}" data-k="${t.k}" data-on=""><img alt="" decoding="async" src="${core.esc(core.src(t.p))}"></span>`
						: core.poster(t, {
								cls: "p8-i",
								via: `${axis.id}${core.level(axis, t) >= core.level(axis, ctx.c) ? "+" : "-"}`,
								attrs: ` data-i="${i}" data-k="${t.k}"${Math.abs(i - all.indexOf(ctx.c)) > 3 ? ' data-pl-far=""' : ""}`,
							}),
				)
				.join("")
			return `<div class="p8"><div class="p8-chips">${chips}</div><div class="p8-focus" data-p8-focus="" data-k="${ctx.c.k}">${focusOf(
				ctx,
				ctx.c,
			)}</div><div class="p8-rail"><div class="p8-strip" data-p8-strip="" data-pl-input="">${strip}</div><span class="p8-mark" aria-hidden="true"></span></div><p class="p8-ax"><span>${axis.emoji[0]} ${core.esc(
				axis.low,
			)}</span><i></i><span>${core.esc(axis.high)} ${axis.emoji[1]}</span></p><span hidden>${core.center(ctx)}</span></div>`
		},
	}
}

/**
 * play9, blend: the Explorer's bridge, small. The title you stand on and a second title, what the two have in
 * common, and the titles that lie between them, from nearer the one to nearer the other. The small posters choose
 * the second title; a tap on any large poster walks there and keeps the second title.
 */
const play9: Form = (core) => {
	const partners = (ctx: PlayCtx) => {
		const leads: Record<string, boolean> = {}
		const out: PlayTitle[] = []
		for (const t of ctx.list ?? []) {
			const d = core.diffs(ctx.c, t, 2)
			if (d.length < 2) continue
			const lead = `${d[0].k}${d[0].d > 0 ? "+" : "-"}`
			if (leads[lead]) continue
			leads[lead] = true
			out.push(t)
			if (out.length === 8) break
		}
		return out
	}
	return {
		hint: "What lies between two titles. The small posters choose the second one.",
		carry: (ui) => ({ b: ui.b }),
		act: (ctx, name, arg) => {
			if (name !== "with" || ctx.e.ui.b === arg) return false
			ctx.e.ui.b = arg
			return true
		},
		why: (ctx) => {
			const b = ctx.e.ui.shown ? core.title(ctx.e.ui.shown) : undefined
			if (!b?.s || !ctx.c.s) return null
			const both = core.shared(ctx.c, b, 3)
			return both.length
				? `${core.esc(ctx.c.t)} and ${core.esc(b.t)} share ${both.map((key) => `${core.M.traits[key].e} ${core.M.traits[key].n}`).join(", ")}.`
				: `${core.esc(ctx.c.t)} and ${core.esc(b.t)} have little in common: these are the closest to both.`
		},
		stage: (ctx) => {
			const choices = partners(ctx)
			const kept = ctx.e.ui.b ? core.title(ctx.e.ui.b) : undefined
			const b = kept && kept.k !== ctx.c.k && kept.s ? kept : choices[0]
			ctx.e.ui.shown = b?.k ?? ""
			if (b && choices.indexOf(b) < 0 && choices.length) choices[choices.length - 1] = b
			const theirs = b ? core.listOf(b.k) : null
			if (b && !theirs) core.need(b.k)
			const both = b && ctx.c.s ? core.shared(ctx.c, b, 4) : []
			const seen: Record<string, boolean> = {}
			seen[ctx.c.k] = true
			if (b) seen[b.k] = true
			const pool: PlayTitle[] = []
			for (const t of (ctx.list ?? []).concat(theirs ?? [])) {
				if (seen[t.k]) continue
				seen[t.k] = true
				pool.push(t)
			}
			const between = b
				? pool
						.map((t) => ({ t, a: core.sim(ctx.c, t), b: core.sim(b, t) }))
						.sort((x, y) => Math.min(y.a, y.b) - Math.min(x.a, x.b))
						.slice(0, 5)
						.sort((x, y) => y.a - y.b - (x.a - x.b))
				: []
			const chips = both.length
				? both
						.map(
							(key) =>
								`<span class="p9-ch" style="--c:${core.M.traits[key].c}"><i>${core.M.traits[key].e}</i><b>${core.esc(core.M.traits[key].l)}</b><em>${core.val(ctx.c, key)}·${b ? core.val(b, key) : ""}</em></span>`,
						)
						.join("")
				: b
					? '<span class="p9-no">Little in common</span>'
					: ""
			const row = ctx.list
				? between
						.map(({ t }) =>
							core.poster(t, {
								cls: "p9-p",
								inner: `<span class="p7-b">${both
									.map(
										(key) =>
											`<i style="--c:${core.M.traits[key].c}"${core.val(t, key) >= 7 ? ' data-on=""' : ""}></i>`,
									)
									.join("")}</span>`,
							}),
						)
						.join("")
				: Array.from({ length: 5 }, () => core.poster(undefined, { cls: "p9-p" })).join("")
			const picker = choices
				.map(
					(t) =>
						`<button type="button" class="p9-w" data-pl-act="with" data-arg="${t.k}" aria-pressed="${t === b}" aria-label="${core.esc(`Blend with ${t.t}`)}" title="${core.esc(t.t)}"><img alt="" decoding="async" src="${core.esc(core.src(t.p))}"></button>`,
				)
				.join("")
			return `<div class="p9"${b && !theirs ? ` data-pl-wants="${b.k}"` : ""}><div class="p9-top">${core.center(ctx, "p9-a")}<div class="p9-mid"><small>Both have</small>${chips}</div>${
				b ? core.poster(b, { cls: "p9-b", attrs: ' data-pl-far=""' }) : core.poster(undefined, { cls: "p9-b" })
			}</div><div class="p9-pick"><small>Blend with</small><div class="p9-ws">${picker}</div></div><div class="p9-bt"><small><span>← nearer ${core.esc(ctx.c.t)}</span><b>Between the two</b><span>nearer ${core.esc(b?.t ?? "")} →</span></small><div class="p9-row">${row}</div></div></div>`
		},
	}
}

export const PLAY_FORMS: Record<string, Form> = {
	play1,
	play2,
	play3,
	play4,
	play5,
	play6,
	play7,
	play8,
	play9,
	play10,
	// Eighth round: the scrub forms get their shared kit next to the engine's core.
	...Object.fromEntries(
		Object.entries(SCRUB_FORMS).map(([name, form]): [string, Form] => [
			name,
			(core) => form(core, scrubKit(core, scrubExtra())),
		]),
	),
	// Tenth round: the roam forms, with their kit.
	...Object.fromEntries(
		Object.entries(ROAM_FORMS).map(([name, form]): [string, Form] => [
			name,
			(core) => form(core, roamKit(core, roamExtra())),
		]),
	),
	// Ninth round: the combined forms, with their kit.
	...Object.fromEntries(
		Object.entries(BEST_FORMS).map(([name, form]): [string, Form] => [
			name,
			(core) => form(core, bestKit(core, bestExtra())),
		]),
	),
}
