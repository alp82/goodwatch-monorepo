// PROTOTYPE for "Prototype native-scroll carousels on title pages", second round. Throwaway code: not for production.
//
// What the five explore variants share: the frame of the section, a poster link, the caption of the focused title,
// the trail of a walk in place, and the one line of text links to the related titles a variant doesn't show.
//
// Every title is a plain link in the server HTML, so the section works without script. With script, a tap on a
// touch screen first focuses a poster (its reason shows) and a second tap opens it; a mouse focuses on hover.
import { Link } from "@remix-run/react"
import type React from "react"
import { type ReactNode, useEffect, useState } from "react"
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import { TmdbImage } from "~/ui/TmdbImage"
import type {
	ExploreModel,
	ExploreVariant,
	PxPick,
	PxTitle,
} from "~/ui/prototype-carousels/explore-model"
import { useCarouselPrototype } from "~/ui/prototype-carousels/variant"
import { titleToDashed } from "~/utils/helpers"

type Media = MovieResult | ShowResult
export type Center = Pick<PxTitle, "type" | "id" | "title"> &
	Partial<Pick<PxTitle, "year" | "poster">>

export const pathOf = (title: Pick<PxTitle, "type" | "id" | "title">) =>
	`/${title.type}/${title.id}-${titleToDashed(title.title)}`

/** True on a touch screen: the first tap on a poster focuses it, where a mouse would hover. */
export const tapFocusesFirst = () =>
	typeof window !== "undefined" && window.matchMedia("(hover: none)").matches

export const EXPLORE_SHARED_CSS = `
.px-more{display:flex;gap:.5rem;overflow-x:auto;white-space:nowrap;scrollbar-width:none;font-size:.8125rem;
color:#9ca3af;-webkit-mask-image:linear-gradient(90deg,#000 88%,transparent);mask-image:linear-gradient(90deg,#000 88%,transparent)}
.px-more::-webkit-scrollbar{display:none}
.px-more a{color:#d1d5db}
.px-more a:hover{color:#fff;text-decoration:underline}
.px-more a+a::before{content:"·";margin-right:.5rem;color:#6b7280;display:inline-block}
.px-more a:last-child{padding-right:3rem}
.px-p{display:block;border-radius:.375rem;overflow:hidden;box-shadow:0 4px 14px rgba(0,0,0,.55);
outline:2px solid rgba(255,255,255,.14);outline-offset:0;transition:outline-color .15s}
.px-p img{display:block;width:100%;height:auto;aspect-ratio:2/3;object-fit:cover;background:rgba(255,255,255,.06)}
.px-p:hover,.px-p:focus-visible,.px-p[data-on]{outline-color:#fbbf24}
.px-busy{opacity:.45;transition:opacity .15s}
`

/**
 * The model of the section, and a walk in place: a step onto a related title asks the server for what is around
 * that title and shows it here, with a trail back. Without a step it is what the page's loader computed.
 */
export function useExploreWalk(media: Media, variant: ExploreVariant) {
	const prototype = useCarouselPrototype()
	const root: Center = {
		type: media.mediaType,
		id: media.details.tmdb_id,
		title: media.details.title,
		year: String(media.details.release_year ?? ""),
		poster: media.details.poster_path,
	}
	const rootId = `${root.type}-${root.id}`
	// The walk belongs to the page's title: on another title page it starts over.
	const [walk, setWalk] = useState<{
		root: string
		trail: { center: Center; model: ExploreModel }[]
	} | null>(null)
	const [busy, setBusy] = useState(false)
	const trail = walk?.root === rootId ? walk.trail : []
	// A page whose loader had no related titles in time (they ran out of their budget) asks for the model here.
	const [late, setLate] = useState<{
		root: string
		model: ExploreModel
	} | null>(null)
	const embedded = prototype?.explore
	useEffect(() => {
		if (embedded) return
		let stale = false
		fetch(
			`/api/prototype-explore?variant=${variant}&type=${root.type}&id=${root.id}`,
		)
			.then((response) => (response.ok ? response.json() : null))
			.then((model) => {
				if (model && !stale) setLate({ root: rootId, model })
			})
			.catch(() => {})
		return () => {
			stale = true
		}
	}, [embedded, rootId, variant])
	const here = trail.length
		? trail[trail.length - 1]
		: {
				center: root,
				model: embedded ?? (late?.root === rootId ? late.model : undefined),
			}

	const step = async (title: PxTitle) => {
		setBusy(true)
		try {
			const response = await fetch(
				`/api/prototype-explore?variant=${variant}&type=${title.type}&id=${title.id}`,
			)
			if (!response.ok) throw new Error(String(response.status))
			const model = (await response.json()) as ExploreModel
			setWalk({ root: rootId, trail: [...trail, { center: title, model }] })
		} catch {
			// The link still opens the title.
			window.location.assign(pathOf(title))
		} finally {
			setBusy(false)
		}
	}
	return {
		root,
		center: here.center,
		model: here.model,
		/** Where the walk has been, the page's title first. */
		trail: [root, ...trail.map((entry) => entry.center)],
		/** How many steps the walk has taken. */
		depth: trail.length,
		step,
		/** Back to the nth place of the trail; 0 is the page's title. */
		back: (index: number) =>
			setWalk({ root: rootId, trail: trail.slice(0, index) }),
		busy,
		island: prototype?.island ?? null,
	}
}

type Walk = ReturnType<typeof useExploreWalk>

