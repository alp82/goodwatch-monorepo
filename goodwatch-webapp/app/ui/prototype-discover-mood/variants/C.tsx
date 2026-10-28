// PROTOTYPE - throwaway. Variant C "Sentence": one readable sentence is the whole control. Each slot (mood, type,
// topic, style, where it streams) opens a small picker with counts: a popover on desktop, a bottom sheet on phones.
// "+ more" opens the real Filters sheet; its other active filters read as extra clauses after the sentence.
// "or describe it" swaps the sentence for a free-text field; the search's reading shows as a "read as" line and the
// slots stay under it, narrowing the search.
import { XMarkIcon } from "@heroicons/react/20/solid"
import { AnimatePresence, MotionConfig, motion } from "framer-motion"
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react"
import { ladderStepFor } from "~/domain/age-content"
import { SEARCH_MAX_CHARS } from "~/domain/discover-search"
import { secondaryFilterCount, stateAsApplied } from "~/domain/filter-state"
import { ReadAsChips } from "~/ui/discover/ReadAsChips"
import { FiltersSheet, activeChips } from "~/ui/filter-bar"
import { PROVIDER_LOGO, useMyServices } from "~/ui/filter-bar/useFilterData"
import {
	EXAMPLE_PROMPTS,
	ProtoGrid,
	type ProtoDiscover,
	TAGS,
	type Tag,
	type TagGroup,
	short,
} from "../kit"

export const NAME = "Sentence"

type SlotKey = TagGroup | "type" | "services"

// "Feel-good" reads "feel-good"; "IMDb 7.0+" and "FSK 12" keep their capitals.
const lower = (name: string) => (/^.[A-Z]/.test(name) ? name : name.charAt(0).toLowerCase() + name.slice(1))
const orJoin = (words: ReactNode[]) =>
	words.flatMap((w, i) => (i === 0 ? [w] : [<span key={`or-${i}`} className="text-gray-500"> or </span>, w]))

export function VariantC({ d }: { d: ProtoDiscover }) {
	const { state } = d.filters
	const [describe, setDescribe] = useState(d.q !== null)
	useEffect(() => {
		if (d.q !== null) setDescribe(true)
	}, [d.q])
	const [open, setOpen] = useState<{ key: SlotKey; anchor: DOMRect } | null>(null)
	const [sheetOpen, setSheetOpen] = useState(false)

	const services = useMyServices({ country: state.streamingCountry, include: state.services })
	const ladderRef = useRef(d.counts?.ladder ?? null)
	if (d.counts) ladderRef.current = d.counts.ladder ?? null
	const ladder = ladderRef.current
	const applied = useMemo(() => stateAsApplied(state, ladder), [state, ladder])
	const chips = useMemo(
		() =>
			activeChips(applied, {
				service: (id) => services.countryProviders.find((p) => p.id === id)?.name,
				serviceLogo: (id) => services.countryProviders.find((p) => p.id === id)?.logo_path,
				ageStep: (age) => (ladder ? ladderStepFor(ladder.steps, age).label : undefined),
			}),
		[applied, services.countryProviders, ladder],
	)
	// Clauses the sentence doesn't already say.
	const SAID = new Set(["moods", "themes", "styles", "type"])
	const extras = chips.filter((c) => !SAID.has(c.group) && !(c.group === "services" && c.key !== "streaming-country"))
	const moreCount = secondaryFilterCount(applied)

	const slotProps = {
		d,
		providers: services.countryProviders,
		openKey: open?.key ?? null,
		onOpen: (key: SlotKey, anchor: DOMRect) => setOpen({ key, anchor }),
	}

	return (
		<MotionConfig reducedMotion="user">
			<div className="mx-auto max-w-[1600px] px-4 pt-4 pb-16 lg:px-8">
				{describe ? (
					<DescribeField d={d} onBack={() => (d.setQ(null), setDescribe(false))} />
				) : null}
				<div className={describe ? "mt-3" : ""}>
					<Sentence
						{...slotProps}
						small={describe}
						extras={extras.map((chip) => (
							<Extra
								key={chip.key}
								label={chip.label}
								onOpen={() => setSheetOpen(true)}
								onRemove={() => d.filters.update((s) => chip.remove(s))}
							/>
						))}
						more={
							<button
								type="button"
								onClick={() => setSheetOpen(true)}
								className="whitespace-nowrap rounded-md text-gray-400 underline decoration-dashed decoration-gray-600 decoration-2 underline-offset-[6px] outline-none hover:text-white hover:decoration-amber-400 focus-visible:ring-2 focus-visible:ring-amber-400"
							>
								+ more{moreCount > 0 ? ` (${moreCount})` : ""}
							</button>
						}
					/>
				</div>
				<div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
					{!describe && (
						<button
							type="button"
							onClick={() => setDescribe(true)}
							className="rounded-md font-semibold text-amber-400 outline-none hover:text-amber-300 focus-visible:ring-2 focus-visible:ring-amber-400"
						>
							or describe it
						</button>
					)}
					<span className="text-gray-400 tabular-nums">
						{d.loading ? "Counting…" : d.total != null ? `${short(d.total)} ${d.total === 1 ? "title" : "titles"}` : ""}
					</span>
					{(d.picked.length > 0 || state.type !== "all" || state.services?.length) && (
						<button
							type="button"
							onClick={() => d.filters.update((s) => ({ ...s, moods: [], themes: [], styles: [], type: "all", services: undefined, anyService: undefined }))}
							className="rounded-md text-gray-400 outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
						>
							Reset
						</button>
					)}
				</div>
				<div className="mt-3 h-px bg-linear-to-r from-white/25 via-white/10 to-transparent" />
				<div className="mt-4">
					<ProtoGrid d={d} />
				</div>
			</div>
			<SlotPicker d={d} providers={services.countryProviders} mine={services.ids} open={open} onClose={() => setOpen(null)} />
			<FiltersSheet
				open={sheetOpen}
				onClose={() => setSheetOpen(false)}
				data={{
					state,
					counts: d.counts,
					onChange: (next) => d.filters.update(() => next),
					myServices: services.ids,
					countryProviders: services.countryProviders,
					streamingCountry: services.country,
					taste: "signUp",
					ladder,
				}}
				chips={chips}
				onClear={d.filters.clearSecondary}
			/>
		</MotionConfig>
	)
}

