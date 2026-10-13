// One title, large: its backdrop is the picture, its name and facts stand at the bottom left over its keys. The
// title screen draws it with Watch, Want to See and Seen it; Tonight draws it with Details and Another one
// (Tonight.tsx). A chunk the TV asks for on first use (screen-code.tsx).
//
// The title screen's three keys are the machine's (`tvItems`). Watch opens the title's page on GoodWatch at its
// streaming block; leaving for the page itself is the Expand key, whose place the Frame keeps at the bottom right.
import { tmdbImageUrl } from "~/utils/tmdb-image"
import { Frame, Item, backdropSize, useTvView } from "../kit"
import {
	type TvKnownTitle,
	type TvTitleOnScreen,
	parseTvTitleKey,
	seenLabel,
	titleKicker,
	wantLabel,
	watchKey,
	whereLine,
} from "../tv-title"

/** A phone's canvas shorter than this is a short phone's: the keys are a little lower, so three still fit. */
const SHORT_PHONE = 400

/** A long name is set smaller, so it stays on two lines. */
const nameSize = (name: string, large: number, small: number) =>
	name.length > 16 ? small : large

export type TitleKey = {
	id: string
	label: string
	/** A key that has nothing to do right now ("Not streaming"). */
	quiet?: boolean
}

export function TitleView({
	name,
	crumb,
	items,
	title,
	heading,
	kicker,
	where,
	line,
	keys,
}: {
	/** The screen's name in the top bar, and what stands under it. */
	name: string
	crumb?: string
	/** The screen's items, from `tvItems`. */
	items: readonly string[]
	title: TvKnownTitle | null
	/** What stands in the name's place while there is no title to show. */
	heading?: string
	kicker?: string
	/** "On Netflix", or nothing while nobody knows. */
	where?: string | null
	line?: string | null
	keys: readonly TitleKey[]
}) {
	const { canvas } = useTvView()
	const P = canvas.edition === "phone"
	const short = P && canvas.h < SHORT_PHONE
	const shown = title?.title ?? heading ?? ""
	const score = title?.goodwatch_overall_score_normalized_percent
	return (
		<Frame
			name={name}
			crumb={crumb}
			items={items}
			art={
				title?.backdrop_path
					? tmdbImageUrl(title.backdrop_path, backdropSize(canvas))
					: undefined
			}
			dim={0.45}
		>
			<div className="flex min-h-full flex-col justify-end">
				{!P && kicker && (
					<div className="text-[24px] font-bold uppercase tracking-[0.16em] text-white/75">
						{kicker}
					</div>
				)}
				<div
					className="mt-2 line-clamp-2 font-bold leading-[0.95] tracking-tight"
					style={{
						fontSize: P ? nameSize(shown, 44, 32) : nameSize(shown, 96, 66),
					}}
				>
					{shown}
				</div>
				<div
					className={`flex flex-wrap items-center ${P ? "mt-2.5 gap-x-5 text-[21px]" : "mt-5 gap-x-7 text-[30px]"}`}
				>
					{score != null && (
						<span>
							<b>{Math.round(score)}</b>{" "}
							<span className="text-white/65">score</span>
						</span>
					)}
					{title?.match != null && (
						<span>
							<b>{title.match}%</b> <span className="text-white/65">match</span>
						</span>
					)}
					{where && <span className="text-white/80">{where}</span>}
				</div>
				{!P && line && (
					<div className="mt-3 line-clamp-2 max-w-[760px] text-[28px] leading-snug text-white/90">
						{line}
					</div>
				)}
				{/* The phone: the keys in a column on the left; the corner beside the last one is the Expand key's. */}
				<div
					className={`flex ${P ? "mt-3.5 w-[292px] flex-col gap-2" : "mt-8 gap-4"}`}
				>
					{keys.map((key) => (
						<Item
							key={key.id}
							id={key.id}
							className={`tvc-btn flex items-center justify-center whitespace-nowrap ${key.quiet ? "[&:not(.tvc-on)]:text-white/55" : ""} ${P ? `shrink-0 text-[21px] ${short ? "h-[46px]" : "h-[52px]"}` : "h-[74px] px-9 text-[28px]"}`}
						>
							{key.label}
						</Item>
					))}
				</div>
			</div>
		</Frame>
	)
}

export default function Title({
	items,
	title: on,
}: {
	/** The screen's items, from `tvItems`. */
	items: readonly string[]
	title: TvTitleOnScreen
}) {
	const title = on.title
	const watch = watchKey(title, on.mine)
	const keys: TitleKey[] = [
		{ id: "watch", label: watch.label, quiet: !watch.goes },
		{ id: "want-to-see", label: wantLabel(on.want) },
		{ id: "seen", label: seenLabel(on.score, on.seen) },
	]
	return (
		<TitleView
			// The key says which of the two it is before anything else is known.
			name={parseTvTitleKey(on.key)?.mediaType === "show" ? "Show" : "Movie"}
			items={items}
			title={title}
			heading={on.missing ? "GoodWatch doesn't have this title." : undefined}
			kicker={title ? titleKicker(title) : undefined}
			where={whereLine(title, on.mine)}
			line={title?.tagline}
			keys={keys.filter((key) => items.includes(key.id))}
		/>
	)
}
