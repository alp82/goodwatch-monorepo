// A guest's opening on the start page: the old TV's boot (living-room/intro/boot.tsx, sped up) drawn large in the
// empty band above the centered search block, then, at the hand-off, it fades out while it keeps shrinking and the
// site header slides down into its place. Members never get it: their HTML has none of this.
//
// Everything is CSS from the first paint (opening.css), since the app's scripts start after it and can be seconds
// late on a slow phone. Once a session (boot-gate.ts): the gate checkbox and its inline script come first, so a
// returning visitor's page is decided before any of the opening paints.
//
// - `OpeningBoot` goes first in the stage (StartStage's `opening`): the gate, then the boot, sized and placed from the
//   stage's own block height.
// - `OpeningCover` goes right after the stage: the night in the header's place while the header waits above the
//   screen. It is outside the stage, which contains fixed boxes (its size container).
import { useEffect, useLayoutEffect, useRef } from "react"
import { Boot } from "~/ui/living-room/intro/boot"
import {
	BOOT_GATE_ID,
	GATE_SCRIPT,
	sessionStore,
	skipOnClientMount,
} from "./boot-gate"

const useIsoLayoutEffect =
	typeof window === "undefined" ? useEffect : useLayoutEffect

export function OpeningBoot() {
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
			<div aria-hidden="true" className="start-opening">
				<Boot />
			</div>
		</>
	)
}

export function OpeningCover() {
	return <div aria-hidden="true" className="start-opening-cover" />
}