export function Trail({ walk }: { walk: Walk }) {
	if (walk.trail.length < 2) return null
	return (
		<ol className="flex flex-wrap items-center gap-x-1 text-sm text-gray-300">
			{walk.trail.map((place, index) => (
				<li key={`${place.type}-${place.id}-${index}`}>
					{index > 0 && <span aria-hidden="true">→ </span>}
					{index === walk.trail.length - 1 ? (
						<span className="font-bold text-white">{place.title}</span>
					) : (
						<button
							type="button"
							onClick={() => walk.back(index)}
							className="cursor-pointer underline hover:text-white"
						>
							{place.title}
						</button>
					)}
				</li>
			))}
		</ol>
	)
}

export function Frame({
	walk,
	hint,
	more: showMore = true,
	children,
}: {
	walk: Walk
	hint: ReactNode
	/** False for a form that already has many links in its HTML. */
	more?: boolean
	children: ReactNode
}) {
	const more = showMore ? (walk.model?.more ?? []) : []
	return (
		<section
			className="flex flex-col gap-4 rounded-xl border border-white/10 bg-white/5 p-4 sm:p-6"
			aria-busy={walk.busy}
		>
			{/* biome-ignore lint/security/noDangerouslySetInnerHtml: a constant of this file. */}
			<style dangerouslySetInnerHTML={{ __html: EXPLORE_SHARED_CSS }} />
			<div>
				<h2 className="text-2xl font-extrabold tracking-tight">
					Titles like {walk.center.title}
				</h2>
				<p className="mt-1 text-sm text-gray-300">
					{hint}
					{walk.island && walk.depth === 0 && (
						<>
							{" "}
							<a
								href={`/explorer?grouping=mood&island=${walk.island.id}`}
								className="whitespace-nowrap font-semibold text-gray-100 underline decoration-white/30 hover:decoration-white"
							>
								<span
									aria-hidden="true"
									className="mr-1 inline-block h-2.5 w-2.5 rounded-full"
									style={{ backgroundColor: walk.island.color }}
								/>
								{walk.island.name} island on the map
							</a>
						</>
					)}
				</p>
			</div>
			<Trail walk={walk} />
			{walk.model ? (
				children
			) : (
				<p className="rounded bg-amber-500/20 px-3 py-2 text-sm text-amber-200">
					Stub: the related titles or their fingerprints could not be read on
					this server.
				</p>
			)}
			{more.length > 0 && (
				<p className="px-more">
					<span>Also close:</span>
					{more.map((title) => (
						<a key={`${title.type}-${title.id}`} href={pathOf(title)}>
							{title.title} ({title.year})
						</a>
					))}
				</p>
			)}
		</section>
	)
}

/** A poster that links to its title. */
export function Poster({
	title,
	width,
	on,
	className = "",
	...rest
}: {
	title: PxTitle
	width: number
	on?: boolean
} & Omit<React.ComponentProps<typeof Link>, "to" | "title">) {
	return (
		<Link
			to={pathOf(title)}
			title={`${title.title} (${title.year})`}
			data-on={on ? "" : undefined}
			className={`px-p ${className}`}
			{...rest}
		>
			<TmdbImage
				kind="poster"
				path={title.poster}
				width={width}
				alt={`${title.title} (${title.year})`}
			/>
		</Link>
	)
}

/** The focused title of a stage: its name, why it is here, and where to go from it. */
export function Caption({
	pick,
	walk,
	className = "",
}: {
	pick: PxPick | undefined
	walk: Walk
	className?: string
}) {
	if (!pick) return null
	return (
		<div
			className={`flex min-w-0 flex-col gap-2 ${className}`}
			aria-live="polite"
		>
			<p className="flex items-baseline gap-2">
				<span className="truncate text-lg font-bold">{pick.title}</span>
				<span className="shrink-0 text-sm text-gray-400">
					{pick.year}
					{pick.type === "show" ? " · Show" : ""}
				</span>
				<span
					className={`ml-auto shrink-0 self-center rounded px-1.5 py-0.5 text-xs font-bold text-white bg-vibe-${Math.round(pick.score / 10) * 10}`}
				>
					{pick.score}
				</span>
			</p>
			<p className="min-h-10 text-sm leading-5 text-gray-200">{pick.why}</p>
			<p className="flex flex-wrap gap-2">
				<Link
					to={pathOf(pick)}
					prefetch="intent"
					className="rounded-lg bg-amber-400 px-3 py-1.5 text-sm font-bold text-black hover:bg-amber-300"
				>
					Open
				</Link>
				<button
					type="button"
					onClick={() => void walk.step(pick)}
					className="cursor-pointer rounded-lg border border-white/20 px-3 py-1.5 text-sm font-semibold hover:bg-white/10"
				>
					Show what's close to it
				</button>
			</p>
		</div>
	)
}

/** Which poster of a stage is focused. It starts at the first one, and starts over when the stage changes. */
export function useFocus(stageKey: string) {
	const [focus, setFocus] = useState({ stage: stageKey, index: 0 })
	const index = focus.stage === stageKey ? focus.index : 0
	// A tap also sends a mouse enter and a focus before its click. On a touch screen only the click may focus,
	// or the click would find its poster focused already and open it.
	const point = (at: number) => () => {
		if (!tapFocusesFirst()) setFocus({ stage: stageKey, index: at })
	}
	const handlers = (at: number) => ({
		on: at === index,
		onMouseEnter: point(at),
		onFocus: point(at),
		onClick: (event: React.MouseEvent) => {
			if (at === index || !tapFocusesFirst()) return
			event.preventDefault()
			setFocus({ stage: stageKey, index: at })
		},
	})
	return { index, handlers }
}
