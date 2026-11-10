// The start page's pre-paint session decision, before SiteChrome's header and main.
import { useEffect, useLayoutEffect, useRef } from "react"
import {
	BOOT_GATE_ID,
	GATE_SCRIPT,
	sessionStore,
	skipOnClientMount,
} from "./boot-gate"

const useIsoLayoutEffect =
	typeof window === "undefined" ? useEffect : useLayoutEffect

export function OpeningGate() {
	const gate = useRef<HTMLInputElement>(null)
	// A client-side visit: the inline script didn't run (React doesn't run it), so the box is decided here, before the
	// first paint of the new page.
	useIsoLayoutEffect(() => skipOnClientMount(gate.current, sessionStore), [])
	return (
		<>
			<input
				ref={gate}
				id={BOOT_GATE_ID}
				type="checkbox"
				hidden
				tabIndex={-1}
				aria-hidden="true"
			/>
			{/* biome-ignore lint/security/noDangerouslySetInnerHtml: a constant script, see boot-gate.ts */}
			<script dangerouslySetInnerHTML={{ __html: GATE_SCRIPT }} />
		</>
	)
}