// ---------------------------------------------------------------------------------------------------------------

function Sentence({
	d,
	providers,
	small,
	openKey,
	onOpen,
	extras,
	more,
}: {
	d: ProtoDiscover
	providers: { id: number; name: string }[]
	small: boolean
	openKey: SlotKey | null
	onOpen: (key: SlotKey, anchor: DOMRect) => void
	extras: ReactNode[]
	more: ReactNode
}) {
	const { state } = d.filters
	const picks = (g: TagGroup) => d.picked.filter((t) => t.group === g)
	const tagWords = (g: TagGroup) => {
		const list = picks(g)
		if (!list.length) return null
		return orJoin(
			list.map((t) => (
				<span key={t.key} style={g === "moods" ? { color: t.color } : undefined}>
					{lower(t.name)}
				</span>
			)),
		)
	}
	const slot = (key: SlotKey, words: ReactNode | null, empty: string, color?: string) => (
		<Slot key={key} active={words !== null} open={openKey === key} underline={color} onOpen={(r) => onOpen(key, r)}>
			{words ?? empty}
		</Slot>
	)
	const typeWords = state.type === "movie" ? "movie" : state.type === "show" ? "show" : null
	const serviceWords = state.anyService
		? "on any service"
		: state.onMyServices
			? "on my services"
			: state.services?.length
				? [
						"on ",
						...orJoin(
							state.services.map((id) => (
								<span key={id}>{providers.find((p) => p.id === id)?.name ?? "…"}</span>
							)),
						),
					]
				: null
	const firstMood = picks("moods")[0]
	const firstTheme = picks("themes")[0]
	const firstStyle = picks("styles")[0]

	return (
		<p
			className={`brand-header leading-snug text-white ${small ? "text-[20px] lg:text-[26px]" : "text-[26px] lg:text-[42px]"}`}
		>
			<span className="text-gray-300">{small ? "Only " : "Something "}</span>
			{slot("moods", tagWords("moods"), small ? "any mood" : "good", firstMood?.color)}
			<span className="text-gray-300">{small ? ", " : ": a "}</span>
			{slot("type", typeWords, "movie or show")}
			<span className="text-gray-300"> about </span>
			{slot("themes", tagWords("themes"), "anything", firstTheme?.color)}
			<span className="text-gray-300">, in </span>
			{slot("styles", tagWords("styles"), "any style", firstStyle?.color)}
			{tagWords("styles") && <span className="text-gray-300"> style</span>}
			<span className="text-gray-300">, streaming </span>
			{slot("services", serviceWords, "anywhere")}
			{extras.length > 0 && (
				<>
					<span className="text-gray-300">, with </span>
					{extras.flatMap((e, i) => (i === 0 ? [e] : [<span key={`and-${i}`} className="text-gray-300">, </span>, e]))}
				</>
			)}
			<span className="text-gray-300"> </span>
			{more}
		</p>
	)
}

