// PROTOTYPE (Discover lab, round 11): the panel's footer carries the search state on every tab and sub-tab. Left: the
// count, then the query, steering picks, people and every other active filter as removable chips (one row, scrolls
// sideways under a fade), Clear all; right: the Show button. Fixed height; phones put the chips on their own row.
// Round 11b: the hidden meter and "N hidden" under the count, production's one-tap recoveries in amber after it while
// the list is small, and a chip for On my services.
import { MagnifyingGlassIcon, PlusIcon, XMarkIcon } from "@heroicons/react/20/solid"
import { motion } from "framer-motion"
import { HiddenMeter } from "~/ui/filter-bar"
import { compactCount, recoveryLabel } from "~/ui/filter-bar/labels"
import { RollingNumber, TAP } from "~/ui/filter-bar/motion"
import { usePeopleNames, useTitleNames } from "~/ui/filter-bar/useFilterData"
import type { ProtoDiscover } from "../kit"
import { useShown } from "./results-view"
import { useMcUsers, setMcUsers } from "./sections/scores/mc-users"
import { Face } from "./sections/people/shared"
import { STEER, STEER_ORDER, SteerChip, chipStyle } from "./sections/titles/ghi-parts"
import { ShowButton } from "./show-button"
import { useYouExtras, youChips } from "./sections/taste/you-extras"
import { moreChips, useMore } from "./sections/more/store"
import { PRIVATE, type Pieces, type Slot, MoreChips, MyServicesChip, ValueChip, YouChips, dropOne, slotOfChip, useClearAll } from "./shell-parts"

const SEARCH_CAP = 100
const FADE = "linear-gradient(to right, black calc(100% - 2.5rem), transparent)"
const PURPLE = "#c084fc"
/** Drawn as steer or person chips. */
const OWN = new Set(["similarTo", "loved", "disliked", "people"])
/** Recoveries show while the list is at most this long (or empty). */
const SMALL = 40

function Count({ d }: { d: ProtoDiscover }) {
	const n = d.total
	const hidden = d.counts?.hidden ?? 0
	return (
		<span className="flex shrink-0 flex-col gap-1">
			<CountText d={d} n={n} />
			{/* Always this row, so the footer keeps its height. */}
			<span className="flex h-3 items-center gap-2">
				<HiddenMeter counts={d.counts} className="w-14" />
				<span className="text-[11px] leading-none whitespace-nowrap text-gray-500">{d.counts && hidden > 0 ? `${compactCount(hidden)} hidden` : ""}</span>
			</span>
		</span>
	)
}

/** The two biggest one-tap recoveries, production's amber "+ 57 in other genres" (phones: the biggest). */
function Recoveries({ d, phone }: { d: ProtoDiscover; phone: boolean }) {
	const n = d.total
	const list = d.counts?.recoveries ?? []
	if (n == null || n > SMALL || !list.length) return null
	return (
		<>
			{list.slice(0, phone ? 1 : 2).map((r) => (
				<motion.button
					key={r.filter}
					type="button"
					whileTap={TAP}
					onClick={() => dropOne(d, r.filter)}
					className="flex shrink-0 items-center gap-1 rounded-md text-[13px] font-bold whitespace-nowrap text-amber-400 cursor-pointer outline-none hover:text-amber-300 focus-visible:ring-2 focus-visible:ring-amber-400"
				>
					<PlusIcon className="h-3.5 w-3.5" />
					<span className="sr-only">Show </span>
					{recoveryLabel(r.filter, r.titles, d.filters.state)}
				</motion.button>
			))}
		</>
	)
}

function CountText({ d, n }: { d: ProtoDiscover; n: number | null }) {
	return (
		<span className="text-sm leading-5 whitespace-nowrap text-gray-400" aria-live="polite">
			{n == null ? (
				"Counting…"
			) : d.q && n >= SEARCH_CAP ? (
				<>
					Top <span className="font-bold text-white">{SEARCH_CAP}</span> matches
				</>
			) : (
				<>
					<RollingNumber value={n} className="font-bold text-white" />{" "}
					{d.q ? (n === 1 ? "match" : "matches") : n === 1 ? "title" : "titles"}
				</>
			)}
		</span>
	)
}

