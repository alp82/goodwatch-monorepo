import { PlusIcon } from "@heroicons/react/24/solid"
import { Link } from "@remix-run/react"
import { AnimatePresence, MotionConfig, motion } from "framer-motion"
import type React from "react"
import { useRef, useState } from "react"
import { MAX_PICKS } from "~/domain/taste-picker"
import type { WatchNextSort } from "~/domain/watch-next"
import type { WatchNext } from "~/server/watch-next.server"
import {
	FilterGroup,
	FilterSheet,
	FilterSummaryRow,
} from "~/ui/filter-bar/PhoneFilters"
import { ServiceStack, radioKeys } from "~/ui/filter-bar/controls"
import { Knob, TAP } from "~/ui/filter-bar/motion"
// Watch next's and My movies' controls on phones (below the large breakpoint), the B3 way: one quiet line in the page
// under the pick naming the filters in use and the count, opening one sheet with moods, where to watch, sort, and
// the page's own extra group (My movies' "How long?"). The sheet is a labeled modal with a focus trap, closing with
// Escape, the backdrop, a drag down, or its Show button (ui/filter-bar/PhoneFilters.tsx).
import { SERVICES_PATH } from "~/ui/settings/paths"
import { SignUpPrompt } from "~/ui/sign-up-prompt/SignUpPrompt"
import { mediaFieldLanguage } from "~/utils/media-presentation"
import { type MoodControl, MoodGrid, useRefusalHint } from "./MoodPicker"
import {
	RATE_MORE,
	SORT_LABEL,
	SORT_OPTIONS,
	pickName,
	titleCount,
} from "./labels"

/** A fourth group in the sheet, from the page that owns it: "How long?" on My movies (#385). */
export interface ExtraDrawer {
	key: "time"
	title: string
	/** The choice in use, for the summary line. */
	label: string
	icon: React.ReactNode
	/** A choice other than the default is in use. */
	on: boolean
	body: React.ReactNode
	/** Back to the default, for Clear all. */
	clear: () => void
}

export interface PhoneControlsProps {
	data: WatchNext | null
	moods: MoodControl | null
	setOnMyServices: (on: boolean) => void
	setSort: (sort: WatchNextSort) => void
	extra?: ExtraDrawer | false
}

// "Show 23 that fit", "Show 151 on your services", "Show 349 titles"; "Done" when there is nothing to show.
function showLabel(data: WatchNext | null): string {
	if (!data) return "Done"
	const timed = Boolean(data.time)
	const picked = data.picker.picks.length > 0
	const filtered = picked || data.onMyServices || timed
	const n = filtered ? data.fitting : data.total
	if (!n) return "Done"
	// `time` is there on My movies only, also for any length.
	if (!filtered)
		return data.time === undefined
			? `Show ${titleCount(n)}`
			: `Show ${n} ${n === 1 ? "movie" : "movies"}`
	return picked || timed ? `Show ${n} that fit` : `Show ${n} on your services`
}

/** A drawer's top line, in the sheet's drag area. */
function DrawerHead({ children }: { children: React.ReactNode }) {
	return (
		<div className="flex min-h-11 items-center gap-3 px-4 pb-1">{children}</div>
	)
}

function MoodsHead({ control }: { control: MoodControl }) {
	const k = control.picker.picks.length
	const hint = useRefusalHint(control)
	return (
		<DrawerHead>
			<AnimatePresence mode="wait" initial={false}>
				{hint ? (
					<motion.p
						key="hint"
						data-hint
						initial={{ opacity: 0 }}
						animate={{ opacity: 1, x: [0, -4, 4, -2, 0] }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.35 }}
						className="min-w-0 flex-1 text-sm font-semibold text-amber-300"
					>
						{hint}
					</motion.p>
				) : (
					<motion.h3
						key="title"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0, transition: { duration: 0.08 } }}
						className="min-w-0 flex-1 text-sm font-bold text-white"
					>
						Moods <span className="font-normal text-gray-400">up to three</span>
					</motion.h3>
				)}
			</AnimatePresence>
			<span
				className={`shrink-0 text-sm tabular-nums ${k === MAX_PICKS ? "font-semibold text-amber-300" : "text-gray-400"}`}
			>
				{k} of {MAX_PICKS}
			</span>
			{k > 0 && (
				<button
					type="button"
					onClick={control.clear}
					className="min-h-11 shrink-0 cursor-pointer rounded-full px-2.5 text-sm font-semibold text-gray-200 hover:bg-white/10"
				>
					Clear
				</button>
			)}
		</DrawerHead>
	)
}