function Slot({
	active,
	open,
	underline,
	onOpen,
	children,
}: {
	active: boolean
	open: boolean
	underline?: string
	onOpen: (anchor: DOMRect) => void
	children: ReactNode
}) {
	return (
		<button
			type="button"
			aria-haspopup="dialog"
			aria-expanded={open}
			onClick={(e) => onOpen(e.currentTarget.getBoundingClientRect())}
			style={active && underline ? { textDecorationColor: underline } : undefined}
			className={`rounded-md underline decoration-2 underline-offset-[6px] outline-none transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-amber-400 ${
				active
					? "text-white decoration-amber-400 hover:bg-white/[0.06]"
					: "text-gray-400 decoration-dashed decoration-gray-600 hover:text-white hover:decoration-amber-400"
			} ${open ? "bg-white/[0.08]" : ""}`}
		>
			{children}
		</button>
	)
}

function Extra({ label, onOpen, onRemove }: { label: string; onOpen: () => void; onRemove: () => void }) {
	return (
		<span className="inline-flex items-baseline">
			<button
				type="button"
				onClick={onOpen}
				className="rounded-md text-white underline decoration-amber-400 decoration-2 underline-offset-[6px] outline-none hover:bg-white/[0.06] focus-visible:ring-2 focus-visible:ring-amber-400"
			>
				{lower(label)}
			</button>
			<button
				type="button"
				onClick={onRemove}
				aria-label={`Remove ${label}`}
				className="ml-0.5 self-center rounded-full p-0.5 text-gray-500 outline-none hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
			>
				<XMarkIcon className="h-4 w-4" aria-hidden />
			</button>
		</span>
	)
}

// ---------------------------------------------------------------------------------------------------------------

