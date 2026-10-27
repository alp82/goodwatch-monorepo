// PROTOTYPE (start page lab): how a · Three essentials: score, search, picks, one line each with the old section's tile pictures, and the link to /how-it-works.
import { Link } from "@remix-run/react"
import { useLab } from "../../lab/types"
import { ESSENTIALS } from "./visuals"

export function Essentials() {
	const { playIntro } = useLab()
	return (
		<section aria-labelledby="how-a-h" className="mx-auto max-w-6xl px-4 py-12 sm:px-8 md:py-16">
			<div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
				<div>
					<p className="text-xs font-bold uppercase tracking-[0.22em] text-amber-300/85">How it works</p>
					<h2 id="how-a-h" className="mt-1 text-2xl font-extrabold text-white md:text-4xl">
						How GoodWatch works
					</h2>
				</div>
				<div className="flex items-center gap-4">
					<button
						type="button"
						onClick={() => playIntro(null)}
						className="rounded-full bg-white/10 px-3.5 py-1.5 text-sm font-bold text-white/85 hover:bg-white/15 hover:text-white"
					>
						{"\u25B6\uFE0E"} Watch the intro
					</button>
					<Link to="/how-it-works" className="text-sm font-bold text-amber-300 hover:underline">
						Read how it works →
					</Link>
				</div>
			</div>
			<ol className="mt-6 grid gap-3 md:mt-8 md:grid-cols-3 md:gap-5">
				{ESSENTIALS.map(({ id, title, line, Visual }) => (
					<li
						key={id}
						className="grid grid-cols-[8.5rem_minmax(0,1fr)] overflow-hidden rounded-2xl bg-white/[0.035] ring-1 ring-inset ring-white/[0.07] md:grid-cols-1"
					>
						<div className="flex h-full min-h-[7.5rem] items-center justify-center overflow-hidden border-r border-white/[0.06] bg-[radial-gradient(90%_90%_at_50%_30%,#161b27_0%,#0a0d14_100%)] p-2 md:aspect-[16/9] md:border-b md:border-r-0 md:p-4">
							<div className="hgw w-full max-w-[18rem] [zoom:0.62] md:[zoom:0.85]" style={{ margin: 0 }}>
								<div className="flex justify-center">
									<Visual />
								</div>
							</div>
						</div>
						<div className="flex flex-col justify-center px-4 py-3 md:px-5 md:py-4">
							<h3 className="text-base font-extrabold leading-tight text-white md:text-lg">{title}</h3>
							<p className="mt-1 text-sm leading-snug text-gray-300">{line}</p>
						</div>
					</li>
				))}
			</ol>
		</section>
	)
}
