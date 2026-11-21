// The streaming index (`/movies/streaming/us`): every service of the country as one calm row: logo and what it
// costs, how much it has, how much came and went this month, how many of its titles score 80+, and a fan of its best.
// Sort, filter and find re-order the rows in place, in one motion.
import { Link } from "@remix-run/react"
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "framer-motion"
import type { Kind } from "~/domain/browse/address"
import { kindNoun } from "~/domain/browse/address"
import type { StreamingIndexData } from "~/server/browse/streaming-page.server"
import { WRAP } from "../base"
import { FOCUS, QUICK_T } from "../motion"
import {
	Controls,
	Empty,
	Fan,
	Great,
	Logo,
	ModelTag,
	MoreButton,
	Month,
	StreamHead,
	fmt,
	hrefOf,
	useDirectory,
} from "./pieces"

/** Things that travel: ease-in-out, the same 380 ms as MOVE_T. */
export const MOVE = { duration: 0.38, ease: [0.65, 0, 0.35, 1] } as const

export function StreamingIndex({ data, kind }: { data: StreamingIndexData; kind: Kind }) {
	const d = useDirectory(data.services, 16)
	const reduce = useReducedMotion()
	const max = Math.max(1, ...data.services.map((s) => s.titles))
	const noun = kindNoun(kind)
	return (
		<>
			<StreamHead data={data} kind={kind} />
			<div className={`${WRAP} pb-10`}>
				<Controls d={d} ready={data.ready} />
				<LayoutGroup>
					<ol className="mt-5 divide-y divide-white/[0.07] border-y border-white/[0.07]">
						<AnimatePresence initial={false} mode="popLayout">
							{d.shown.map((s, i) => {
								const href = hrefOf(s, kind, data.country.code)
								return (
									<motion.li
										key={s.key}
										layout="position"
										// One motion per re-sort: rows that stay glide once; rows that come or go fade.
										initial={{ opacity: 0 }}
										animate={{ opacity: 1 }}
										exit={{ opacity: 0, transition: { duration: reduce ? 0 : 0.16 } }}
										transition={{
											layout: reduce ? { duration: 0 } : MOVE,
											opacity: { duration: reduce ? 0 : 0.2 },
										}}
										className="group relative grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-3 py-4 sm:gap-x-6 lg:grid-cols-[2rem_minmax(14rem,1.3fr)_minmax(10rem,1fr)_minmax(11rem,1fr)_minmax(7rem,0.6fr)_auto]"
									>
										<span className="hidden text-right font-mono text-sm text-gray-500 tabular-nums lg:block">
											{i + 1}
										</span>
										<Link
											to={href}
											prefetch="intent"
											className={`col-span-2 col-start-1 row-start-1 flex min-w-0 items-center gap-3.5 rounded-xl lg:col-span-1 lg:col-start-auto lg:row-start-auto ${FOCUS}`}
										>
											<Logo s={s} size={52} className={`${QUICK_T} group-hover:scale-[1.04]`} />
											<span className="min-w-0">
												<span className="block truncate text-lg font-bold text-white group-hover:text-amber-200">
													{s.name}
												</span>
												<span className="mt-1 flex">
													<ModelTag model={s.model} />
												</span>
											</span>
										</Link>
										<div className="col-start-3 row-start-1 justify-self-end lg:col-start-auto lg:row-start-auto lg:justify-self-auto">
											<p className="text-right text-lg font-bold text-white tabular-nums lg:text-left">
												{fmt(s.titles)}{" "}
												<span className="text-sm font-normal text-gray-400">{noun}</span>
											</p>
											<div
												aria-hidden
												className="mt-1.5 hidden h-1.5 overflow-hidden rounded-full bg-white/[0.06] lg:block"
											>
												<div
													className="h-full origin-left rounded-full bg-gradient-to-r from-sky-400/70 to-sky-300"
													style={{ transform: `scaleX(${Math.max(0.02, s.titles / max)})` }}
												/>
											</div>
										</div>
										<div className="col-span-2 lg:col-span-1">
											<Month s={s} />
										</div>
										<p className="col-start-3 row-start-2 text-sm text-gray-400 lg:col-start-auto lg:row-start-auto">
											<Great n={s.great} />
										</p>
										<div className="hidden justify-self-end sm:block">
											<Fan s={s} href={href} />
										</div>
									</motion.li>
								)
							})}
						</AnimatePresence>
					</ol>
				</LayoutGroup>
				<Empty d={d} />
				<MoreButton d={d} noun="services" />
			</div>
		</>
	)
}