function DescribeField({ d, onBack }: { d: ProtoDiscover; onBack: () => void }) {
	const [draft, setDraft] = useState(d.q ?? "")
	const timer = useRef<ReturnType<typeof setTimeout>>()
	const input = useRef<HTMLInputElement>(null)
	useEffect(() => setDraft(d.q ?? ""), [d.q])
	useEffect(() => {
		if (d.q === null) input.current?.focus()
		return () => clearTimeout(timer.current)
	}, [])
	const run = (text: string) => {
		clearTimeout(timer.current)
		if (text.trim() !== (d.q ?? "")) d.setQ(text.trim() || null)
	}
	return (
		<div>
			<div className="flex min-h-14 items-center gap-3 lg:min-h-16">
				<input
					ref={input}
					type="search"
					value={draft}
					maxLength={SEARCH_MAX_CHARS}
					autoComplete="off"
					enterKeyHint="search"
					placeholder="What’s the mood?"
					aria-label="Describe what you want to watch"
					onChange={(e) => {
						const text = e.target.value
						setDraft(text)
						clearTimeout(timer.current)
						timer.current = setTimeout(() => run(text), 800)
					}}
					onKeyDown={(e) => {
						if (e.key === "Enter") {
							e.preventDefault()
							run(draft)
							input.current?.blur()
						}
						if (e.key === "Escape") onBack()
					}}
					className="search-private ph-no-capture brand-header h-full min-w-0 flex-1 border-0 bg-transparent p-0 text-[26px] leading-tight text-white outline-none placeholder:text-gray-500 focus:ring-0 lg:text-[42px] [&::-webkit-search-cancel-button]:hidden"
				/>
				<button
					type="button"
					onClick={onBack}
					className="shrink-0 rounded-md px-2 py-1 text-sm font-semibold text-amber-400 outline-none hover:bg-amber-400/10 hover:text-amber-300 focus-visible:ring-2 focus-visible:ring-amber-400"
				>
					Back to the sentence
				</button>
			</div>
			<div className="h-px bg-linear-to-r from-amber-400/70 via-amber-400/20 to-transparent" />
			{d.q && (
				<div className="mt-2.5 flex flex-wrap items-center gap-2 text-sm text-gray-400">
					<span>read as</span>
					{d.reading.length ? <ReadAsChips reading={d.reading} /> : <span>{d.searchBusy ? "…" : d.q}</span>}
				</div>
			)}
			{!d.q && (
				<div className="mt-2.5 flex flex-wrap gap-1.5">
					{EXAMPLE_PROMPTS.slice(0, 5).map((p) => (
						<button
							key={p}
							type="button"
							onClick={() => (setDraft(p), d.setQ(p))}
							className="rounded-full bg-white/[0.06] px-3 py-1 text-sm text-gray-200 outline-none hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
						>
							{p}
						</button>
					))}
				</div>
			)}
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------

const PICKER_TITLE: Record<SlotKey, string> = {
	moods: "Mood",
	type: "Movie or show",
	themes: "About",
	styles: "Style",
	services: "Streaming",
}

interface Option {
	id: string
	label: string
	count: number | null
	on: boolean
	dot?: string
	logo?: string
	sub?: string
	toggle: () => void
}

function useIsPhone() {
	const [phone, setPhone] = useState(false)
	useEffect(() => {
		const mq = window.matchMedia("(max-width: 639px)")
		const set = () => setPhone(mq.matches)
		set()
		mq.addEventListener("change", set)
		return () => mq.removeEventListener("change", set)
	}, [])
	return phone
}

function SlotPicker({
	d,
	providers,
	mine,
	open,
	onClose,
}: {
	d: ProtoDiscover
	providers: { id: number; name: string; logo_path: string }[]
	mine: number[]
	open: { key: SlotKey; anchor: DOMRect } | null
	onClose: () => void
}) {
	const phone = useIsPhone()
	const { state } = d.filters
	const oc = d.counts?.optionCounts
	useEffect(() => {
		if (!open) return
		const key = (e: KeyboardEvent) => e.key === "Escape" && onClose()
		const scroll = () => !phone && onClose()
		window.addEventListener("keydown", key)
		window.addEventListener("scroll", scroll, { passive: true })
		return () => {
			window.removeEventListener("keydown", key)
			window.removeEventListener("scroll", scroll)
		}
	}, [open, phone, onClose])

	let options: Option[] = []
	let anyLabel = ""
	let anyOn = false
	let clear = () => {}
	if (open) {
		const k = open.key
		if (k === "moods" || k === "themes" || k === "styles") {
			options = TAGS.filter((t) => t.group === k).map((t: Tag) => ({
				id: t.key,
				label: t.name,
				count: d.countFor(t),
				on: d.isOn(t),
				dot: t.color,
				sub: t.description,
				toggle: () => d.toggle(t),
			}))
			anyLabel = k === "moods" ? "Any mood" : k === "themes" ? "Anything" : "Any style"
			anyOn = !d.picked.some((t) => t.group === k)
			clear = () => d.filters.update((s) => ({ ...s, [k]: [] }))
		} else if (k === "type") {
			options = (["movie", "show"] as const).map((id) => ({
				id,
				label: id === "movie" ? "Movie" : "Show",
				count: oc?.type?.[id] ?? null,
				on: state.type === id,
				toggle: () => d.filters.set({ type: state.type === id ? "all" : id }),
			}))
			anyLabel = "Movie or show"
			anyOn = state.type === "all"
			clear = () => d.filters.set({ type: "all" })
		} else {
			const chosen = state.services ?? []
			options = [...providers]
				.map((p) => ({ p, n: oc?.services?.[String(p.id)] ?? null }))
				.filter(({ p, n }) => (n ?? 0) > 0 || chosen.includes(p.id))
				.sort((a, b) => (b.n ?? 0) - (a.n ?? 0))
				.slice(0, 24)
				.map(({ p, n }) => ({
					id: String(p.id),
					label: p.name,
					count: n,
					on: !state.onMyServices && !state.anyService && chosen.includes(p.id),
					logo: p.logo_path ? `${PROVIDER_LOGO}${p.logo_path}` : undefined,
					toggle: () => {
						const on = chosen.includes(p.id)
						const next = on ? chosen.filter((id) => id !== p.id) : [...chosen, p.id]
						d.filters.set({ onMyServices: false, anyService: undefined, services: next.length ? next : undefined })
					},
				}))
			if (mine.length)
				options.unshift({
					id: "mine",
					label: "My services",
					count: null,
					on: state.onMyServices,
					toggle: () => d.filters.set({ onMyServices: !state.onMyServices, anyService: undefined, services: undefined }),
				})
			anyLabel = "Anywhere"
			anyOn = !state.onMyServices && !state.anyService && !state.services?.length
			clear = () => d.filters.set({ onMyServices: false, anyService: undefined, services: undefined })
		}
	}

	const width = 440
	// Under the slot, or above it when the slot sits low on the screen.
	const pos = open
		? {
				left: Math.max(16, Math.min(open.anchor.left, window.innerWidth - width - 16)),
				...(open.anchor.bottom > window.innerHeight * 0.55
					? { bottom: window.innerHeight - open.anchor.top + 8 }
					: { top: open.anchor.bottom + 8 }),
			}
		: {}

	const body = open && (
		<>
			<div className="flex items-center justify-between gap-3 px-4 pt-3 pb-2">
				<h2 className="text-sm font-semibold text-gray-300">{PICKER_TITLE[open.key]}</h2>
				<button
					type="button"
					onClick={onClose}
					aria-label="Close"
					className="rounded-full p-1 text-gray-400 outline-none hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
				>
					<XMarkIcon className="h-5 w-5" aria-hidden />
				</button>
			</div>
			<div className="max-h-[min(60vh,440px)] overflow-y-auto px-3 pb-3">
				<button
					type="button"
					onClick={clear}
					className={`mb-1.5 flex w-full items-center rounded-lg px-3 py-2 text-left text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
						anyOn ? "bg-amber-400/15 text-amber-300 ring-1 ring-inset ring-amber-400/40" : "text-gray-300 hover:bg-white/[0.06]"
					}`}
				>
					{anyLabel}
				</button>
				<ul className={`grid gap-1.5 ${open.key === "type" ? "grid-cols-2" : "grid-cols-1 sm:grid-cols-2"}`}>
					{options.map((o) => {
						const empty = o.count === 0 && !o.on
						return (
							<li key={o.id}>
								<button
									type="button"
									aria-pressed={o.on}
									disabled={empty}
									onClick={o.toggle}
									title={o.sub}
									className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 disabled:cursor-default disabled:opacity-40 ${
										o.on ? "bg-white/[0.12] text-white ring-1 ring-inset ring-white/25" : "bg-white/[0.04] text-gray-200 hover:bg-white/[0.08]"
									}`}
								>
									{o.logo ? (
										<img src={o.logo} alt="" className="h-5 w-5 shrink-0 rounded" />
									) : o.dot ? (
										<span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: o.dot }} aria-hidden />
									) : null}
									<span className="min-w-0 flex-1">
										<span className={`block truncate ${o.on ? "font-semibold" : ""}`}>{o.label}</span>
										{o.sub && open.key === "moods" && (
											<span className="block truncate text-xs text-gray-500">{o.sub}</span>
										)}
									</span>
									<span className="shrink-0 text-xs text-gray-500 tabular-nums">{short(o.count)}</span>
								</button>
							</li>
						)
					})}
				</ul>
			</div>
			<div className="flex items-center justify-between border-t border-white/10 px-4 py-2.5 text-sm">
				<span className="text-gray-400 tabular-nums">{d.total != null ? `${short(d.total)} titles` : "…"}</span>
				<button
					type="button"
					onClick={onClose}
					className="rounded-md bg-amber-500 px-4 py-1.5 font-semibold text-gray-950 outline-none hover:bg-amber-400 focus-visible:ring-2 focus-visible:ring-white"
				>
					Done
				</button>
			</div>
		</>
	)

	return (
		<AnimatePresence>
			{open && (
				<>
					<motion.div
						key="scrim"
						aria-hidden
						className={`fixed inset-0 z-[1001] ${phone ? "bg-black/60" : ""}`}
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						onClick={onClose}
					/>
					{phone ? (
						<motion.div
							key="sheet"
							role="dialog"
							aria-modal="true"
							aria-label={PICKER_TITLE[open.key]}
							initial={{ y: "100%" }}
							animate={{ y: 0 }}
							exit={{ y: "100%" }}
							transition={{ type: "spring", stiffness: 420, damping: 40 }}
							className="fixed inset-x-0 bottom-0 z-[1002] rounded-t-2xl bg-gray-950 pb-[env(safe-area-inset-bottom)] ring-1 ring-white/10"
						>
							<div className="mx-auto mt-2 h-1 w-10 rounded-full bg-white/20" aria-hidden />
							{body}
						</motion.div>
					) : (
						<motion.div
							key={`pop-${open.key}`}
							role="dialog"
							aria-label={PICKER_TITLE[open.key]}
							initial={{ opacity: 0, y: -6 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0, y: -6 }}
							transition={{ duration: 0.14 }}
							style={{ ...pos, width }}
							className="fixed z-[1002] rounded-xl bg-gray-950 shadow-[0_20px_60px_-10px_rgba(0,0,0,.9)] ring-1 ring-white/15"
						>
							{body}
						</motion.div>
					)}
				</>
			)}
		</AnimatePresence>
	)
}
