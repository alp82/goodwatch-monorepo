// The level chips of the related map: the fingerprint of the title in the middle as chips. A full one drops that
// trait, a low one adds it.
// - At rest the map is the nearest titles and nothing else. Nothing changes who is on it unless the visitor asked.
// - A chip is also a bar: its background fills to the level of the title in the middle. What a tap would add is
//   drawn in green from that level on, what it would take away in red, faintly while the chip is pointed at or held,
//   and lasting once it is on, with a flash as it comes on.
// - Every chip that is on has a color of its own (three at most, never two alike), and the posters that are on the
//   map because of it wear that color as a thin line. Green and red only ever mean added and taken away.
import type { MapCore, MapCtx, MapTitle } from "./engine"
import type { RingsKit } from "./rings"

export type ChipsKit = ReturnType<typeof chipsKit>
interface Chip {
	/** What the chip stands for and what a tap on it asks for: a level of a trait, at least or at most. */
	token: string
	label: string
	/** The level of the title in the middle. */
	v: number
	on: boolean
	color: string
}

export function chipsKit(core: MapCore, kit: RingsKit) {
	const { esc, val } = core
	/** One color per selection that is on. Green and red are kept for what a selection adds or takes away. */
	const SLOTS = ["#fbbf24", "#22d3ee", "#e879f9"]
	const now = () => (core.win ? (core.win.performance.now() as number) : 0)
	const active = (ctx: MapCtx) => (ctx.st.mem.w as string[] | undefined) ?? []
	const colorOf = (ctx: MapCtx, token: string) => SLOTS[((ctx.st.mem.sl as Record<string, number> | undefined)?.[token] ?? 0) % SLOTS.length]
	/** The selection after a tap on a token: it goes when it was on. Otherwise it comes, one per trait and `max` in all. */
	const after = (ctx: MapCtx, token: string, max: number) => {
		const cur = active(ctx)
		if (cur.indexOf(token) >= 0) return cur.filter((t) => t !== token)
		const key = kit.tok(token)?.key
		let out = cur.filter((t) => kit.tok(t)?.key !== key)
		while (out.length >= max) out = out.slice(1)
		return out.concat([token])
	}
	/** A tap on a token. Every selection keeps its color for as long as it is on, and a new one takes a free color. */
	const choose = (ctx: MapCtx, token: string, max: number) => {
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
		// The chip that came on flashes.
		mem.fl = next.indexOf(token) >= 0 ? { t: token, at: now() } : null
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
	 * looked at, lasting once it is on, flashing as it comes on. The text says the same: "1 → 6+". It has room for a
	 * second mark: the level of a poster that is pointed at (trail.ts).
	 */
	const chip = (ctx: MapCtx, o: Chip) => {
		const k = kit.tok(o.token)
		if (!k) return ""
		const up = k.op === ">"
		const zone = up ? [Math.min(o.v, k.n), k.n] : [k.n, Math.max(o.v, k.n)]
		const moved = zone[1] - zone[0] > 0
		const fl = ctx.st.mem.fl as { t: string; at: number } | null | undefined
		const since = fl && fl.t === o.token && o.on ? now() - fl.at : -1
		const flashing = since >= 0 && since < 1300
		const to = moved ? `${o.v}→${level(o.token)}` : level(o.token)
		return `<button type="button" class="ix-c" data-pl-act="tk" data-arg="${esc(o.token)}" data-k="${k.key}" aria-pressed="${o.on}" data-d="${up ? "up" : "dn"}"${flashing ? ' data-fl=""' : ""} style="--v:${o.v};--a:${zone[0]};--b:${zone[1]};--n:${k.n};--c:${o.color}${
			flashing ? `;--fa:${-Math.round(since)}ms` : ""
		}" aria-label="${esc(`${kit.word(k.key)}: ${o.v} of 10 here. ${o.on ? "On" : "Tap"}: titles with ${orMore(o.token)}.`)}"><u class="ix-f"></u><u class="ix-z"></u><u class="ix-n"></u><u class="fn-pz"></u><u class="fn-pk"></u><i>${kit.emo(k.key)}</i><b>${esc(
			o.label,
		)}</b><em><span class="ix-r">${o.v}</span><span class="ix-p">${esc(to)}</span><span class="fn-pt"></span></em></button>`
	}
	/**
	 * The posters that are on the map because of a selection: the ones the plain map would not show at this zoom.
	 * Each wears the color of the selection it stands out for most, as a thin line.
	 */
	const marks = (ctx: MapCtx, tokens: string[], places: number) => {
		if (!tokens.length || !ctx.c.s) return null
		const plain: Record<string, boolean> = {}
		for (const t of kit.around(ctx, []).slice(0, places)) plain[t.k] = true
		return (t: MapTitle) => {
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
	return { active, colorOf, after, choose, chip, marks }
}
