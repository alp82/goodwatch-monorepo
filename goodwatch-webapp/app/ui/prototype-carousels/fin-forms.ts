// PROTOTYPE for "Prototype native-scroll carousels on title pages", thirteenth round. Throwaway code: not for production.
//
// Three forms on top of the twelfth round's level chips (mix1, which stays as it is for comparing). The rings, the
// pan, the zoom, and the chips are the kits' (rings-forms.ts, mix-forms.ts). What all three add:
// - Pointing at a chip, or holding it, lights the posters on the map that the chip is about: the ones that have
//   clearly more of its trait than the title in the middle (a chip that adds it) or clearly less (one that drops it).
//   From the signposts (mix4). The dimming of what would leave stays.
// - Pointing at a poster, or holding it, moves a mark on every chip to that title's level, with the way from the
//   level of the title in the middle drawn in green (more) or red (less). From before and after (mix5).
// - A chip that is on keeps a band of light moving over the part it changed, after the flash it comes on with: left
//   to right over what it added, right to left over what it took away (fin-css.ts).
// - The line of plain links under the section is out of sight. It stays in the server's HTML.
//
// They differ in the navigation (where you started, how many steps, where you are, and back) and in the card of the
// title in the middle:
// - fin1, path bar: the walk as one bar of labeled stops. The card has the poster, the name, and a large "Open".
// - fin2, poster trail: the walk as small posters at the head of the card, one bar with the title's details.
//   The owner's pick, changed in place: the trail was a row above the map at first.
// - fin3, one card: the navigation is the head of the card. Nothing but the heading sits above the map.
//
// `finKit` and each form are functions with no outside references, because they run as the page's inline script.
import type { PlayCore, PlayCtx, PlayForm, PlayTitle } from "~/ui/prototype-carousels/play-engine"
import type { MixKit } from "~/ui/prototype-carousels/mix-forms"
import type { RingsKit } from "~/ui/prototype-carousels/rings-forms"

export type FinKit = ReturnType<typeof finKit>
type FinForm = (core: PlayCore, kit: RingsKit, mx: MixKit, fk: FinKit) => PlayForm

