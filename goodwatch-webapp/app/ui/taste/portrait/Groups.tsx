// The member's taste groups, two to a row on wide screens: posters, the name, one data line, two quiet traits, and the
// way into For you on that group. The group the address asks for (`?side=`, as the TV's Expand key links) is scrolled
// to, focused, and marked once the page opens.
import { useEffect, useRef } from "react"
import { ForYouLink } from "~/ui/for-you/ForYouLink"
import { DISPLAY } from "~/ui/my-pages/bits"
import { FAMILY_COLOR, useTaste } from "~/ui/profile/taste/model"
import { MiniPoster, PANEL } from "~/ui/profile/taste/parts"
import { TASTE_GROUPS_NAME } from "../taste-groups-name"

export function TasteGroups({
	requested = null,
}: { requested?: string | null }) {
	const { taste, title, attributeByKey } = useTaste()
	const groups = taste.sides.list
	const target = useRef<HTMLLIElement>(null)
	useEffect(() => {
		if (!requested || !target.current) return
		target.current.scrollIntoView({ block: "center" })
		target.current.focus({ preventScroll: true })
	}, [requested])
	if (!groups.length) return null
	const usual = taste.usual
	return (
		<section id="sides" aria-labelledby="sides-head" className="scroll-mt-44">
			<p className="mb-1 text-xs font-bold tracking-[0.18em] text-amber-400/80 uppercase">
				What you love, grouped
			</p>
			<h2 id="sides-head" className={`${DISPLAY} text-3xl sm:text-4xl`}>
				{TASTE_GROUPS_NAME.title}
			</h2>
			<ul className="mt-8 grid gap-6 md:grid-cols-2">
				{groups.map((g) => {
					const diff = usual != null ? g.average - usual : null
					const asked = g.id === requested
					return (
						<li
							key={g.id}
							ref={asked ? target : undefined}
							tabIndex={asked ? -1 : undefined}
							aria-current={asked ? "true" : undefined}
							className={`${PANEL} flex scroll-mt-44 flex-col gap-5 p-5 outline-none sm:p-7 ${asked ? "ring-2 ring-amber-400/70" : ""}`}
						>
							<ul className="grid grid-cols-4 gap-3">
								{g.here.slice(0, 4).map((k) => (
									<li key={k}>
										<MiniPoster title={title(k)} />
									</li>
								))}
							</ul>
							<div className="flex flex-col gap-2">
								<p className="text-2xl leading-tight font-bold text-white">
									{g.name}
								</p>
								<p className="text-sm text-gray-400">
									<span className="font-semibold text-gray-200">
										{g.count} titles
									</span>
									<span aria-hidden> · </span>
									you average {g.average}
									{diff != null && Math.abs(diff) >= 0.1 && (
										<span
											className={diff > 0 ? "text-green-400" : "text-rose-400"}
										>
											{" "}
											({diff > 0 ? "+" : ""}
											{diff.toFixed(1)})
										</span>
									)}
								</p>
								<p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
									{g.attributes.slice(0, 2).map((a) => {
										const family = attributeByKey.get(a.key)?.family
										return (
											<span
												key={a.key}
												className="inline-flex items-center gap-1.5"
											>
												<span
													aria-hidden
													className="size-1.5 rounded-full"
													style={{
														background: family
															? FAMILY_COLOR[family]
															: "#9ca3af",
													}}
												/>
												{a.label}
											</span>
										)
									})}
								</p>
							</div>
							<ForYouLink recipe={g.id} className="mt-auto">
								Recommend me from this
							</ForYouLink>
						</li>
					)
				})}
			</ul>
		</section>
	)
}
