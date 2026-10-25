// The member's taste in tags: the essence tags and tropes from the title analysis of everything they scored 8 or more,
// as a cloud where bigger is more often, and the way to their profile's Tropes tab.
import { Link } from "@remix-run/react"
import { useState } from "react"
import type { TasteTagCloud } from "~/domain/profile-taste"
import { profileTabPath } from "~/ui/profile/links"
import { PANEL, Pills, SectionHead } from "~/ui/profile/taste/parts"

export const tropesPath = (handle: string) => `${profileTabPath(handle)}/tropes`

type Which = keyof TasteTagCloud

export const hasTags = (tags: TasteTagCloud | null) =>
	!!tags && (tags.essence.length > 0 || tags.tropes.length > 0)

export function TasteTags({
	tags,
	handle,
}: { tags: TasteTagCloud | null; handle: string | null }) {
	const [picked, setPicked] = useState<Which>("essence")
	const shown = hasTags(tags)
	if (!shown && !handle) return null
	const which: Which =
		tags && !tags[picked].length
			? picked === "essence"
				? "tropes"
				: "essence"
			: picked
	const items = tags?.[which] ?? []
	const both = !!tags?.essence.length && !!tags.tropes.length
	const max = Math.max(...items.map((t) => t.count))
	const min = Math.min(...items.map((t) => t.count))
	const tropesLink = handle && (
		<Link
			to={tropesPath(handle)}
			prefetch="intent"
			className="inline-flex min-h-11 items-center text-sm font-bold text-amber-300 hover:text-amber-200"
		>
			All your tropes →
		</Link>
	)
	return (
		<section
			id="tags"
			aria-labelledby="tags-head"
			className="flex scroll-mt-44 flex-col gap-5"
		>
			<SectionHead
				id="tags-head"
				lead="Your taste, in"
				accent="tags"
				sub={
					shown
						? "From the title analysis of everything you scored 8 or more. Bigger is more often."
						: "What keeps showing up in what you love."
				}
				right={
					both ? (
						<Pills
							label="Tags"
							value={which}
							onChange={setPicked}
							options={[
								{ value: "essence", label: "Essence" },
								{ value: "tropes", label: "Tropes" },
							]}
						/>
					) : (
						!shown && tropesLink
					)
				}
			/>
			{shown && (
				<div className={`${PANEL} flex flex-col gap-4 p-5 sm:p-6`}>
					<ul className="flex flex-wrap items-baseline gap-x-5 gap-y-2">
						{items.map((t, i) => {
							const x = (t.count - min) / Math.max(1, max - min)
							return (
								<li
									key={t.name}
									className={`leading-tight font-semibold ${i < 5 ? "text-amber-400" : "text-gray-300"}`}
									style={{
										fontSize: `calc(0.85rem + ${x.toFixed(2)} * clamp(0.45rem, 2.4vw, 1.25rem))`,
									}}
								>
									{t.name}
									<span className="ml-1 align-baseline text-[11px] font-bold text-gray-500 tabular-nums">
										{t.count}
									</span>
								</li>
							)
						})}
					</ul>
					{tropesLink && (
						<div className="-mb-2 flex justify-end border-t border-white/5 pt-1">
							{tropesLink}
						</div>
					)}
				</div>
			)}
		</section>
	)
}
