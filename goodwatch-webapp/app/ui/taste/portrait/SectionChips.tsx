// The Taste page's sections as chips, sticky under the site header; the section in view is marked.
import { type MouseEvent, useEffect, useState } from "react"
import { WRAP } from "~/ui/my-pages/bits"

export interface Section {
	id: string
	label: string
}

/**
 * A chip scrolls to its section itself. Left to the browser, the hash change reaches Remix as a Back/Forward step, and
 * its ScrollRestoration puts back a saved offset: every hash entry shares the key "default", so the scroll often stops.
 * The hash is replaced without a history entry, keeping Remix's state, so Back still leaves the page in one step.
 */
function goTo(event: MouseEvent<HTMLAnchorElement>, id: string) {
	if (
		event.button !== 0 ||
		event.metaKey ||
		event.ctrlKey ||
		event.shiftKey ||
		event.altKey
	)
		return
	const el = document.getElementById(id)
	if (!el) return
	event.preventDefault()
	el.scrollIntoView({ block: "start" })
	window.history.replaceState(window.history.state, "", `#${id}`)
}

export function SectionChips({ sections }: { sections: Section[] }) {
	const [here, setHere] = useState(sections[0]?.id)
	useEffect(() => {
		const tops = new Map<string, number>()
		const io = new IntersectionObserver(
			(entries) => {
				for (const e of entries)
					tops.set(
						e.target.id,
						e.isIntersecting
							? e.boundingClientRect.top
							: Number.POSITIVE_INFINITY,
					)
				const first = [...tops.entries()]
					.filter(([, top]) => top !== Number.POSITIVE_INFINITY)
					.sort((a, b) => a[1] - b[1])[0]
				if (first) setHere(first[0])
			},
			{ rootMargin: "-170px 0px -55% 0px" },
		)
		for (const s of sections) {
			const el = document.getElementById(s.id)
			if (el) io.observe(el)
		}
		return () => io.disconnect()
	}, [sections])
	return (
		<nav
			aria-label="Taste sections"
			className="sticky top-16 z-40 border-b border-white/5 bg-gray-950/95"
		>
			<ul
				className={`${WRAP} flex gap-1.5 overflow-x-auto py-2 [scrollbar-width:none]`}
			>
				{sections.map((s) => (
					<li key={s.id} className="shrink-0">
						<a
							href={`#${s.id}`}
							onClick={(event) => goTo(event, s.id)}
							aria-current={here === s.id ? "true" : undefined}
							className={`inline-flex min-h-8 items-center rounded-full px-3 text-xs font-semibold whitespace-nowrap ring-1 transition-colors ${
								here === s.id
									? "bg-amber-400 text-gray-950 ring-amber-400"
									: "text-gray-400 ring-white/10 hover:text-white"
							}`}
						>
							{s.label}
						</a>
					</li>
				))}
			</ul>
		</nav>
	)
}
