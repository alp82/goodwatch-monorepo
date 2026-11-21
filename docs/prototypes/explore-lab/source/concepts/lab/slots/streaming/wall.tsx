// PROTOTYPE - throwaway (prototype/explore-r7, slot "streaming"). Variant "Logo wall": every service of the country as
// a tile you can scan in one look: the logo large, its name, its library and what's new this month (round 8: plain
// facts under fixed labels, nothing that judges the value), and a fan of its best. The same country picker, find, cost and sort as the directory; tiles glide when re-sorted.
import { Link } from "@remix-run/react"
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "framer-motion"
import { kindNoun } from "../../../../kit/address"
import { FOCUS, WRAP } from "../../../../kit/ui"
import { QUICK_T } from "../../../../kit/ui/motion"
import type { PageViewProps, SlotVariant } from "../../contract"
import { MOVE } from "./directory"
import {
	Controls,
	Empty,
	Fan,
	Logo,
	ModelTag,
	MoreButton,
	StreamHead,
	fmt,
	hrefOf,
	useDirectory,
} from "./pieces"
import type { StreamDir } from "./shared.server"

function View({ data, to }: PageViewProps<StreamDir>) {
	const d = useDirectory(data.services, 15)
	const reduce = useReducedMotion()
	const noun = kindNoun(data.kind)
	return (
		<>
			<StreamHead data={data} to={to} />
			<div className={`${WRAP} pb-10`}>
				<Controls d={d} ready={data.ready} />
				<LayoutGroup>
					<ol className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
						<AnimatePresence initial={false} mode="popLayout">
							{d.shown.map((s) => {
								const href = hrefOf(s, data.kind, data.country.code, to)
								return (
									<motion.li
										key={s.key}
										layout="position"
										// One motion per re-sort: tiles that stay glide once; tiles that come or go fade (round 11).
										initial={{ opacity: 0 }}
										animate={{ opacity: 1 }}
										exit={{ opacity: 0, transition: { duration: reduce ? 0 : 0.16 } }}
										transition={{
											layout: reduce ? { duration: 0 } : MOVE,
											opacity: { duration: reduce ? 0 : 0.2 },
										}}
										className={`group relative flex min-h-[9.5rem] items-stretch gap-4 overflow-hidden rounded-2xl bg-white/[0.035] p-4 ring-1 ring-white/[0.08] hover:bg-white/[0.06] hover:ring-white/15 transition-[background-color,box-shadow] duration-[320ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none`}
									>
										<div className="flex min-w-0 flex-1 flex-col">
											<Link
												to={href}
												prefetch="intent"
												className={`flex min-w-0 items-center gap-3 rounded-xl after:absolute after:inset-0 after:content-[''] ${FOCUS}`}
											>
												<Logo s={s} size={56} className={`${QUICK_T} group-hover:scale-[1.04]`} />
												<span className="min-w-0">
													<span className="block truncate text-lg font-bold text-white group-hover:text-amber-200">
														{s.name}
													</span>
													<span className="mt-1 flex">
														<ModelTag model={s.model} />
													</span>
												</span>
											</Link>
											<dl className="mt-auto grid grid-cols-2 gap-x-3 pt-4 text-sm">
												<div className="min-w-0">
													<dt className="truncate text-gray-400">Library</dt>
													<dd className="font-bold text-white tabular-nums">
														{fmt(s.titles)}{" "}
														<span className="font-normal text-gray-400">{noun}</span>
													</dd>
												</div>
												<div className="min-w-0">
													<dt className="truncate text-gray-400">New this month</dt>
													<dd className="truncate font-bold text-white tabular-nums">
														{s.arrived ? (
															<>
																{fmt(s.arrived)}{" "}
																<span className="font-normal text-gray-400">{noun}</span>
															</>
														) : (
															<span className="font-normal text-gray-400">None yet</span>
														)}
													</dd>
												</div>
											</dl>
										</div>
										<div className="relative z-10 hidden shrink-0 self-center min-[420px]:block">
											<Fan s={s} href={href} size={48} />
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

export const variant: SlotVariant<StreamDir> = {
	id: "wall",
	name: "Logo wall",
	what: "Every service of the country as a tile: the logo large, its library and what's new this month as plain numbers, a fan of its best. Same country picker, find, cost and sort as the directory.",
	order: 20,
	View,
}
