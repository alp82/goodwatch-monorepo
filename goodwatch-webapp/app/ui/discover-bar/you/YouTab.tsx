// You > Taste and lists, in three columns (phones stack them):
// - Your taste groups: a row per group (loved posters, name, word dots, a bar of how much of this list sits in it, the
//   count); up to three picks, any of, then the other rows dim. "In none of them" is a count, not a pick. Members with
//   fewer than two groups see no rows.
// - Taste match: 90%+ down to Any, then Outside your usual; rows from the pick up tinted amber, Outside in sky blue.
// - Order (For you, Best match first) and Your lists (Not seen yet, Seen before, On your wishlist as switches).
// Guests see the same blocks locked: placeholder group rows with the sign-up key, match rows without counts, and
// Order and Your lists faint with a lock.
//
// Counts come with `counts=taste` (optionCounts.tasteGroups, minMatch, notSeenYet, wishlist); the groups come from
// /api/discover/panel?part=taste.
import { BarsArrowDownIcon, LockClosedIcon } from "@heroicons/react/20/solid"
import { FingerPrintIcon } from "@heroicons/react/24/solid"
import { motion } from "framer-motion"
import { type ReactNode, useId } from "react"
import { radioKeys } from "~/ui/filter-bar/controls"
import { Knob, SHELL, TAP } from "~/ui/filter-bar/motion"
import { SignUpPrompt } from "~/ui/sign-up-prompt/SignUpPrompt"
import type { SubTabView } from "../DiscoverControls"
import { BlockHead, ClearLink, tabPad } from "../watch/parts"
import {
	CountCell,
	GroupRow,
	NoneRow,
	PlaceholderRow,
	ShareBar,
} from "./GroupRows"
import { ListPill } from "./ListPill"
import {
	LISTS,
	MATCH_ROWS,
	type MatchStep,
	groupCount,
	groupOn,
	groupsFull,
	listHides,
	listOn,
	listPatch,
	matchCount,
	matchLabel,
	matchLit,
	matchPatch,
	matchStepOf,
	shareOf,
	toggleGroup,
} from "./you-choices"
import { useTasteGroups } from "./useTasteGroups"

const FOCUS = "outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
const AMBER = "#f59e0b"
const SKY = "#38bdf8"
const SIGN_UP_WORDS = { title: "Sign up for your taste", detail: "" }

function Lock() {
	return (
		<LockClosedIcon
			className="h-3.5 w-3.5 text-amber-500/70"
			aria-label="With an account"
		/>
	)
}

