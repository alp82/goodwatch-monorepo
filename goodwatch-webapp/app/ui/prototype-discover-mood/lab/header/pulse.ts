// PROTOTYPE (Discover lab, round 21, header b): after a jump, briefly mark the picked item where it lives. The tab's
// sections draw their own controls, so the item is found by its text in the open panel (the section first, then the
// footer chips), scrolled into view, and an amber outline fades in and out over it once (opacity and transform only).
import { norm } from "./hits"

const PICKABLE = "button, [role=radio], [role=switch], [role=option], [role=checkbox], label, a"

const visible = (el: Element) => {
	const r = el.getBoundingClientRect()
	return r.width > 0 && r.height > 0 && !el.closest("[data-lab-bar]")
}

function findIn(root: ParentNode, label: string): HTMLElement | null {
	const want = norm(label)
	let best: HTMLElement | null = null
	let bestRank = 0
	for (const el of root.querySelectorAll<HTMLElement>(PICKABLE)) {
		if (!visible(el)) continue
		const t = norm(el.textContent ?? "")
		if (!t) continue
		const rank = t === want ? 4 : t.startsWith(want) ? 3 : t.includes(want) ? 2 : 0
		if (!rank) continue
		// The best fit, and among those the smallest element (the control itself, not its group).
		if (rank > bestRank || (rank === bestRank && best && (el.textContent?.length ?? 0) < (best.textContent?.length ?? 0))) {
			best = el
			bestRank = rank
		}
	}
	return best
}

function mark(el: HTMLElement) {
	el.scrollIntoView({ block: "nearest", inline: "nearest" })
	// Measure after the scroll settles.
	requestAnimationFrame(() => {
		const r = el.getBoundingClientRect()
		const radius = getComputedStyle(el).borderRadius || "12px"
		const o = document.createElement("div")
		Object.assign(o.style, {
			position: "fixed",
			left: `${r.left - 3}px`,
			top: `${r.top - 3}px`,
			width: `${r.width + 6}px`,
			height: `${r.height + 6}px`,
			borderRadius: radius === "0px" ? "12px" : radius,
			boxShadow: "0 0 0 2px rgba(251,191,36,0.95), 0 0 22px 2px rgba(251,191,36,0.35)",
			pointerEvents: "none",
			zIndex: "2147482000",
			opacity: "0",
		})
		o.setAttribute("data-find-mark", "")
		document.body.appendChild(o)
		const a = o.animate(
			[
				{ opacity: 0, transform: "scale(1.12)" },
				{ opacity: 1, transform: "scale(1)", offset: 0.3 },
				{ opacity: 0, transform: "scale(1)" },
			],
			{ duration: 1100, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
		)
		a.onfinish = () => o.remove()
		a.oncancel = () => o.remove()
	})
}

/** Marks `label` once it shows (sections mount and load after the tab slides in); gives up after about 2 s. */
export function pulseLabel(label: string) {
	if (typeof window === "undefined") return
	let tries = 0
	const step = () => {
		tries++
		const sections = [...document.querySelectorAll("[data-lab-section]")].filter(visible)
		const panels = [...document.querySelectorAll("[data-lab-panel]")].filter(visible)
		const el = sections.map((s) => findIn(s, label)).find(Boolean) ?? panels.map((p) => findIn(p, label)).find(Boolean) ?? null
		if (el) return mark(el)
		if (tries < 12) window.setTimeout(step, 180)
	}
	// After the tab and sub-tab slide in.
	window.setTimeout(step, 320)
}