function ServicesBody({
	data,
	setOnMyServices,
}: {
	data: WatchNext
	setOnMyServices: (on: boolean) => void
}) {
	if (!data.hasServices)
		return (
			<div className="px-4 pb-4">
				<Link
					to={SERVICES_PATH}
					className="flex w-full items-center gap-3 rounded-xl bg-white/[0.05] p-3 text-left ring-1 ring-white/10"
				>
					<span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/10">
						<PlusIcon className="h-5 w-5 text-gray-200" aria-hidden />
					</span>
					<span className="min-w-0 flex-1">
						<span className="block text-sm font-bold text-white">
							Add my services
						</span>
						<span className="block text-xs text-gray-400">
							Pick your streaming services and what you can play comes first.
						</span>
					</span>
				</Link>
			</div>
		)
	const on = data.onMyServices
	return (
		<div className="px-4 pb-4">
			<motion.button
				type="button"
				role="switch"
				aria-checked={on}
				whileTap={TAP}
				data-services-switch
				onClick={() => setOnMyServices(!on)}
				className="flex w-full cursor-pointer items-center gap-3 rounded-xl bg-white/[0.05] p-3 text-left ring-1 ring-white/10 outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
			>
				<ServiceStack providers={data.myServices} on={on} size={28} />
				<span className="min-w-0 flex-1">
					<span className="block text-sm font-bold text-white">
						On my services
					</span>
					<span className="block text-xs text-gray-400">
						{on
							? "What you can play right now comes first."
							: "Off: titles on any service count the same."}
					</span>
				</span>
				<Knob
					on={on}
					size="lg"
					onClass="bg-emerald-500 shadow-[0_0_14px_rgba(16,185,129,.45)]"
				/>
			</motion.button>
		</div>
	)
}

/** A guest's sort drawer carries the sign-up prompt for Best match. */
const signUpPrompted = (data: WatchNext) =>
	data.bestMatch.prompt === "signUpToLearn" ||
	data.bestMatch.prompt === "signUpToKeep"

function SortBody({
	data,
	setSort,
	checkedRef,
}: {
	data: WatchNext
	setSort: (sort: WatchNextSort) => void
	/** The checked sort, where focus goes when the drawer opens. */
	checkedRef: React.RefObject<HTMLButtonElement>
}) {
	const { bestMatch } = data
	const pick = (sort: WatchNextSort) => {
		if (sort === "match" && !bestMatch.available) return
		setSort(sort)
	}
	const guestPrompt = signUpPrompted(data)
	return (
		<div className="px-4 pb-4">
			<div
				className="grid grid-cols-2 gap-2"
				role="radiogroup"
				aria-label="Sort"
				onKeyDown={(event) =>
					radioKeys(event, (index) => pick(SORT_OPTIONS[index].key))
				}
			>
				{SORT_OPTIONS.map((option) => {
					const on = option.key === data.sort
					const unavailable = option.key === "match" && !bestMatch.available
					return (
						<motion.button
							key={option.key}
							ref={on ? checkedRef : undefined}
							// biome-ignore lint/a11y/useSemanticElements: a tile grid; the buttons carry the radio role and arrow keys
							type="button"
							role="radio"
							aria-checked={on}
							aria-disabled={unavailable || undefined}
							tabIndex={on ? 0 : -1}
							data-sort={option.key}
							whileTap={unavailable ? undefined : TAP}
							onClick={() => pick(option.key)}
							// Amber marks what taste decides: only Best match lights up amber.
							className={`flex cursor-pointer flex-col items-start rounded-xl p-2.5 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 ${on ? (option.key === "match" ? "bg-amber-400 text-black" : "bg-white text-black") : "bg-white/[0.05] text-white ring-1 ring-white/10"} ${unavailable ? "cursor-default opacity-60" : ""}`}
						>
							<span className="text-sm font-bold">{option.label}</span>
							<span
								className={`mt-0.5 line-clamp-2 text-[11px] leading-snug ${on ? "text-black/70" : "text-gray-400"}`}
							>
								{unavailable && bestMatch.prompt === "rateMore"
									? RATE_MORE
									: option.hint}
							</span>
						</motion.button>
					)
				})}
			</div>
			{guestPrompt && (
				<SignUpPrompt
					feature="bestMatch"
					stage={bestMatch.prompt === "signUpToKeep" ? "keep" : "learn"}
					size="card"
					className="mt-4"
				/>
			)}
		</div>
	)
}

