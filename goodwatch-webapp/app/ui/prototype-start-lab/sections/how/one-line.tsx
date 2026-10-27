// PROTOTYPE (start page lab): how c · One line: a slim strip with the heading, three short facts inline, Watch the intro and Read how it works.
import { Link } from "@remix-run/react"
import { useLab } from "../../lab/types"
import { ESSENTIALS } from "./visuals"

export function OneLine() {
	const { playIntro } = useLab()
	return (
		<section aria-labelledby="how-c-h" className="mx-auto max-w-6xl px-4 py-6 sm:px-8">
			<div className="flex flex-col gap-3 rounded-2xl bg-white/[0.04] px-4 py-3.5 ring-1 ring-inset ring-white/[0.08] lg:flex-row lg:items-center lg:gap-6 lg:px-5">
				<h2 id="how-c-h" className="shrink-0 text-base font-extrabold text-white">
					How GoodWatch works
				</h2>
				<ul className="flex min-w-0 flex-1 flex-wrap gap-x-4 gap-y-1 text-sm text-gray-300">
					{ESSENTIALS.map((e) => (
						<li key={e.id} className="flex items-center gap-2">
							<span aria-hidden className="size-1.5 shrink-0 rounded-full bg-amber-400" />
							{e.short}
						</li>
					))}
				</ul>
				<div className="flex shrink-0 items-center gap-4">
					<button
						type="button"
						onClick={() => playIntro(null)}
						className="rounded-full bg-white/10 px-3.5 py-1.5 text-sm font-bold text-white hover:bg-white/15"
					>
						{"\u25B6\uFE0E"} Watch the intro
					</button>
					<Link to="/how-it-works" className="text-sm font-bold text-amber-300 hover:underline">
						Read how it works →
					</Link>
				</div>
			</div>
		</section>
	)
}
