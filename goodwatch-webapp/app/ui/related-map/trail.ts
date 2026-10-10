// The form of the related map: the level chips above the rings, and one bar under the map (beside it on a wide
// screen) with the walk as small posters and the details of the title in the middle.
// - Pointing at a chip, or holding it, lights the posters on the map that the chip is about: the ones that have
//   clearly more of its trait than the title in the middle (a chip that adds it) or clearly less (one that drops it).
// - Pointing at a poster, or holding it, moves a mark on every chip to that title's level, with the way from the
//   level of the title in the middle drawn in green (more) or red (less).
// - A chip that is on keeps a band of light moving over the part it changed, after the flash it comes on with: left
//   to right over what it added, right to left over what it took away (styles.ts).
// - The line of plain links under the section is out of sight. It stays in the server's HTML.
import type { MapCore, MapCtx, MapForm, MapTitle } from "./engine"
import { chipsKit } from "./level-chips"
import { ringsKit } from "./rings"
import { type TraitWords, chipTokens } from "./traits"

/** The most chips that can be on at once: one color each (level-chips.ts). */
const MAX_ON = 3

export function trailForm(core: MapCore, words: TraitWords): MapForm {
	const { esc, val } = core
	const kit = ringsKit(core, words)
	const mx = chipsKit(core, kit)
	const LEFT =
		'<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M9.5 3.5 5 8l4.5 4.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
	const RIGHT =
		'<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h9.5M8.5 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'

	// --- The walk ---------------------------------------------------------------------------------------------------
	const last = (ctx: MapCtx) => ctx.st.trail.length - 1
	const at = (ctx: MapCtx, i: number) => core.title(ctx.st.trail[i].k) as MapTitle
	const thumb = (t: MapTitle) => `<img alt="" decoding="async" src="${esc(core.src(t.p))}">`
	/** A title of the walk that a tap goes back to. */
	const to = (ctx: MapCtx, i: number, inner: string, cls = "") =>
		`<button type="button"${cls ? ` class="${cls}"` : ""} data-pl-to="${i}" title="${esc(at(ctx, i).t)}" aria-label="${esc(`Back to ${at(ctx, i).t}`)}">${inner}</button>`
	/** One step back. At the start it is there and off, so that nothing moves when the walk begins. */
	const back = (ctx: MapCtx) =>
		last(ctx) < 1
			? `<button type="button" class="fn-bk" disabled aria-label="Back">${LEFT}<span>Back</span></button>`
			: `<button type="button" class="fn-bk" data-pl-back="" aria-label="${esc(`Back to ${at(ctx, last(ctx) - 1).t}`)}">${LEFT}<span>Back</span></button>`
	/** The steps from `from` up to the one before the title you stand on, newest first, behind one control. */
	const steps = (ctx: MapCtx, from: number, label: string, say: string) => {
		let rows = ""
		for (let i = last(ctx) - 1; i >= from; i--)
			rows += `<li>${to(ctx, i, `<i>${i === 0 ? "Start" : i}</i>${thumb(at(ctx, i))}<span>${esc(at(ctx, i).t)}</span>`)}</li>`
		return `<details class="fn-hs" data-pl-hist=""><summary aria-label="${esc(say)}">${label}</summary><ol class="fn-pop">${rows}</ol></details>`
	}

	/**
	 * The walk as one row of tiles of one height, as the head of the card. In order: back, the start with its
	 * word beside the art, how many titles are tucked away, the last two, and the title you stand on as its poster
	 * with an amber ring. No tile counts the steps. The name of the title you stand on is the card's.
	 */
	const posterTrail = (ctx: MapCtx) => {
		const n = last(ctx)
		let stops = ""
		if (n >= 1) stops += `<li class="fn-t0">${to(ctx, 0, `${thumb(at(ctx, 0))}<span>Start</span>`, "fn-cap")}</li>`
		if (n >= 4) stops += `<li class="fn-tm">${steps(ctx, 1, `+${n - 3}`, `${n - 1} titles in between. Open the list.`)}</li>`
		for (let i = Math.max(1, n - 2); i < n; i++) stops += `<li class="fn-ti">${to(ctx, i, thumb(at(ctx, i)))}</li>`
		stops += `<li class="fn-tc"><span class="fn-cap" aria-current="step" title="${esc(ctx.c.t)}">${thumb(ctx.c)}<span class="pl-sr">You are here: ${esc(ctx.c.t)}</span></span></li>`
		return `<div class="fn-tb">${back(ctx)}<ol class="fn-tr" aria-label="Where you walked">${stops}</ol>${n ? "" : '<p class="fn-tip">Tap a poster to move</p>'}</div>`
	}

	// --- The card ---------------------------------------------------------------------------------------------------
	/** How a title differs from the page's title: up to three traits, each with a sign and its color. */
	const diff = (ctx: MapCtx, t: MapTitle) => {
		const plain = (text: string) => `<span class="fn-dh">${text}</span>`
		if (t.k === ctx.root.k)
			return plain(ctx.c.k !== ctx.root.k ? "This is where you started" : '<span class="rg-h">Point at a poster to compare it</span><span class="rg-t">Hold a poster to compare it</span>')
		if (!t.s || !ctx.root.s) return plain("…")
		const told = kit.gaps(ctx.root, t, 3)
		if (!told.length) return plain("Much the same mix")
		return told
			.map((e) => `<span class="fn-d" data-d="${e.d > 0 ? "up" : "dn"}"><i aria-hidden="true">${e.d > 0 ? "+" : "−"}</i><span class="pl-sr">${e.d > 0 ? "more" : "less"} </span>${kit.emo(e.k)} ${esc(kit.low(e.k))}</span>`)
			.join("")
	}
	/**
	 * The card of the title in the middle: what it is, how it differs from the page's title, and the way to its page.
	 * While a poster is pointed at or held the same card is about that title: it says "Preview", wears a dashed
	 * line, and trades "Open" for what a tap on the poster does.
	 */
	const card = (ctx: MapCtx, note: string) => {
		const c = ctx.c
		const own = c.k === ctx.root.k
		const go = own
			? '<span class="fn-this">This page</span>'
			: `<a class="fn-open" data-pl-nav="" data-pl-open="" href="${esc(core.href(c))}"><span>Open<span class="fn-ow"> page</span><span class="pl-sr"> of ${esc(c.t)}</span></span>${RIGHT}</a>`
		return `${posterTrail(ctx)}<div class="fn-card"${own ? ' data-fn-root=""' : ""}><p class="fn-kk"><b class="fn-k0">You are here</b><b class="fn-k1">Preview</b></p><p class="fn-vs"><span class="fn-v1">vs</span><span class="fn-v2">compared with</span> <b>${esc(ctx.root.t)}</b></p><p class="fn-nm"><b data-pl-here="" data-r-nm="">${esc(
			c.t,
		)}</b><small data-r-yr="">${kit.when(c)}</small></p><p class="fn-df" data-pl-why="" data-r-df="">${diff(ctx, c)}</p><div class="fn-go">${go}<span class="fn-mv">Tap it to move here</span></div><p class="fn-nt" data-r-nt="">${note}</p></div>`
	}

	// --- The chips, the map, and what they show of each other -------------------------------------------------------
	const chip = (ctx: MapCtx, token: string, on: boolean) => {
		const key = kit.tok(token)?.key ?? ""
		return mx.chip(ctx, { token, label: kit.word(key), v: val(ctx.c, key), on, color: mx.colorOf(ctx, token) })
	}
	const chips = (ctx: MapCtx, tokens: string[]) => {
		const own = chipTokens((key) => val(ctx.c, key), words)
		// A chip keeps its place when it is turned on. One that the walk brought along from another title goes first.
		const keys = own.map((token) => kit.tok(token)?.key)
		const here = own.map((token) => tokens.filter((t) => kit.tok(t)?.key === kit.tok(token)?.key)[0] ?? token)
		const brought = tokens.filter((t) => keys.indexOf(kit.tok(t)?.key) < 0)
		return brought.concat(here).slice(0, Math.max(6, tokens.length))
	}
	const rootOf = (section: Element) => (section.matches("[data-r-root]") ? section : section.querySelector("[data-r-root]"))
	/** A chip is pointed at or held: the posters it is about are lit, with its trait as a badge. */
	const lit = (section: Element, ctx: MapCtx, tokens: string[] | null, arg: string) => {
		const root = rootOf(section)
		if (!root) return
		const k = tokens ? kit.tok(arg) : null
		const up = k?.op === ">"
		const drawn = root.querySelectorAll("[data-r-w] > button[data-r-k]")
		for (let i = 0; i < drawn.length; i++) {
			const b = drawn[i]
			let mark = ""
			if (k && ctx.c.s && !b.hasAttribute("data-r-c") && !b.hasAttribute("data-r-x")) {
				const t = core.title(b.getAttribute("data-r-k") ?? "")
				if (t?.s && ((val(t, k.key) - val(ctx.c, k.key)) * (up ? 1 : -1) >= 2 || kit.passes(t, [arg]))) mark = kit.emo(k.key) || "•"
			}
			if (mark) {
				if (b.getAttribute("data-fn-lit") !== mark) b.setAttribute("data-fn-lit", mark)
				if (b.getAttribute("data-fn-ld") !== (up ? "up" : "dn")) b.setAttribute("data-fn-ld", up ? "up" : "dn")
			} else if (b.hasAttribute("data-fn-lit")) {
				b.removeAttribute("data-fn-lit")
				b.removeAttribute("data-fn-ld")
			}
		}
	}
	/** A poster is pointed at or held: every chip shows that title's level next to its own. */
	const levels = (section: Element, ctx: MapCtx, t: MapTitle | null) => {
		const root = rootOf(section)
		if (!root) return
		const all = root.querySelectorAll(".fn-row .ix-c")
		for (let i = 0; i < all.length; i++) {
			const el = all[i] as HTMLElement
			const v = val(ctx.c, el.getAttribute("data-k") ?? "")
			const m = t?.s && ctx.c.s ? val(t, el.getAttribute("data-k") ?? "") : null
			el.style.setProperty("--pm", String(m ?? v))
			el.style.setProperty("--pa", String(Math.min(v, m ?? v)))
			el.style.setProperty("--pb", String(Math.max(v, m ?? v)))
			if (m === null) {
				el.removeAttribute("data-fn-pk")
				continue
			}
			// The direction stays on the chip after the pointer has left, so that the way back keeps its color.
			el.setAttribute("data-fn-pd", m >= v ? "up" : "dn")
			el.setAttribute("data-fn-pk", "")
			const text = el.querySelector(".fn-pt")
			if (text) text.textContent = m === v ? `${v} too` : `${v}→${m}`
		}
	}

	return kit.make({
		th: 56,
		mh: 348,
		tokens: (ctx) => mx.active(ctx),
		top: (ctx, tokens) => {
			if (!ctx.c.s) return '<p class="rm-say"><span>Its traits are on their way.</span></p>'
			return `<div class="ix-row ix-6 fn-row" role="group" aria-label="The traits of ${esc(ctx.c.t)}. A tap drops a strong one or adds a weak one.">${chips(ctx, tokens)
				.map((token) => chip(ctx, token, tokens.indexOf(token) >= 0))
				.join("")}</div>`
		},
		note: (_ctx, tokens, list, places, more) =>
			tokens.length
				? `Around it: titles ${kit.withOrWithout(tokens)}. A colored line marks the posters that came in for it.${list.length < places && !more ? ` These ${list.length} are all there are.` : ""}`
				: "A chip fills to its level. Tap a full one for titles without that trait, a low one for titles with it.",
		act: (ctx, act, arg) => {
			if (act !== "tk") return false
			mx.choose(ctx, arg, MAX_ON)
			return true
		},
		will: (ctx, act, arg) => (act === "tk" ? mx.after(ctx, arg, MAX_ON) : null),
		deco: (ctx, _list, places) => {
			const mark = mx.marks(ctx, mx.active(ctx), places)
			return mark ? (t) => ({ inner: mark(t), extra: "" }) : null
		},
		shown: (section, ctx, tokens, _act, arg) => lit(section, ctx, tokens, arg),
		peeked: levels,
		diff,
		card,
	})
}
