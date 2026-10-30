// Compare-to-me for a signed-in visitor, at the top of someone else's Taste tab. TasteMatch owns the open state, the
// #compare hash and the header chip's request (compare-link.ts), then renders the strip (twins/Strip.tsx), whose panels
// open under it (twins/Panels.tsx).
import { useReducedMotion } from "framer-motion"
import { useEffect, useRef, useState } from "react"
import type { MemberCompare } from "~/domain/profile-taste"
import type { ProfileShell } from "~/domain/profile"
import { COMPARE_ID, onCompareRequest, scrollUnderRows } from "../compare-link"
import { ThinMatch } from "./twins/parts"
import TwinsStrip from "./twins/Strip"

export function TasteMatch({ shell, compare }: { shell: ProfileShell; compare: MemberCompare }) {
	const still = useReducedMotion() ?? false
	const [open, setOpen] = useState(false)
	const topRef = useRef<HTMLDivElement>(null)
	// Set by the chip or #compare: once open, scroll the top of the first card to just under the sticky rows.
	const [scroll, setScroll] = useState(0)
	useEffect(() => {
		const reveal = () => {
			setOpen(true)
			setScroll((n) => n + 1)
		}
		if (window.location.hash === `#${COMPARE_ID}`) reveal()
		return onCompareRequest(reveal)
	}, [])
	useEffect(() => {
		if (scroll && open && topRef.current) scrollUnderRows(topRef.current)
	}, [scroll, open])
	if (compare.status === "thin") return <ThinMatch compare={compare} handle={shell.handle} />
	const toggle = () => {
		if (open && window.location.hash === `#${COMPARE_ID}`)
			window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search)
		setOpen(!open)
	}
	return (
		<TwinsStrip
			shell={shell}
			compare={compare}
			open={open}
			toggle={toggle}
			topRef={topRef}
			still={still}
			label="Compare your tastes side by side"
			sectionId={COMPARE_ID}
		/>
	)
}
