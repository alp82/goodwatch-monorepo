// Title page sections below the first screen skip their style and layout work until they are near the viewport
// (`content-visibility: auto`, the .below-fold rule in main.css). Their markup stays in the server HTML, and a
// browser still finds their text with its in-page search.
//
// Until a section is laid out, the browser reserves the estimated height from section-heights.ts. An estimate is
// off by some pixels, so the sections are only skipped where nothing depends on their exact place:
// - on a document load, which is where the first paint counts. A page that opens after a navigation inside the app
//   lays out every section, so a restored scroll position is exact.
// - until something jumps into the page: a section link, a hash in the URL, or a reload that restores a scroll
//   position. Every section is laid out first, so the jump lands where it did before.
import {
	type CSSProperties,
	type ComponentPropsWithoutRef,
	type ReactNode,
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react"
import { flushSync } from "react-dom"
import { useHydrated } from "~/utils/hydrated"
import type { ReservedHeight } from "~/ui/details/section-heights"

interface BelowFold {
	/** Whether sections below the fold skip their layout until they are near the viewport. */
	skipping: boolean
	/** Lays out every section now. Call it before scrolling to a place in the page. */
	layOutAll: () => void
}

const BelowFoldContext = createContext<BelowFold>({
	skipping: false,
	layOutAll: () => {},
})

export const useBelowFold = () => useContext(BelowFoldContext)

export function BelowFoldProvider({
	titleKey,
	children,
}: {
	/** Identifies the title. Another title in the same mounted page lays out every section. */
	titleKey: string
	children: ReactNode
}) {
	// False in the server's HTML and while the browser takes it over: only that render skips sections.
	const openedInApp = useHydrated()
	const [skipping, setSkipping] = useState(!openedInApp)
	const firstTitle = useRef(titleKey)
	const realign = useRef<string | null>(null)

	const layOutAll = useCallback(() => {
		flushSync(() => setSkipping(false))
	}, [])

	useEffect(() => {
		if (titleKey !== firstTitle.current) setSkipping(false)
	}, [titleKey])

	useEffect(() => {
		const hash = window.location.hash
		const [entry] = performance.getEntriesByType(
			"navigation",
		) as PerformanceNavigationTiming[]
		// A reload or a step back in the history restores the scroll position against the estimated heights.
		const restored = entry && entry.type !== "navigate" && window.scrollY > 0
		if (hash || restored) {
			realign.current = hash ? hash.slice(1) : null
			setSkipping(false)
		}
		const onHashChange = () => setSkipping(false)
		window.addEventListener("hashchange", onHashChange)
		return () => window.removeEventListener("hashchange", onHashChange)
	}, [])

	// The browser scrolled to the hash against the estimated heights. Land on the target again now that they are real.
	useEffect(() => {
		if (skipping || realign.current === null) return
		const id = realign.current
		realign.current = null
		try {
			document.getElementById(decodeURIComponent(id))?.scrollIntoView()
		} catch {}
	}, [skipping])

	const value = useMemo(() => ({ skipping, layOutAll }), [skipping, layOutAll])
	return (
		<BelowFoldContext.Provider value={value}>
			{children}
		</BelowFoldContext.Provider>
	)
}

/** The class and the reserved height for a section's wrapper. Merges with the wrapper's own class. */
export function belowFoldProps(
	skipping: boolean,
	reserved: ReservedHeight,
	className = "",
): { className?: string; style?: CSSProperties } {
	if (!skipping) return className ? { className } : {}
	return {
		className: `below-fold ${className}`.trim(),
		style: {
			"--reserve": `${reserved.phone}px`,
			"--reserve-md": `${reserved.desktop}px`,
		} as CSSProperties,
	}
}

// Work a section needs only once the reader comes near it (its requests, its pictures, a drawing's fine detail) waits
// until then: a visitor who reads the first screen never asks for it. The margin is short of the first screen's
// neighbour, so that a phone's first view starts none of it, and a reader who scrolls gets it before it shows.
const NEAR_MARGIN = "400px 0px"

const NearContext = createContext(true)

/** Whether the title page section this is in has come near the viewport. Latched; always true outside a section. */
export const useSectionNear = () => useContext(NearContext)

/** A title page section that tells its parts (useSectionNear) once it comes near the viewport. */
export function NearSection({
	children,
	...props
}: ComponentPropsWithoutRef<"section">) {
	const ref = useRef<HTMLElement>(null)
	const [near, setNear] = useState(false)
	useEffect(() => {
		const el = ref.current
		if (!el || typeof IntersectionObserver === "undefined") {
			setNear(true)
			return
		}
		const observer = new IntersectionObserver(
			(entries) => {
				if (!entries.some((entry) => entry.isIntersecting)) return
				observer.disconnect()
				setNear(true)
			},
			{ rootMargin: NEAR_MARGIN },
		)
		observer.observe(el)
		return () => observer.disconnect()
	}, [])
	return (
		<section ref={ref} {...props}>
			<NearContext.Provider value={near}>{children}</NearContext.Provider>
		</section>
	)
}