/** The summary line's words: only what differs from the defaults. */
function activeWords(data: WatchNext, extra?: ExtraDrawer): string[] {
	const words = data.picker.picks.map((id) => pickName(data.picker, id))
	if (data.hasServices && !data.onMyServices) words.push("Everywhere")
	if (extra?.on) words.push(extra.label)
	if (data.sort !== data.defaultSort) words.push(SORT_LABEL[data.sort])
	return words
}

/** "23 movies" / "349 titles": what the line and the Show button count. */
function countWords(data: WatchNext): string {
	const filtered =
		data.picker.picks.length > 0 || data.onMyServices || Boolean(data.time)
	const n = filtered ? data.fitting : data.total
	return data.time === undefined
		? titleCount(n)
		: `${n} ${n === 1 ? "movie" : "movies"}`
}

export function PhoneControls({
	data,
	moods,
	setOnMyServices,
	setSort,
	extra: extraOrNot,
}: PhoneControlsProps) {
	const extra = extraOrNot || undefined
	const [open, setOpen] = useState(false)
	const checkedSort = useRef<HTMLButtonElement>(null)
	const ready = Boolean(data && moods)
	const canClear = Boolean(
		data &&
			(data.picker.picks.length > 0 ||
				(data.hasServices && !data.onMyServices) ||
				extra?.on),
	)
	const clearAll = () => {
		moods?.clear()
		if (data && !data.onMyServices) setOnMyServices(true)
		if (extra?.on) extra.clear()
	}

	return (
		<MotionConfig reducedMotion="user">
			<FilterSummaryRow
				active={data ? activeWords(data, extra) : []}
				count={data ? countWords(data) : undefined}
				open={open}
				onOpen={() => setOpen(true)}
				disabled={!ready}
			/>
			{data && moods && (
				<FilterSheet
					open={open}
					setOpen={setOpen}
					canClear={canClear}
					onClear={clearAll}
					show={showLabel(data)}
				>
					<section data-drawer="moods">
						<MoodsHead control={moods} />
						<div className="px-4 pt-1">
							<MoodGrid control={moods} dense />
						</div>
					</section>
					<FilterGroup title="Where to watch">
						<div data-drawer="services">
							<ServicesBody data={data} setOnMyServices={setOnMyServices} />
						</div>
					</FilterGroup>
					{extra && (
						<FilterGroup
							title={
								<span lang={mediaFieldLanguage(extra)}>{extra.title}</span>
							}
						>
							<div className="px-4 pb-4" data-drawer={extra.key}>
								{extra.body}
							</div>
						</FilterGroup>
					)}
					<FilterGroup title="Sort">
						<div data-drawer="sort">
							<SortBody
								data={data}
								setSort={setSort}
								checkedRef={checkedSort}
							/>
						</div>
					</FilterGroup>
				</FilterSheet>
			)}
		</MotionConfig>
	)
}
