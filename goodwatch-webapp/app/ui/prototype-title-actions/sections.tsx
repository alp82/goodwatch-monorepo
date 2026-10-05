// PROTOTYPE - throwaway. The other surfaces of /prototype/title-actions, each a copy of the real one with the unified
// action set: the Explorer popup, the title page hero's action area, Watch next's finish dialog, the Hidden titles
// list, the toast, and the state panel.
import { StarIcon } from "@heroicons/react/20/solid"
import { CheckIcon } from "@heroicons/react/24/solid"
import { useState } from "react"
import type { TitleCard } from "~/server/title-cards.server"
import ScoreRing from "~/ui/details/hero/ScoreRing"
import { getScoreLabelText } from "~/utils/ratings"
import { ActionSet, TitleAction, TitleScore } from "./controls"
import { TitlePopup, fakeMedia } from "./popup"
import { type UndoStyle, type VariantKey, useStore } from "./store"

const TMDB = "https://image.tmdb.org/t/p"

export function Section({ n, title, note, children }: { n: number; title: string; note: string; children: React.ReactNode }) {
	return (
		<section className="mt-12 first:mt-6" data-section={n}>
			<header className="mb-4">
				<h2 className="text-base font-bold tracking-tight text-gray-100 sm:text-lg md:text-xl lg:text-2xl">
					<span className="mr-2 text-gray-500">{n}</span>
					{title}
				</h2>
				<p className="mt-1 max-w-3xl text-sm text-gray-400">{note}</p>
			</header>
			{children}
		</section>
	)
}

// How each variant fits the set into the Explorer's card.
const POPUP_FORM: Record<VariantKey, "full" | "compact" | "compact-link" | "collapsed"> = {
	quick: "compact",
	peek: "compact-link",
	menu: "collapsed",
	"footer-bolder": "compact",
}

export function ExplorerSection({ card }: { card: TitleCard }) {
	const s = useStore()
	return (
		<div className="flex justify-center rounded-2xl bg-[#04060d] p-4 ring-1 ring-white/10 sm:justify-start sm:p-8">
			<TitlePopup
				card={card}
				form={POPUP_FORM[s.variant]}
				where="Dark and tense"
				onClose={() => s.say("Closes the card (off in this prototype)")}
				className="max-w-full"
			/>
		</div>
	)
}

/** The hero's box (~/ui/details/hero/DetailsHero.tsx) without the trailer and where-to-watch parts. */
export function HeroSection({ card }: { card: TitleCard }) {
	const s = useStore()
	const [open, setOpen] = useState(false)
	const score = s.scoreOf(card.key)
	const collapsed = s.variant === "menu"
	const look = score
		? `bg-vibe-${score * 10} text-white`
		: "bg-yellow-400 text-black hover:bg-yellow-300 md:border-2 md:border-yellow-400 md:bg-transparent md:text-yellow-300 md:hover:bg-yellow-400/10"
	return (
		<div className="grid gap-4 md:grid-cols-[14rem_minmax(0,1fr)] [&>*]:min-w-0">
			<img
				src={card.poster_path ? `${TMDB}/w342${card.poster_path}` : undefined}
				alt=""
				className="hidden aspect-[2/3] w-full rounded-xl object-cover md:block"
			/>
			<div className="relative isolate flex min-w-0 flex-col rounded-2xl border border-white/10 bg-stone-950 md:rounded-xl">
				<div className="absolute inset-0 -z-10 overflow-hidden rounded-2xl md:rounded-xl" aria-hidden="true">
					{card.backdrop_path && <img src={`${TMDB}/w780${card.backdrop_path}`} alt="" className="h-full w-full scale-110 object-cover object-[center_25%]" />}
					<div className="absolute inset-0 bg-black/65 backdrop-blur-sm" />
					<div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/70" />
				</div>
				<div className="flex grow flex-col px-4 pb-5 pt-4 md:p-5 lg:p-7">
					<div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-5 gap-y-4">
						<ScoreRing media={fakeMedia(card)} size={72} label={false} />
						{collapsed ? (
							<button
								type="button"
								onClick={() => setOpen(!open)}
								aria-expanded={open}
								className={`inline-flex h-11 w-full items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 text-base font-bold shadow-lg shadow-black/30 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${look}`}
							>
								<StarIcon className="h-5 w-5" />
								{score ? `Your score: ${getScoreLabelText(score)}` : "Rate this"}
							</button>
						) : (
							<div className="min-w-0">
								<p className="truncate text-lg font-bold text-white">
									{card.title}
									{card.release_year ? ` (${card.release_year})` : ""}
								</p>
								<p className="text-xs text-gray-300">GoodWatch score</p>
							</div>
						)}
					</div>
					{collapsed && open && (
						<div className="mt-4">
							<TitleScore card={card} size="full" onDone={() => setOpen(false)} />
						</div>
					)}
					<div aria-hidden="true" className="my-5 h-px bg-white/10" />
					<p className="text-sm text-gray-400">Where to watch (unchanged, left out here)</p>
					<div className="min-h-6 grow" />
					<div aria-hidden="true" className="mb-5 h-px bg-white/10" />
					{collapsed ? (
						<div className="flex items-center gap-2 [&>*]:min-w-0 [&>*]:flex-1">
							<TitleAction card={card} kind="want" />
							<TitleAction card={card} kind="seen" />
							<TitleAction card={card} kind="hide" />
						</div>
					) : (
						<ActionSet card={card} form="full" />
					)}
				</div>
			</div>
		</div>
	)
}

