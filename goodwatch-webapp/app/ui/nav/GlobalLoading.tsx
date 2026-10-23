import { useNavigation } from "@remix-run/react"
import { useEffect, useState } from "react"

/** How long the full bar takes to fade once the new page is there. */
const FINISH_MS = 300

// The bar shows in the first frame of a page change: its animation starts at a quarter of the width and creeps on from
// there, so a press is answered before any data comes back. Transform and opacity only, so it never lays out the page.
function GlobalLoading() {
	const navigation = useNavigation()
	const active = navigation.state !== "idle"
	const [finishing, setFinishing] = useState(false)
	// Set during the render that ends the page change, so the bar never shows a frame of its resting state between
	// the animation and the fade.
	const [wasActive, setWasActive] = useState(active)
	if (wasActive !== active) {
		setWasActive(active)
		setFinishing(!active)
	}

	useEffect(() => {
		if (!finishing) return
		const timer = setTimeout(() => setFinishing(false), FINISH_MS)
		return () => clearTimeout(timer)
	}, [finishing])

	const bar = active
		? "animate-nav-progress"
		: finishing
			? "scale-x-100 opacity-0 transition-opacity duration-300 ease-out"
			: "scale-x-0 opacity-0"
	return (
		// biome-ignore lint/a11y/useFocusableInteractive: a page-wide loading indicator is not a control
		<div
			role="progressbar"
			aria-hidden={!active}
			aria-valuemin={0}
			aria-valuemax={100}
			aria-valuenow={active ? undefined : 0}
			aria-valuetext={active ? "Loading" : undefined}
			className={`pointer-events-none fixed inset-x-0 top-0 left-0 z-50 h-1 ${active ? "animate-pulse" : ""}`}
		>
			<div
				className={`h-full origin-left bg-linear-to-r from-blue-500 to-indigo-500 ${bar}`}
			/>
		</div>
	)
}

export { GlobalLoading }
