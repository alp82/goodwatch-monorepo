// A guest's opening on the start page: the old TV's boot (living-room/intro/boot.tsx, sped up) drawn large in the
// empty band above the waiting search block, then, at the hand-off, it fades out while it keeps shrinking and the
// site header slides down into its place. Members never get it: their HTML has none of this.
//
// Everything is CSS from the first paint (opening.css), since the app's scripts start after it and can be seconds
// late on a slow phone. Once a session (boot-gate.ts): OpeningGate is before the site header and main in SiteChrome,
// so its checkbox and inline script decide before any of the opening paints.
//
// - `OpeningGate` goes before the header and main: CSS can use sibling selectors without a page-wide :has lookup.
// - `OpeningBoot` goes first in the stage (StartStage's `opening`): the boot, sized from the stage's own block height.
// - `OpeningCover` goes right after the stage: the night in the header's place while the header waits above the
//   screen. It is outside the stage, which contains fixed boxes (its size container).
import { Boot } from "~/ui/living-room/intro/boot"

export function OpeningBoot() {
	return (
		<div aria-hidden="true" className="start-opening">
			<Boot />
		</div>
	)
}

export function OpeningCover() {
	return <div aria-hidden="true" className="start-opening-cover" />
}