/** The panel of ~/ui/watch-next/FinishPrompt.tsx, drawn in the page instead of in a dialog. */
export function FinishSection({ card }: { card: TitleCard }) {
	const s = useStore()
	const compact = s.variant === "menu" || s.variant === "footer-bolder"
	return (
		<div className="flex justify-center rounded-2xl bg-black/60 p-0 sm:p-8">
			<div className="w-full rounded-2xl border border-white/10 bg-stone-900 p-5 text-white shadow-2xl shadow-black/70 sm:w-[26rem]">
				<div className="flex items-center gap-3">
					<img src={card.poster_path ? `${TMDB}/w154${card.poster_path}` : undefined} alt="" className="h-20 w-[3.35rem] shrink-0 rounded-md object-cover" />
					<div className="min-w-0">
						<p className="text-xs font-semibold text-green-300">
							<CheckIcon className="mr-1 inline h-3.5 w-3.5" aria-hidden />
							Moved to Seen
						</p>
						<p className="truncate text-lg font-bold">How was {card.title}?</p>
						<p className="text-xs text-gray-400">Your score sharpens what we suggest next.</p>
					</div>
				</div>
				<div className="mt-4">
					<TitleScore card={card} size={compact ? "compact" : "full"} narrow />
				</div>
				<div className="mt-4 flex justify-end">
					<button type="button" onClick={() => s.say("Closes the dialog without a score")} className="cursor-pointer rounded-lg px-3 py-2 text-sm text-gray-300 hover:bg-white/10">
						Rate later
					</button>
				</div>
			</div>
		</div>
	)
}

/** A settings page section: every title marked Not interested, newest first, with Unhide. */
export function HiddenList() {
	const s = useStore()
	const keys = [...s.hidden].reverse()
	return (
		<div className="px-2 md:px-4 lg:px-8">
			<div className="flex max-w-2xl flex-col gap-4 text-gray-300">
				<h2 className="text-base font-bold tracking-tight text-gray-100 sm:text-lg md:text-xl lg:text-2xl">Hidden titles</h2>
				<p className="text-sm text-gray-400">
					Titles you marked Not interested. They stay out of your recommendations (For you, Watch next, the Explorer). You can still find them in search and in
					lists.
				</p>
				{keys.length === 0 ? (
					<p className="rounded-md border border-gray-700 px-4 py-6 text-sm text-gray-400">No hidden titles. Mark a title Not interested and it shows up here.</p>
				) : (
					<ul className="divide-y divide-gray-700 rounded-md border border-gray-700" data-hidden-list>
						{keys.map((key) => {
							const card = s.T(key)
							if (!card) return null
							return (
								<li key={key} className="flex items-center gap-3 px-3 py-2">
									<img src={card.poster_path ? `${TMDB}/w92${card.poster_path}` : undefined} alt="" className="h-14 w-[2.35rem] shrink-0 rounded object-cover" />
									<span className="min-w-0 grow">
										<span className="block truncate text-base font-medium text-gray-100">{card.title}</span>
										<span className="block text-xs text-gray-400">
											{[card.release_year, card.media_type === "show" ? "Series" : "Film"].filter(Boolean).join(" · ")}
										</span>
									</span>
									<button
										type="button"
										onClick={() => s.unhide(key)}
										className="shrink-0 cursor-pointer rounded-md border border-gray-600 px-3 py-1.5 text-sm font-medium text-gray-200 hover:bg-gray-800 hover:text-white"
									>
										Unhide
									</button>
								</li>
							)
						})}
					</ul>
				)}
				{keys.length > 1 && (
					<button
						type="button"
						onClick={() => keys.forEach((key) => s.unhide(key))}
						className="self-start text-sm text-gray-400 underline decoration-white/20 underline-offset-2 hover:text-white cursor-pointer"
						data-unhide-all
					>
						Unhide all ({keys.length})
					</button>
				)}
			</div>
		</div>
	)
}