/** A block's heading, with a lock for guests. */
function Head({
	children,
	locked,
	note,
	right,
	id,
}: {
	children: ReactNode
	locked: boolean
	note?: ReactNode
	right?: ReactNode
	id?: string
}) {
	return (
		<BlockHead id={id} note={note} right={right}>
			<span
				className={`flex items-center gap-2 ${locked ? "text-gray-400" : ""}`}
			>
				{children}
				{locked && <Lock />}
			</span>
		</BlockHead>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// Your taste groups

function TasteGroups({
	view,
	fixture,
}: { view: SubTabView; fixture: boolean }) {
	const { state } = view.filters
	const member = view.data.context.member
	const query = useTasteGroups(member, fixture)
	const groups = query.data ?? []
	const counts = view.counts?.optionCounts
	const shown = groups.length >= 2
	const full = groupsFull(state, groups)
	const picked = shown && groups.some((group) => groupOn(state, group))
	const groupCounts = groups.map((group) => groupCount(counts, group.key))
	const top = Math.max(0, ...groupCounts.map((n) => n ?? 0))
	const headId = useId()

	let rows: ReactNode
	if (!member || query.isPending)
		rows = [0, 1, 2, 3].map((i) => <PlaceholderRow key={i} index={i} />)
	else if (query.isError || !shown) rows = null
	else
		rows = groups.map((group, i) => {
			const on = groupOn(state, group)
			return (
				<GroupRow
					key={group.key}
					group={group}
					on={on}
					dim={full && !on}
					count={groupCounts[i]}
					share={shareOf(groupCounts[i], top)}
					phone={view.phone}
					onToggle={() => {
						const patch = toggleGroup(state, group, groups)
						if (patch) view.filters.set(patch)
					}}
				/>
			)
		})

	return (
		<section className="min-w-0" aria-labelledby={headId}>
			<Head
				id={headId}
				locked={!member}
				note={member && shown ? "In this list" : undefined}
				right={
					member ? (
						<ClearLink
							show={picked}
							onClick={() => view.filters.set({ tasteGroups: undefined })}
						/>
					) : (
						<SignUpPrompt
							feature="taste"
							size="chip"
							words={SIGN_UP_WORDS}
							className="md:-my-0.5"
						/>
					)
				}
			>
				Your taste groups
			</Head>
			<div className="flex flex-col gap-1">
				{rows}
				{(!member || shown || query.isPending) && (
					<NoneRow
						count={shown ? groupCount(counts, "none") : null}
						faint={!member}
					/>
				)}
			</div>
		</section>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// Taste match

function MatchRow({
	step,
	value,
	count,
	share,
	locked,
	onPick,
}: {
	step: MatchStep
	value: MatchStep
	count: number | null
	share: number
	locked: boolean
	onPick: () => void
}) {
	const on = !locked && step === value
	const lit = !locked && matchLit(step, value)
	const outside = step === "outside"
	return (
		<motion.button
			type="button"
			// biome-ignore lint/a11y/useSemanticElements: rows of an "and up" scale; the buttons carry the radio role
			role="radio"
			aria-checked={on}
			disabled={locked}
			tabIndex={locked ? -1 : on ? 0 : -1}
			whileTap={locked ? undefined : TAP}
			onClick={onPick}
			data-match={step}
			className={`flex h-10 w-full min-w-0 shrink-0 items-center gap-3 rounded-xl px-2.5 text-left ${FOCUS} ${locked ? "cursor-default" : "cursor-pointer"} ${
				on
					? outside
						? "bg-sky-500/20 ring-1 ring-inset ring-sky-300/50"
						: "bg-amber-500/20 ring-1 ring-inset ring-amber-300/50"
					: lit
						? "bg-amber-500/[0.08]"
						: locked
							? ""
							: "hover:bg-white/[0.04]"
			}`}
		>
			<span
				className={`w-[124px] shrink-0 truncate text-[13px] font-semibold ${locked ? "text-gray-600" : on || lit ? "text-white" : "text-gray-300"}`}
			>
				{matchLabel(step)}
			</span>
			<ShareBar share={share} hue={outside ? SKY : AMBER} faint={locked} />
			<CountCell n={locked ? null : count} />
		</motion.button>
	)
}

function TasteMatch({ view }: { view: SubTabView }) {
	const locked = !view.data.context.member
	const value = matchStepOf(view.filters.state)
	const counts = view.counts?.optionCounts
	const all = matchCount(counts, 0) ?? 0
	const headId = useId()
	// Tab reaches the picked row; arrows move the pick.
	const pick = (step: MatchStep) => view.filters.set(matchPatch(step))
	return (
		<section className="min-w-0">
			<Head locked={locked} id={headId}>
				<FingerPrintIcon className="h-5 w-5 text-amber-500" aria-hidden />
				Taste match
			</Head>
			<div
				role="radiogroup"
				aria-labelledby={headId}
				onKeyDown={(event) =>
					!locked && radioKeys(event, (index) => pick(MATCH_ROWS[index]))
				}
				className="flex flex-col gap-1"
			>
				{MATCH_ROWS.map((step) => {
					const count = matchCount(counts, step)
					return (
						<MatchRow
							key={String(step)}
							step={step}
							value={value}
							count={count}
							share={shareOf(count, all)}
							locked={locked}
							onPick={() => pick(step)}
						/>
					)
				})}
			</div>
		</section>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// Order and Your lists

function OrderSwitch({
	label,
	icon,
	on,
	onChange,
	locked,
	disabled = false,
}: {
	label: string
	icon: ReactNode
	on: boolean
	onChange: (on: boolean) => void
	locked: boolean
	disabled?: boolean
}) {
	const lit = on && !locked && !disabled
	const off = locked || disabled
	return (
		<motion.button
			type="button"
			role="switch"
			aria-checked={lit}
			disabled={off}
			whileTap={off ? undefined : TAP}
			onClick={() => onChange(!on)}
			className={`flex h-11 w-full min-w-0 items-center gap-2 rounded-2xl px-3 text-[13px] font-bold whitespace-nowrap ${FOCUS} ${
				off
					? "cursor-default bg-white/[0.03] text-gray-600 ring-1 ring-white/[0.06]"
					: lit
						? "cursor-pointer bg-amber-500/[0.14] text-white ring-1 ring-amber-500/45"
						: `cursor-pointer text-gray-400 hover:text-gray-200 ${SHELL}`
			}`}
		>
			{locked ? <Lock /> : icon}
			<span className="min-w-0 flex-1 truncate text-left">{label}</span>
			<Knob on={lit} />
		</motion.button>
	)
}

function Order({ view }: { view: SubTabView }) {
	const locked = !view.data.context.member
	const { forYou, filters } = view
	const best = filters.sort === "match"
	return (
		<section>
			<Head locked={locked}>Order</Head>
			<div className="flex flex-col gap-2">
				{forYou && (
					<div>
						<OrderSwitch
							label="For you"
							on={forYou.on}
							onChange={forYou.onChange}
							locked={locked}
							disabled={forYou.disabled}
							icon={
								<FingerPrintIcon
									className="h-4 w-4 shrink-0 text-amber-500"
									aria-hidden
								/>
							}
						/>
						{forYou.disabled && forYou.hint && (
							<p className="mt-1 px-3 text-xs text-gray-500">
								{forYou.hint}
							</p>
						)}
						{!locked &&
							!forYou.disabled &&
							forYou.on &&
							forYou.movedUp > 0 && (
								<p className="mt-1 px-3 text-xs text-gray-500">
									↑{forYou.movedUp.toLocaleString("en")} moved up
								</p>
							)}
					</div>
				)}
				<OrderSwitch
					label="Best match first"
					on={best}
					onChange={(on) =>
						filters.setSort(
							on ? "match" : filters.searching ? "relevance" : "popular",
						)
					}
					locked={locked}
					icon={
						<BarsArrowDownIcon
							className="h-4 w-4 shrink-0 text-amber-400"
							aria-hidden
						/>
					}
				/>
			</div>
		</section>
	)
}

function YourLists({ view }: { view: SubTabView }) {
	const locked = !view.data.context.member
	const { state } = view.filters
	const counts = view.counts?.optionCounts
	return (
		<section>
			<Head locked={locked}>Your lists</Head>
			<div className="flex flex-col gap-2">
				{LISTS.map(({ id, label }) => (
					<ListPill
						key={id}
						id={id}
						label={label}
						on={listOn(state, id)}
						hides={listHides(counts, id)}
						onChange={(on) => view.filters.set(listPatch(id, on))}
						locked={locked}
					/>
				))}
			</div>
		</section>
	)
}

export function YouTab({
	view,
	fixture = false,
}: { view: SubTabView; fixture?: boolean }) {
	const lists = (
		<div className="flex min-w-0 flex-col gap-5">
			{!view.noOrder && <Order view={view} />}
			<YourLists view={view} />
		</div>
	)
	if (view.phone)
		return (
			<div className={`space-y-6 ${tabPad(true)}`}>
				<TasteGroups view={view} fixture={fixture} />
				<TasteMatch view={view} />
				{lists}
			</div>
		)
	return (
		<div
			className={`grid grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)_minmax(17.5rem,0.62fr)] gap-8 ${tabPad(false)}`}
		>
			<TasteGroups view={view} fixture={fixture} />
			<div className="min-w-0 border-l border-white/[0.06] pl-8">
				<TasteMatch view={view} />
			</div>
			<div className="min-w-0 border-l border-white/[0.06] pl-8">{lists}</div>
		</div>
	)
}
