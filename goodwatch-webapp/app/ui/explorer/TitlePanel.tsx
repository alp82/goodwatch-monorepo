// The open title's details beside the map: a panel docked on the right edge that slides in at a fixed place with the
// quick view's card (QuickViewCard, as ExplorerQuickView fills it). It never dims the map or traps the focus, so the
// map's keys keep working: [ and ] step along the island, Enter puts the title on the big screen, Escape closes.
// Phones keep the quick view's drawer.
import {
	ArrowsPointingOutIcon,
	ChevronLeftIcon,
	ChevronRightIcon,
} from "@heroicons/react/20/solid"
import { useRef } from "react"
import type { ExplorerCard, ExplorerTitle } from "~/domain/explorer"
import { CARD, FrameContext } from "~/ui/quick-view/QuickView"
import { QuickViewCard } from "~/ui/quick-view/QuickViewCard"
import { SignUpPrompt } from "~/ui/sign-up-prompt/SignUpPrompt"
import type { TitleChange } from "~/ui/title-actions/TitleControl"
import { mediaFieldLanguage } from "~/utils/media-presentation"
import { titlePath } from "./titlePath"

/** The panel's width and its gap to the right edge (the zoom rail stays clear beside it). */
export const TITLE_PANEL = { w: CARD.w, right: 76, head: 44 } as const

function StepButton({
	dir,
	onStep,
	disabled,
}: {
	dir: -1 | 1
	onStep: (d: -1 | 1) => void
	disabled: boolean
}) {
	const Icon = dir < 0 ? ChevronLeftIcon : ChevronRightIcon
	return (
		<button
			type="button"
			onClick={() => onStep(dir)}
			disabled={disabled}
			aria-label={dir < 0 ? "Previous on this island" : "Next on this island"}
			className="grid size-8 cursor-pointer place-items-center rounded-lg border border-white/10 text-gray-200 transition-colors hover:border-amber-400/50 hover:bg-amber-400/10 hover:text-amber-300 disabled:cursor-default disabled:opacity-30 disabled:hover:border-white/10 disabled:hover:bg-transparent disabled:hover:text-gray-200"
		>
			<Icon className="size-5" />
		</button>
	)
}

export function TitlePanel({
	open,
	title,
	where,
	card,
	at,
	top,
	onStep,
	onClose,
	onChange,
	onScreen,
}: {
	open: boolean
	title: ExplorerTitle | null
	where: { name: string; color: string }
	card: ExplorerCard | null
	/** Where the title is among its island's titles. */
	at: { index: number; count: number } | null
	/** The panel's top in the stage, in px (under the map's controls). */
	top: number
	onStep: (d: -1 | 1) => void
	onClose: () => void
	onChange: (change: TitleChange) => void
	/** Puts the title on the big screen. */
	onScreen: () => void
}) {
	// The last title stays in the panel while it slides out.
	const last = useRef<{
		title: ExplorerTitle
		where: { name: string; color: string }
		card: ExplorerCard | null
		at: { index: number; count: number } | null
	} | null>(null)
	if (open && title) last.current = { title, where, card, at }
	const shown = last.current
	const t = shown?.title
	const meta = t
		? [
				t.year ? String(t.year) : "",
				t.mediaType === "show" ? "Show" : "Movie",
				t.genres.slice(0, 2).join(" and ").toLowerCase(),
			]
				.filter(Boolean)
				.join(" · ")
		: ""
	const c = shown?.card ?? null
	return (
		<aside
			aria-label="Title details"
			aria-hidden={!open}
			{...(open ? {} : { inert: "" })}
			className={`absolute z-[30] flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-gray-900 shadow-2xl shadow-black/60 transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${open ? "translate-x-0 opacity-100" : "pointer-events-none translate-x-[calc(100%+6rem)] opacity-0"}`}
			style={{
				right: TITLE_PANEL.right,
				top,
				width: TITLE_PANEL.w,
				height: `min(${CARD.h + TITLE_PANEL.head}px, calc(100% - ${top + 20}px))`,
			}}
			// The map's pointer handling never sees presses on the panel.
			onPointerDown={(e) => e.stopPropagation()}
			onWheel={(e) => e.stopPropagation()}
		>
			<div
				className="flex shrink-0 items-center gap-2 border-b border-white/[0.07] px-3"
				style={{ height: TITLE_PANEL.head }}
			>
				<span
					className="size-2 shrink-0 rounded-full"
					style={{
						background: shown?.where.color,
						boxShadow: `0 0 10px ${shown?.where.color ?? "transparent"}`,
					}}
				/>
				<span className="min-w-0 truncate text-[13px] font-bold text-gray-100">
					{shown?.where.name}
				</span>
				{shown?.at && (
					<span className="shrink-0 text-[12px] text-gray-500 tabular-nums">
						{shown.at.index + 1} / {shown.at.count}
					</span>
				)}
				<span className="ml-auto hidden shrink-0 items-center gap-1 text-[11px] text-gray-500 lg:flex">
					<kbd className="rounded border border-white/15 px-1 font-sans text-gray-400">
						[
					</kbd>
					<kbd className="rounded border border-white/15 px-1 font-sans text-gray-400">
						]
					</kbd>
				</span>
				<button
					type="button"
					onClick={onScreen}
					title="Big screen (Enter)"
					className="flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-amber-400/40 bg-amber-400/10 px-2 text-[12px] font-bold text-amber-300 transition-colors hover:border-amber-400/70 hover:bg-amber-400/20"
				>
					<ArrowsPointingOutIcon className="size-4" />
					Big screen
				</button>
				<div className="ml-1 flex shrink-0 gap-1 lg:ml-0">
					<StepButton
						dir={-1}
						onStep={onStep}
						disabled={!shown?.at || shown.at.index <= 0}
					/>
					<StepButton
						dir={1}
						onStep={onStep}
						disabled={!shown?.at || shown.at.index >= shown.at.count - 1}
					/>
				</div>
			</div>
			<div className="relative flex min-h-0 flex-1 flex-col">
				{t && (
					<FrameContext.Provider
						value={{ form: "card", steps: null, close: onClose }}
					>
						<QuickViewCard
							key={t.key}
							title={{
								media: {
									mediaType: t.mediaType,
									details: {
										tmdb_id: t.tmdbId,
										title: t.title,
										poster_path: t.poster,
										release_year: t.year,
									},
								},
								href: titlePath(t),
								meta,
								lang: mediaFieldLanguage(t),
								poster: t.poster,
								backdrop: t.backdrop,
								goodwatch: t.score,
								eyebrow: (
									<span className="inline-flex items-center gap-1.5">
										<span
											className="size-2 rounded-full"
											style={{ background: shown?.where.color }}
										/>
										{shown?.where.name}
									</span>
								),
								match: c?.signUp ? null : t.match,
								reason: c ? (
									c.why
								) : (
									<p className="text-[14px] text-gray-500">
										Looking at why it fits you…
									</p>
								),
								note: c?.signUp ? (
									<SignUpPrompt feature="tasteMatch" size="inline" />
								) : undefined,
								services: c
									? c.services.map((s) => ({
											id: s.id,
											name: s.name,
											logo_path: s.logo,
										}))
									: null,
								story: c ? c.title.overview : undefined,
								onChange,
							}}
						/>
					</FrameContext.Provider>
				)}
			</div>
		</aside>
	)
}
