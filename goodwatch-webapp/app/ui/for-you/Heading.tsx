import { DISPLAY } from "~/ui/my-pages/bits"

/** The page's heading: shown on desktop over the steering, and on every screen over the other states. */
export function Heading({ className = "" }: { className?: string }) {
	return (
		<header className={className}>
			<p className="text-[11px] font-bold tracking-[0.18em] text-amber-400/80 uppercase">
				For you
			</p>
			<h1 className={`${DISPLAY} text-3xl leading-tight text-white`}>
				<span className="font-light text-gray-300">What are you </span>
				<span className="text-amber-400">in the mood for?</span>
			</h1>
		</header>
	)
}
