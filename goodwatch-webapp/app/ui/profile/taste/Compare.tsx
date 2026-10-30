// Compare-to-me for a signed-in visitor, at the top of someone else's Taste tab. TasteMatch owns the open state, the
// #compare hash and the header chip's request (compare-link.ts), then renders one of the designs (round 15,
// nav-options `twins`: 4 is the compact strip, a to e build on it; PROTOTYPE OPTIONS, remove after the owner picks).
// The shared pieces are in twins/parts.tsx and twins/V4-kit.tsx.
import { useReducedMotion } from "framer-motion"
import { useEffect, useRef, useState } from "react"
import type { MemberCompare, } from "~/domain/profile-taste"
import type { ProfileShell } from "~/domain/profile"
import { type NavOptions, useNavOptions } from "~/ui/navigation/nav-options"
import { COMPARE_ID, onCompareRequest, scrollUnderRows } from "../compare-link"
import { ThinMatch } from "./twins/parts"
import type { TwinsProps } from "./twins/types"
import V4 from "./twins/V4"
import Va from "./twins/Va"
import Vb from "./twins/Vb"
import Vc from "./twins/Vc"
import Vd from "./twins/Vd"
import Ve from "./twins/Ve"

const VARIANTS: Record<NavOptions["twins"], (props: TwinsProps) => JSX.Element> = {
	"4": V4, a: Va, b: Vb, c: Vc, d: Vd, e: Ve,
}

export function TasteMatch({ shell, compare }: { shell: ProfileShell; compare: MemberCompare }) {
	const still = useReducedMotion() ?? false
	const variant = useNavOptions().twins
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
	const Variant = VARIANTS[variant] ?? Va
	return (
		<Variant
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
