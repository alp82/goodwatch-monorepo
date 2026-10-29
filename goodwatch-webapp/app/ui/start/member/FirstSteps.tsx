// What a member with nothing on any list sees where "this or that" would be: three first steps. Each step is one big
// link (a row on phones, a column from 640 px), so nothing here waits for data and the box keeps its size.
import { ArrowRightIcon } from "@heroicons/react/20/solid"
import { Link } from "@remix-run/react"
import { RatingsBar } from "./Doors"
import { MEMBER_HREF } from "./doors"
import { PERSONAL_AT } from "./member-data"

const PILL =
	"inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-full bg-amber-400 px-5 text-sm font-black text-gray-950 group-hover:bg-amber-300"

const STEPS = [
	{
		title: "Rate a few titles",
		line: `Tap the ones you've seen. Picks get personal at ${PERSONAL_AT} ratings.`,
		cta: "Start rating",
		href: MEMBER_HREF.taste,
		progress: true,
	},
	{
		title: "Bring your ratings",
		line: "From IMDb, Letterboxd, Trakt, Plex and more.",
		cta: "Import",
		href: MEMBER_HREF.imports,
		progress: false,
	},
	{
		title: "Find something",
		line: "Search by mood above, or browse Discover.",
		cta: "Open Discover",
		href: MEMBER_HREF.discover,
		progress: false,
	},
]

export function FirstSteps({ ratings }: { ratings: number }) {
	return (
		<div className="flex h-full flex-col pt-3">
			<div className="flex h-10 items-center">
				<h2 className="truncate text-base font-bold text-white lg:text-lg">
					Start here
				</h2>
			</div>
			<p className="text-sm text-gray-300">
				Three ways to get your first picks.
			</p>
			<ol className="mt-4 grid gap-3 sm:grid-cols-3 lg:gap-5">
				{STEPS.map((step, i) => (
					<li key={step.href} className="min-w-0">
						<Link
							to={step.href}
							prefetch="intent"
							className="group flex h-full items-center gap-3 rounded-2xl bg-gray-900/90 p-4 outline-none ring-1 ring-white/10 transition-colors hover:bg-gray-900 hover:ring-amber-400/50 focus-visible:ring-2 focus-visible:ring-amber-300 sm:flex-col sm:items-start sm:gap-2 sm:p-5 lg:p-6"
						>
							<span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-400/15 text-sm font-black text-amber-300 ring-1 ring-amber-400/40 sm:mb-1">
								{i + 1}
							</span>
							<span className="min-w-0 flex-1">
								<span className="block text-base font-bold text-white lg:text-lg">
									{step.title}
								</span>
								<span className="mt-0.5 block text-sm leading-snug text-gray-400">
									{step.line}
								</span>
								{step.progress ? (
									<RatingsBar have={ratings} className="mt-2.5 max-sm:hidden" />
								) : null}
							</span>
							<ArrowRightIcon
								aria-hidden
								className="h-5 w-5 shrink-0 text-amber-400 sm:hidden"
							/>
							<span className={`${PILL} mt-3 max-sm:hidden sm:mt-auto`}>
								{step.cta}
								<ArrowRightIcon
									aria-hidden
									className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
								/>
							</span>
						</Link>
					</li>
				))}
			</ol>
		</div>
	)
}