/** The look of Watch next's FinishToast. */
export function Toast() {
	const s = useStore()
	const toast = s.toast
	return (
		<div className="pointer-events-none fixed inset-x-0 bottom-24 z-[1050] flex justify-center px-4 lg:bottom-20" aria-live="polite">
			{toast && (
				<div
					key={toast.id}
					className="pointer-events-auto flex max-w-full items-center gap-3 rounded-2xl border border-white/10 bg-stone-900/95 py-2 pl-4 pr-2 text-sm text-white shadow-2xl shadow-black/60 backdrop-blur"
					data-toast
				>
					<span className="min-w-0">{toast.text}</span>
					{toast.prev ? (
						<button type="button" onClick={s.undo} className="shrink-0 cursor-pointer rounded-full bg-white/10 px-3 py-1 font-semibold text-amber-300 hover:bg-white/20">
							Undo
						</button>
					) : (
						<span className="w-2" />
					)}
				</div>
			)}
		</div>
	)
}

const UNDO: Record<UndoStyle, string> = { toast: "Toast with Undo", tile: "Undo tile in place" }

/** The store's state, and the one switch that is independent of the variant. */
export function StatePanel() {
	const s = useStore()
	const names = (keys: number[]) => (keys.length ? keys.map((key) => s.T(key)?.title ?? key).join(", ") : "none")
	const scores = Object.entries(s.scores)
	return (
		<aside className="rounded-xl border border-fuchsia-500/50 bg-gray-950/95 p-3 font-mono text-[11px] leading-relaxed text-gray-300" data-state-panel>
			<div className="mb-2 flex flex-wrap items-center gap-2 font-sans text-xs">
				<span className="font-bold text-fuchsia-300">Prototype state</span>
				<span className="text-gray-500">After Not interested:</span>
				{(Object.keys(UNDO) as UndoStyle[]).map((style) => (
					<button
						key={style}
						type="button"
						aria-pressed={s.undoStyle === style}
						onClick={() => s.setUndoStyle(style)}
						data-undo-style={style}
						className={`cursor-pointer rounded-full px-2.5 py-1 font-semibold ${s.undoStyle === style ? "bg-white text-black" : "bg-white/10 text-gray-200 hover:bg-white/20"}`}
					>
						{UNDO[style]}
					</button>
				))}
				<button type="button" onClick={s.reset} className="ml-auto cursor-pointer rounded-full bg-white/10 px-2.5 py-1 font-semibold text-gray-200 hover:bg-white/20">
					Reset
				</button>
			</div>
			<dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3">
				<dt className="text-gray-500">scores</dt>
				<dd data-state="scores">{scores.length ? scores.map(([key, n]) => `${s.T(Number(key))?.title ?? key}: ${n}`).join(", ") : "none"}</dd>
				<dt className="text-gray-500">want to see</dt>
				<dd data-state="want">{names(s.want)}</dd>
				<dt className="text-gray-500">seen</dt>
				<dd data-state="seen">{names(s.seen)}</dd>
				<dt className="text-gray-500">not interested</dt>
				<dd data-state="hidden">{names(s.hidden)}</dd>
			</dl>
		</aside>
	)
}