function StateChips({ d, pieces, onOpen }: { d: ProtoDiscover; pieces: Pieces; onOpen: (slot: Slot) => void }) {
	const s = d.filters.state
	const titles = useTitleNames([...(s.similarTo ?? []), ...(s.loved ?? []), ...(s.disliked ?? [])], "")
	const people = usePeopleNames(s.people ?? [], "")
	const mc = useMcUsers()
	const rest = pieces.chips.filter((c) => !OWN.has(c.group))
	return (
		<>
			{d.q && (
				<span className="inline-flex h-8 shrink-0 items-center rounded-full bg-amber-400/[0.1] pl-3 ring-1 ring-inset ring-amber-400/35">
					<button
						type="button"
						onClick={() => onOpen("q")}
						className={`flex max-w-[260px] items-center gap-1.5 text-[13px] font-semibold whitespace-nowrap text-amber-100 cursor-pointer outline-none ${PRIVATE}`}
					>
						<MagnifyingGlassIcon className="h-3.5 w-3.5 shrink-0 text-amber-300" aria-hidden />
						<span className="truncate">{d.q}</span>
					</button>
					<button
						type="button"
						onClick={() => d.setQ(null)}
						aria-label="Clear the search"
						className="grid h-full w-8 place-items-center rounded-r-full text-amber-200/70 cursor-pointer hover:text-white"
					>
						<XMarkIcon className="h-3.5 w-3.5" />
					</button>
				</span>
			)}
			{STEER_ORDER.flatMap((u) =>
				(s[u] ?? []).map((k) => {
					const t = titles.byKey.get(k)
					return (
						<SteerChip
							key={`${u}:${k}`}
							use={u}
							size="sm"
							prefix={STEER[u].word}
							title={t?.title ?? "…"}
							poster={t?.poster ?? null}
							onRemove={() =>
								d.filters.update((x) => {
									const next = (x[u] ?? []).filter((y) => y !== k)
									return { ...x, [u]: next.length ? next : undefined }
								})
							}
						/>
					)
				}),
			)}
			{(s.people ?? []).map((id) => {
				const p = people.byId.get(id)
				return (
					<span
						key={id}
						className="inline-flex h-8 shrink-0 items-center rounded-full pl-1 text-[13px] font-semibold whitespace-nowrap text-white"
						style={chipStyle(PURPLE)}
					>
						<Face src={p?.profile ?? null} size={24} />
						<span className="ml-1.5 font-normal text-purple-200">with</span>
						<span className="ml-1 max-w-[160px] truncate">{p?.name ?? "…"}</span>
						<button
							type="button"
							onClick={() =>
								d.filters.update((x) => {
									const next = (x.people ?? []).filter((y) => y !== id)
									return { ...x, people: next.length ? next : undefined }
								})
							}
							aria-label={`Remove ${p?.name ?? "person"}`}
							className="grid h-full w-8 place-items-center rounded-r-full text-white/50 cursor-pointer outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
						>
							<XMarkIcon className="h-3.5 w-3.5" />
						</button>
					</span>
				)
			})}
			<MyServicesChip d={d} onOpen={onOpen} />
			{s.notSeenYet && (
				<ValueChip
					chip={{ key: "notseen", group: "notSeenYet", label: "Not seen yet", remove: (x) => ({ ...x, notSeenYet: false }) }}
					onOpen={() => onOpen("notSeenYet")}
					onRemove={() => d.filters.set({ notSeenYet: false })}
				/>
			)}
			<YouChips onOpen={onOpen} />
			{rest.map((chip) => (
				<ValueChip key={chip.key} chip={chip} onOpen={() => onOpen(slotOfChip(chip))} onRemove={() => d.filters.update((x) => chip.remove(x))} />
			))}
			{mc > 0 && (
				<ValueChip
					chip={{ key: "mc-users", group: "sourceScores", label: `User score ${(mc / 10).toFixed(1)}+`, remove: (x) => x }}
					onOpen={() => onOpen("sourceScores")}
					onRemove={() => setMcUsers(0)}
				/>
			)}
			<MoreChips onOpen={onOpen} />
		</>
	)
}

export function Footer({
	d: raw,
	pieces,
	onDone,
	onOpen,
	phone = false,
}: {
	d: ProtoDiscover
	pieces: Pieces
	onDone: () => void
	onOpen: (slot: Slot) => void
	phone?: boolean
}) {
	// The counts are the shown list's (a mood variant may replace Discover's).
	const d = useShown(raw)
	const clearAll = useClearAll(d)
	const mc = useMcUsers()
	const you = youChips(useYouExtras()).length
	const more = moreChips(useMore()).length
	const n = pieces.secondaryCount + (d.q ? 1 : 0) + (mc ? 1 : 0) + you + more
	const line = (
		<div className="flex min-w-0 flex-1 items-center gap-3">
			<Count d={d} />
			<Recoveries d={d} phone={phone} />
			<div
				data-footer-chips
				className="relative flex h-8 min-w-0 flex-1 items-center gap-1.5 overflow-x-auto overscroll-x-contain pr-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
				style={{ maskImage: FADE, WebkitMaskImage: FADE }}
			>
				<StateChips d={d} pieces={pieces} onOpen={onOpen} />
			</div>
		</div>
	)
	const clear = (
		<button
			type="button"
			onClick={clearAll}
			disabled={!n}
			className="shrink-0 rounded-md px-2 py-1 text-sm whitespace-nowrap text-gray-400 cursor-pointer outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400 disabled:cursor-default disabled:text-gray-700"
		>
			{n ? `Clear all ${n}` : "Clear all"}
		</button>
	)
	const show = <ShowButton q={d.q} counts={d.counts} onClick={onDone} className={phone ? "h-11 flex-1" : "h-11 min-w-48 shrink-0"} />
	if (phone)
		return (
			<div className="flex shrink-0 flex-col gap-2.5 border-t border-white/[0.06] bg-gray-950/85 px-5 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))]">
				{line}
				<div className="flex items-center gap-3">
					{clear}
					{show}
				</div>
			</div>
		)
	return (
		<div className="flex h-[68px] shrink-0 items-center gap-4 border-t border-white/[0.06] bg-gray-950/85 px-5">
			{line}
			{clear}
			{show}
		</div>
	)
}