export function finKit(core: PlayCore, kit: RingsKit, mx: MixKit) {
	const { esc, val } = core
	const LEFT =
		'<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M9.5 3.5 5 8l4.5 4.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
	const RIGHT =
		'<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h9.5M8.5 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
	const TIP = "Tap a poster to move there"

	// --- The walk ---------------------------------------------------------------------------------------------------
	const last = (ctx: PlayCtx) => ctx.st.trail.length - 1
	const at = (ctx: PlayCtx, i: number) => core.title(ctx.st.trail[i].k) as PlayTitle
	const thumb = (t: PlayTitle) => `<img alt="" decoding="async" src="${esc(core.src(t.p))}">`
	/** A title of the walk that a tap goes back to. */
	const to = (ctx: PlayCtx, i: number, inner: string, cls = "") =>
		`<button type="button"${cls ? ` class="${cls}"` : ""} data-pl-to="${i}" title="${esc(at(ctx, i).t)}" aria-label="${esc(`Back to ${at(ctx, i).t}`)}">${inner}</button>`
	/** One step back. At the start it is there and off, so that nothing moves when the walk begins. */
	const back = (ctx: PlayCtx) =>
		last(ctx) < 1
			? `<button type="button" class="fn-bk" disabled aria-label="Back">${LEFT}<span>Back</span></button>`
			: `<button type="button" class="fn-bk" data-pl-back="" aria-label="${esc(`Back to ${at(ctx, last(ctx) - 1).t}`)}">${LEFT}<span>Back</span></button>`
	/** The steps from `from` up to the one before the title you stand on, newest first, behind one control. */
	const steps = (ctx: PlayCtx, from: number, label: string, say: string) => {
		let rows = ""
		for (let i = last(ctx) - 1; i >= from; i--)
			rows += `<li>${to(ctx, i, `<i>${i === 0 ? "Start" : i}</i>${thumb(at(ctx, i))}<span>${esc(at(ctx, i).t)}</span>`)}</li>`
		return `<details class="fn-hs" data-pl-hist=""><summary aria-label="${esc(say)}">${label}</summary><ol class="fn-pop">${rows}</ol></details>`
	}
	const stepWord = (n: number) => `${n} ${n === 1 ? "step" : "steps"}`

	/** fin1: the walk as one bar. Start, what lies between, and the title you stand on, each with its label. */
	const pathBar = (ctx: PlayCtx) => {
		const n = last(ctx)
		const cell = (label: string, name: string) => `<small>${label}</small><b>${esc(name)}</b>`
		let stops = ""
		if (n >= 1) stops += `<li class="fn-st">${to(ctx, 0, cell("Start", at(ctx, 0).t))}</li>`
		if (n === 2) stops += `<li>${to(ctx, 1, cell("Then", at(ctx, 1).t))}</li>`
		if (n > 2) stops += `<li class="fn-md">${steps(ctx, 1, `<small>Then</small><b>${n - 1} titles</b>`, `${n - 1} titles in between. Open the list.`)}</li>`
		stops += `<li class="fn-cu"><span aria-current="step">${cell(n ? `Now, step ${n}` : "You are here", ctx.c.t)}</span></li>`
		return `<div class="fn-n fn-n1"${n ? "" : ' data-fn-0=""'}>${back(ctx)}<ol class="fn-path" aria-label="Where you walked">${stops}</ol>${n ? "" : `<p class="fn-tip">${TIP}</p>`}</div>`
	}
	/**
	 * fin2: the walk as small posters, as the head of the card. The start, the last two titles in between, and the
	 * title you stand on, whose name is the card's.
	 */
	const posterTrail = (ctx: PlayCtx) => {
		const n = last(ctx)
		let stops = ""
		if (n >= 1) stops += `<li class="fn-t0">${to(ctx, 0, `${thumb(at(ctx, 0))}<small>Start</small>`)}</li>`
		if (n - 1 > 2) stops += `<li class="fn-tm">${steps(ctx, 1, `+${n - 3}`, `${n - 1} titles in between. Open the list.`)}</li>`
		for (let i = Math.max(1, n - 2); i < n; i++) stops += `<li class="fn-ti">${to(ctx, i, thumb(at(ctx, i)))}</li>`
		stops += `<li class="fn-tc"><span aria-current="step" title="${esc(ctx.c.t)}">${thumb(ctx.c)}<span class="pl-sr">${esc(ctx.c.t)}</span></span></li>`
		return `<div class="fn-tb">${back(ctx)}<ol class="fn-tr" aria-label="Where you walked">${stops}</ol><p class="fn-tip">${n ? `${stepWord(n)} from <b>${esc(ctx.root.t)}</b>` : TIP}</p></div>`
	}
	/** fin3: the walk as the head of the card: back, how far from where, and the way to the start. */
	const strip = (ctx: PlayCtx) => {
		const n = last(ctx)
		const where = n
			? steps(ctx, 0, `<span>${stepWord(n)} from <b>${esc(ctx.root.t)}</b></span>`, `${stepWord(n)} from ${ctx.root.t}. Open the list.`)
			: `<span class="fn-tip">${TIP}</span>`
		return `<div class="fn-ns">${back(ctx)}<div class="fn-wh">${where}</div>${n ? to(ctx, 0, "Start over", "fn-so") : ""}</div>`
	}

	// --- The card ---------------------------------------------------------------------------------------------------
	/** How a title differs from the page's title: up to three traits, each with a sign and its color. */
	const diff = (ctx: PlayCtx, t: PlayTitle) => {
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
	const card = (ctx: PlayCtx, note: string, poster: boolean, head = "") => {
		const c = ctx.c
		const own = c.k === ctx.root.k
		const go = own
			? '<span class="fn-this">This page</span>'
			: `<a class="fn-open" data-pl-nav="" data-pl-open="" href="${esc(core.href(c))}"><span>Open<span class="fn-ow"> page</span><span class="pl-sr"> of ${esc(c.t)}</span></span>${RIGHT}</a>`
		return `${head}<div class="fn-card"${own ? ' data-fn-root=""' : ""}>${
			poster ? `<span class="fn-th"><img data-fn-im="" data-fn-own="${esc(core.src(c.p))}" alt="" decoding="async" src="${esc(core.src(c.p))}"></span>` : ""
		}<p class="fn-kk"><b class="fn-k0">You are here</b><b class="fn-k1">Preview</b></p><p class="fn-vs"><span class="fn-v1">vs</span><span class="fn-v2">compared with</span> <b>${esc(ctx.root.t)}</b></p><p class="fn-nm"><b data-pl-here="" data-r-nm="">${esc(
			c.t,
		)}</b><small data-r-yr="">${kit.when(c)}</small></p><p class="fn-df" data-pl-why="" data-r-df="">${diff(ctx, c)}</p><div class="fn-go">${go}<span class="fn-mv">Tap it to move here</span></div><p class="fn-nt" data-r-nt="">${note}</p></div>`
	}

	// --- The chips, the map, and what they show of each other -------------------------------------------------------
	/** A level chip with room for a second mark: the level of a poster that is pointed at. */
	const chip = (ctx: PlayCtx, token: string, on: boolean) => {
		const key = kit.tok(token)?.key ?? ""
		const v = val(ctx.c, key)
		return mx
			.chip(ctx, { act: "tk", arg: token, token, label: kit.word(key), v, on, rest: String(v), color: mx.colorOf(ctx, token) })
			.replace('<u class="ix-n"></u>', '<u class="ix-n"></u><u class="fn-pz"></u><u class="fn-pk"></u>')
			.replace("</em>", '<span class="fn-pt"></span></em>')
	}
	const chips = (ctx: PlayCtx, tokens: string[]) => {
		const own = kit.rule("bars", (key) => val(ctx.c, key), [], kit.X.w)
		// A chip keeps its place when it is turned on. One that the walk brought along from another title goes first.
		const keys = own.map((token) => kit.tok(token)?.key)
		const here = own.map((token) => tokens.filter((t) => kit.tok(t)?.key === kit.tok(token)?.key)[0] ?? token)
		const brought = tokens.filter((t) => keys.indexOf(kit.tok(t)?.key) < 0)
		return brought.concat(here).slice(0, Math.max(6, tokens.length))
	}
	const rootOf = (section: Element) => (section.matches("[data-r-form]") ? section : section.querySelector("[data-r-form]"))
	/** A chip is pointed at or held: the posters it is about are lit, with its trait as a badge. */
	const lit = (section: Element, ctx: PlayCtx, tokens: string[] | null, arg: string) => {
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
	/** A poster is pointed at or held: every chip shows that title's level next to its own, and the card its poster. */
	const levels = (section: Element, ctx: PlayCtx, t: PlayTitle | null) => {
		const root = rootOf(section)
		if (!root) return
		const im = root.querySelector("[data-fn-im]")
		if (im) {
			const want = t ? core.src(t.p) : (im.getAttribute("data-fn-own") ?? "")
			if (want && im.getAttribute("src") !== want) im.setAttribute("src", want)
		}
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

	/** One of the three forms: the level chips, with its own navigation and card. */
	const form = (name: string, o: { mh: number; bar: (ctx: PlayCtx) => string; card: (ctx: PlayCtx, note: string) => string }) =>
		kit.make({
			name,
			mode: "bars",
			th: 56,
			tall: true,
			big: true,
			mh: o.mh,
			hint: "Its traits as chips. Tap a full one to drop it, a low one to add it.",
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
				mx.choose(ctx, arg, 3)
				return true
			},
			will: (ctx, act, arg) => (act === "tk" ? mx.after(ctx, arg, 3) : null),
			deco: (ctx, _list, places) => {
				const mark = mx.marks(ctx, mx.active(ctx), places)
				return mark ? (t) => ({ inner: mark(t), extra: "" }) : null
			},
			shown: (section, ctx, tokens, _act, arg) => lit(section, ctx, tokens, arg),
			peeked: levels,
			diff,
			bar: o.bar,
			card: o.card,
		})
	return { form, pathBar, posterTrail, strip, card }
}

/** fin1, path bar. The walk is one bar of labeled stops under the heading, and the card leads with the poster. */
const fin1: FinForm = (_core, _kit, _mx, fk) => fk.form("fin1", { mh: 344, bar: fk.pathBar, card: (ctx, note) => fk.card(ctx, note, true) })

/**
 * fin2, poster trail: the owner's pick. The walk is a row of small posters at the head of the card, so trail and
 * title are one bar and the card needs no poster of its own. Nothing but the heading sits above the chips.
 */
const fin2: FinForm = (_core, _kit, _mx, fk) => fk.form("fin2", { mh: 348, bar: () => "", card: (ctx, note) => fk.card(ctx, note, false, fk.posterTrail(ctx)) })

/** fin3, one card. The navigation is the head of the card: back, how far from where, and the way to the start. */
const fin3: FinForm = (_core, _kit, _mx, fk) => fk.form("fin3", { mh: 356, bar: () => "", card: (ctx, note) => fk.card(ctx, note, true, fk.strip(ctx)) })

export const FIN_FORMS: Record<string, FinForm> = { fin1, fin2, fin3 }
