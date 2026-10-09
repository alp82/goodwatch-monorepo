// PROTOTYPE - throwaway. The parts the banner variants of /prototype/title-overview share, from round 2: the banner
// with the title on it, D's ratings bar (GoodWatch ring, your score as a pill), A's two rings, the tracking line and
// the compact actions. Round 2's own variants (E, F, G, H) are gone; rounds 3 and 4 build on these parts.
import { ChevronDownIcon, PencilIcon } from "@heroicons/react/20/solid"
import { useState } from "react"
import {
	ActionButton,
	EYEBROW,
	FOCUS,
	Floating,
	GoChip,
	ProgressBar,
	Ring,
	ScorePicker,
	Sized,
	StarIcon,
	StatusPill,
	TrailerPill,
	gwTone,
	gwWord,
	ink,
	tone,
	word,
} from "./kit"
import { type Api, type Member, type Title, img } from "./model"

const PANEL = "relative min-w-0 rounded-2xl border border-white/10 bg-stone-950"
const AMBER = "#fbbf24"

// ---------------------------------------------------------------------------------------------------------
// Banner, title
// ---------------------------------------------------------------------------------------------------------

/** The backdrop behind a banner, darkened at the bottom and the left, where the text is. Content sits over it with `relative`. */
export function BannerImage({ title, rounded }: { title: Title; rounded: string }) {
	return (
		<div className={`pointer-events-none absolute inset-0 overflow-hidden ${rounded}`} aria-hidden="true">
			<img src={img("w1280", title.backdrop)} alt="" className="h-full w-full object-cover object-[center_22%]" />
			<div className="absolute inset-0 bg-gradient-to-t from-stone-950 via-stone-950/60 to-stone-950/10" />
			<div className="absolute inset-0 bg-gradient-to-r from-stone-950/85 via-stone-950/20 to-transparent" />
		</div>
	)
}

export function TitleBlock({ title, className = "" }: { title: Title; className?: string }) {
	return (
		<div className={`min-w-0 ${className}`}>
			<h1 className="text-2xl font-bold leading-tight tracking-tight text-white [text-shadow:0_2px_14px_rgba(0,0,0,.7)] md:text-4xl">{title.name}</h1>
			<p className="mt-1 text-xs text-gray-300 [text-shadow:0_1px_8px_rgba(0,0,0,.8)] md:text-sm">{title.facts.join(" · ")}</p>
		</div>
	)
}

/** The trailer button in a banner's top right corner: a dot on a phone, the pill from md up. */
export function BannerTrailer() {
	return (
		<>
			<div className="absolute right-3 top-3 md:hidden">
				<TrailerPill compact />
			</div>
			<div className="absolute right-5 top-4 hidden md:block">
				<TrailerPill />
			</div>
		</>
	)
}

// ---------------------------------------------------------------------------------------------------------
// Ratings: D's bar (ring, pill, chip runs), the one-chip summary, and A's two rings
// ---------------------------------------------------------------------------------------------------------

function GoodWatch({ title, phone, wide, words = "sm" }: { title: Title; phone: number; wide: number; words?: "sm" | "always" }) {
	return (
		<div className="flex shrink-0 items-center gap-2.5" title="GoodWatch score: critics and audiences combined">
			<Sized phone={phone} wide={wide}>
				{(size) => (
					<Ring size={size} fraction={title.gw / 100} color={gwTone(title.gw)}>
						{title.gw}
					</Ring>
				)}
			</Sized>
			<div className={`leading-tight ${words === "sm" ? "hidden sm:block" : ""}`}>
				<p className="text-base font-bold" style={{ color: gwTone(title.gw) }}>
					{gwWord(title.gw)}
				</p>
				<p className="whitespace-nowrap text-xs text-gray-300">GoodWatch score</p>
			</div>
		</div>
	)
}

/** Your score as D's pill: the number on its colour and the word. Opens the picker as a dialog (a sheet on a phone). */
function OwnPill({ title, m, api }: { title: Title; m: Member; api: Api }) {
	const [picking, setPicking] = useState(false)
	const s = m.score
	return (
		<>
			<button
				type="button"
				data-own-score={s ?? "none"}
				aria-haspopup="dialog"
				aria-expanded={picking}
				onClick={() => setPicking(true)}
				className={`flex h-12 min-w-0 cursor-pointer items-center gap-2.5 rounded-xl text-left transition hover:brightness-110 ${s ? "pl-1.5 pr-3" : "bg-amber-400 px-4 text-black"} ${FOCUS}`}
				style={s ? { background: `${tone(s)}26`, boxShadow: `inset 0 0 0 1.5px ${tone(s)}` } : undefined}
			>
				{s ? (
					<>
						<span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-lg font-black tabular-nums" style={{ background: tone(s), color: ink(s) }}>
							{s}
						</span>
						<span className="min-w-0 leading-tight">
							<span className={`block whitespace-nowrap ${EYEBROW}`}>Your score</span>
							<span className="block truncate text-sm font-bold text-white">{word(s)}</span>
						</span>
						<PencilIcon className="h-3.5 w-3.5 shrink-0 text-gray-300" />
					</>
				) : (
					<>
						<StarIcon className="h-5 w-5 shrink-0" />
						<span className="whitespace-nowrap text-sm font-bold">Rate this {title.kind}</span>
					</>
				)}
			</button>
			<Floating open={picking} onClose={() => setPicking(false)} title={`Your score for ${title.name}`} wide="dialog">
				<ScorePicker
					value={s}
					kind={title.kind}
					onRate={(score) => {
						api.rate(score)
						setPicking(false)
					}}
					onClear={api.clear}
				/>
			</Floating>
		</>
	)
}

