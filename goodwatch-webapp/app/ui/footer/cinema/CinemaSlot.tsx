// Where the footer cinema plugs into the footer, and the only cinema code in a page's first load. Once the page has
// been used (a scroll, a pointer, a key) and the footer is within 600 px of the window, it loads the projector that
// peeks out of the footer's corner. The show itself loads only when someone reaches for the projector. A visitor who
// only reads the top of a page, or a crawler, never loads any of it.
import { type RefObject, Suspense, lazy, useEffect, useState } from "react"
import { onFirstInteraction } from "~/utils/first-interaction"
import { reloadOnStaleChunk } from "~/utils/stale-chunk"

const Projector = lazy(reloadOnStaleChunk(() => import("./Projector")))

export function CinemaSlot({
	footer,
}: { footer: RefObject<HTMLElement | null> }) {
	const [used, setUsed] = useState(false)
	const [near, setNear] = useState(false)

	useEffect(() => {
		onFirstInteraction(() => setUsed(true))
	}, [])

	useEffect(() => {
		const element = footer.current
		if (!element || near) return
		const observer = new IntersectionObserver(
			([entry]) => {
				if (entry.isIntersecting) setNear(true)
			},
			{ rootMargin: "600px 0px 600px 0px" },
		)
		observer.observe(element)
		return () => observer.disconnect()
	}, [footer, near])

	if (!used || !near) return null
	return (
		<Suspense fallback={null}>
			<Projector footer={footer} />
		</Suspense>
	)
}
