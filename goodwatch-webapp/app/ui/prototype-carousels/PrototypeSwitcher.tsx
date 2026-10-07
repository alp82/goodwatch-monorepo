// PROTOTYPE for "Prototype native-scroll carousels on title pages". Throwaway code: not for production.
//
// The floating bar that cycles through the variants. It shows only while the prototype is on for the request. Its
// arrows are plain links with `?proto=`, so they work before hydration, and the server sets the cookie that keeps
// the variant across titles. The left and right arrow keys cycle too.
import { useLocation } from "@remix-run/react"
import { useEffect } from "react"
import { useBelowFold } from "~/ui/details/below-fold"
import {
	CAROUSEL_BAR,
	CAROUSEL_VARIANT_NAMES,
	type CarouselVariant,
} from "~/ui/prototype-carousels/variant"

const SCROLL_KEY = "gw-proto-carousels-scroll"

export function PrototypeSwitcher({ variant }: { variant: CarouselVariant }) {
	const location = useLocation()
	const { layOutAll } = useBelowFold()
	// A variant that isn't in the bar (rows, list) counts as the first one.
	const at = Math.max(0, CAROUSEL_BAR.indexOf(variant))
	const hrefOf = (name: string) => {
		const params = new URLSearchParams(location.search)
		params.set("proto", name)
		return `${location.pathname}?${params}`
	}
	const step = (by: number) =>
		hrefOf(CAROUSEL_BAR[(at + by + CAROUSEL_BAR.length) % CAROUSEL_BAR.length])
	const prev = step(-1)
	const next = step(1)

	// A switch is a document load. Come back to where the visitor was.
	useEffect(() => {
		let stored: string | null = null
		try {
			stored = sessionStorage.getItem(SCROLL_KEY)
			sessionStorage.removeItem(SCROLL_KEY)
		} catch {}
		if (!stored) return
		layOutAll()
		window.scrollTo(0, Number(stored))
	}, [])

	useEffect(() => {
		const go = (href: string) => {
			try {
				sessionStorage.setItem(SCROLL_KEY, String(window.scrollY))
			} catch {}
			window.location.assign(href)
		}
		const onKey = (event: KeyboardEvent) => {
			const target = event.target as HTMLElement | null
			if (target?.closest("input, textarea, select, [contenteditable]")) return
			if (event.altKey || event.ctrlKey || event.metaKey) return
			if (event.key === "ArrowLeft") go(prev)
			if (event.key === "ArrowRight") go(next)
		}
		const onClick = (event: MouseEvent) => {
			if ((event.target as HTMLElement | null)?.closest("[data-proto-switch]"))
				try {
					sessionStorage.setItem(SCROLL_KEY, String(window.scrollY))
				} catch {}
		}
		window.addEventListener("keydown", onKey)
		document.addEventListener("click", onClick, true)
		return () => {
			window.removeEventListener("keydown", onKey)
			document.removeEventListener("click", onClick, true)
		}
	}, [prev, next])

	const arrow =
		"flex h-9 w-9 items-center justify-center rounded-full text-lg font-bold hover:bg-black/10"
	return (
		<div
			data-proto-switch=""
			className="fixed bottom-28 md:bottom-3 left-1/2 z-[1000] flex -translate-x-1/2 items-center gap-1 rounded-full bg-fuchsia-300 px-1 py-1 text-sm text-black shadow-[0_6px_24px_rgba(0,0,0,.6)] ring-2 ring-black/40"
		>
			<a href={prev} className={arrow} aria-label="Previous variant">
				‹
			</a>
			<span className="whitespace-nowrap px-1 text-center leading-tight">
				<span className="block text-[10px] uppercase tracking-wide opacity-70">
					Prototype {at + 1}/{CAROUSEL_BAR.length}
				</span>
				<span className="font-bold">{CAROUSEL_VARIANT_NAMES[variant]}</span>
			</span>
			<a href={next} className={arrow} aria-label="Next variant">
				›
			</a>
			<a
				href={hrefOf("off")}
				className={`${arrow} text-base`}
				aria-label="Turn the prototype off"
				title="Turn the prototype off"
			>
				×
			</a>
		</div>
	)
}