/** D's ratings bar without the chips: the GoodWatch ring, a hairline, your score. */
export function ScoreBar({ title, m, api, ring = { phone: 48, wide: 56 } }: { title: Title; m: Member; api: Api; ring?: { phone: number; wide: number } }) {
	return (
		<div data-ratings className="flex min-w-0 items-center gap-3">
			<GoodWatch title={title} {...ring} />
			<span className="h-9 w-px shrink-0 bg-white/15" aria-hidden="true" />
			<OwnPill title={title} m={m} api={api} />
		</div>
	)
}

/** A's two rings, small: GoodWatch and yours. Your ring opens the picker as a popover (a sheet on a phone). */
export function ScorePair({ title, m, api }: { title: Title; m: Member; api: Api }) {
	const [picking, setPicking] = useState(false)
	const s = m.score
	return (
		<div data-ratings className="flex items-center gap-4 md:gap-6">
			<div className="flex items-center gap-2.5" title="GoodWatch score: critics and audiences combined">
				<Sized phone={52} wide={64}>
					{(size) => (
						<Ring size={size} fraction={title.gw / 100} color={gwTone(title.gw)}>
							{title.gw}
						</Ring>
					)}
				</Sized>
				<div className="leading-tight">
					<p className={EYEBROW}>GoodWatch</p>
					<p className="text-base font-bold md:text-lg" style={{ color: gwTone(title.gw) }}>
						{gwWord(title.gw)}
					</p>
				</div>
			</div>
			<div className="relative">
				<button
					type="button"
					data-own-score={s ?? "none"}
					aria-haspopup="dialog"
					aria-expanded={picking}
					onClick={() => setPicking(!picking)}
					className={`-m-1.5 flex cursor-pointer items-center gap-2.5 rounded-2xl p-1.5 text-left transition-colors hover:bg-white/10 ${FOCUS}`}
				>
					<Sized phone={52} wide={64}>
						{(size) =>
							s ? (
								<Ring size={size} fraction={s / 10} color={tone(s)}>
									{s}
								</Ring>
							) : (
								<Ring size={size} fraction={0} color={AMBER} dashed>
									<StarIcon className="h-[1em] w-[1em] text-amber-300" />
								</Ring>
							)
						}
					</Sized>
					<span className="leading-tight">
						<span className={`block whitespace-nowrap ${EYEBROW}`}>Your score</span>
						<span className="flex items-center gap-1 text-base font-bold md:text-lg" style={{ color: s ? tone(s) : AMBER }}>
							{s ? word(s) : "Rate it"}
							<ChevronDownIcon className="h-4 w-4 text-gray-400" />
						</span>
					</span>
				</button>
				<Floating open={picking} onClose={() => setPicking(false)} title="Your score">
					<ScorePicker
						value={s}
						kind={title.kind}
						onRate={(score) => {
							api.rate(score)
							setPicking(false)
						}}
						onClear={api.clear}
					/>
				</Floating>
			</div>
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------
// Tracking as one line, and compact actions
// ---------------------------------------------------------------------------------------------------------

/** Status pill with its menu, "16/22" with a small bar, and the Next episode as a chip that leads to the list. */
export function TrackLine({ m, api, className = "" }: { m: Member; api: Api; className?: string }) {
	const t = api.tracking
	if (!t) return null
	const next = m.status === "watching" || m.status === "on_hold"
	return (
		<div data-tracking={m.status} className={`flex min-w-0 items-center gap-2.5 ${className}`}>
			{m.status === "not_started" ? (
				<p className="min-w-0 flex-1 truncate text-sm text-gray-300">
					<span className="font-semibold text-white">{t.eyebrow}</span> <span className="max-sm:hidden">{t.line}</span>
				</p>
			) : (
				<>
					<StatusPill status={m.status} tracking={t} api={api} />
					<span className="flex shrink-0 items-center gap-2" title={`${t.count} episodes`}>
						<span className="text-xs font-semibold tabular-nums text-white">{t.short}</span>
						<ProgressBar percent={t.percent} className="w-10 sm:w-20 xl:w-32" />
					</span>
				</>
			)}
			<a href="#episodes" data-next-episode className={`group ml-auto flex min-w-0 items-center gap-2 rounded-lg ${FOCUS}`}>
				{next && (
					<>
						<span className="shrink-0 text-xs text-gray-400">
							Next<span className="max-xl:hidden"> episode</span>
						</span>
						<span className="min-w-0 truncate text-xs font-medium text-gray-200 max-xl:hidden">{t.line}</span>
					</>
				)}
				<GoChip className="!h-9 !text-xs">{t.chip}</GoChip>
			</a>
		</div>
	)
}

/** Want to See, Seen and the third action at 36px. On a phone the third is its icon alone. */
export function MiniActions({ api, className = "" }: { api: Api; className?: string }) {
	return (
		<div data-actions className={`flex min-w-0 gap-2 ${className}`}>
			{api.actions.map((action, i) => (
				<ActionButton key={action.label} action={action} compact phoneIcon={i === 2} className={i === 2 ? "sm:flex-1 lg:flex-none" : "flex-1 lg:flex-none"} />
			))}
		</div>
	)
}
