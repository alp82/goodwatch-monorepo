// PROTOTYPE (Discover lab, titles g "Suggestions list"): a classic search-suggest list under the bar. One list, grouped,
// ↑ ↓ Enter: the first row runs the bar's text (the text shows once, as that row's action), then filters the text
// points at, titles (steer with thumbs or Like this), people (Cast and crew). The right column holds what steers this
// list now, as removable session chips.
import {
	ArrowTurnDownLeftIcon,
	CheckIcon,
	FilmIcon,
	MagnifyingGlassIcon,
	PlusIcon,
	UserIcon,
	XMarkIcon,
} from "@heroicons/react/20/solid"
import { motion } from "framer-motion"
import { type ReactNode, useEffect, useRef } from "react"
import { TAP } from "~/ui/filter-bar/motion"
import { EXAMPLE_PROMPTS, short } from "../../../kit"
import { type FoundTitle, PRIVATE, PosterThumb, useQuickTitles } from "../../shell-parts"
import type { SectionProps } from "../../types"
import { Face, type Person, roleOf, usePeople } from "../people/shared"
import {
	type FilterMatch,
	FilterMatchChip,
	STEER,
	STEER_ORDER,
	SteerChip,
	SteerToggle,
	chipStyle,
	useFilterMatches,
	useListNav,
} from "./ghi-parts"
import { EXAMPLE_KEYS, PreviewPosters, SECTION_LABEL, type TitleUses, useKnown, useSearchPreview, useTitleUses } from "./shared"

type Item =
	| { kind: "run"; text: string }
	| { kind: "prompt"; text: string }
	| { kind: "filter"; m: FilterMatch }
	| { kind: "title"; t: FoundTitle }
	| { kind: "person"; p: Person }

const PURPLE = "#c084fc"

export function TitlesG({ d, phone, text, runSearch, setText }: SectionProps) {
	const typed = text.trim()
	const asking = typed.length >= 2
	const titles = useQuickTitles(text)
	const people = usePeople(d, text)
	const filters = useFilterMatches(d, typed, phone ? 4 : 6)
	const preview = useSearchPreview(d, text)
	const uses = useTitleUses(d)
	const known = useKnown(uses.picked.map((p) => p.key))

	const nTitles = phone ? 3 : 4
	const items: Item[] = typed
		? [
				{ kind: "run", text: typed },
				...filters.map((m) => ({ kind: "filter" as const, m })),
				...(asking ? titles.found.slice(0, nTitles).map((t) => ({ kind: "title" as const, t })) : []),
				...(asking ? people.found.slice(0, 2).map((p) => ({ kind: "person" as const, p })) : []),
			]
		: EXAMPLE_PROMPTS.slice(0, 5).map((p) => ({ kind: "prompt" as const, text: p }))

	const act = (i: number) => {
		const it = items[i]
		if (!it) return
		if (it.kind === "run" || it.kind === "prompt") runSearch(it.text)
		else if (it.kind === "filter") it.m.toggle()
		else if (it.kind === "title") {
			known.remember(it.t)
			uses.toggle("similarTo", it.t.key)
		} else people.toggle(it.p)
	}
	const nav = useListNav(items.length, act, typed, typed !== "")

	const list = useRef<HTMLDivElement>(null)
	useEffect(() => {
		list.current?.querySelector<HTMLElement>(`[data-row="${nav.active}"]`)?.scrollIntoView({ block: "nearest" })
	}, [nav.active])

	const at = (it: Item) => items.indexOf(it)
	const run = items.find((x) => x.kind === "run")
	const fRows = items.filter((x): x is Extract<Item, { kind: "filter" }> => x.kind === "filter")
	const tRows = items.filter((x): x is Extract<Item, { kind: "title" }> => x.kind === "title")
	const pRows = items.filter((x): x is Extract<Item, { kind: "person" }> => x.kind === "person")
	const prompts = items.filter((x): x is Extract<Item, { kind: "prompt" }> => x.kind === "prompt")

	const listBody = (
		<div ref={list} role="listbox" aria-label="Suggestions" className={phone ? "flex flex-col gap-1" : "flex flex-col gap-1"}>
			{run && (
				<Row i={at(run)} active={nav.active} onHover={nav.setActive} onClick={() => runSearch(typed)} tall>
					<MagnifyingGlassIcon className="h-5 w-5 shrink-0 text-amber-400" aria-hidden />
					<span className="min-w-0 flex-1 truncate text-[16px] text-gray-300">
						{typed === d.q ? "Showing" : "Search"}{" "}
						<span className={`brand-header text-[18px] text-white ${PRIVATE}`}>{typed}</span>
					</span>
					{!phone && typed !== d.q && (
						<span className="flex shrink-0 items-center gap-3">
							{preview.ready && preview.total != null && (
								<span className="text-[12px] tabular-nums text-gray-500">{short(preview.total)} titles</span>
							)}
							<PreviewPosters p={preview} n={5} w={22} />
						</span>
					)}
					{typed === d.q ? (
						<button
							type="button"
							onClick={(e) => {
								e.stopPropagation()
								d.setQ(null)
								setText("")
							}}
							className="inline-flex h-8 shrink-0 items-center gap-1 rounded-md px-2 text-sm font-semibold text-amber-400 cursor-pointer outline-none hover:bg-amber-400/10 focus-visible:ring-2 focus-visible:ring-amber-400"
						>
							<XMarkIcon className="h-4 w-4" aria-hidden />
							Clear
						</button>
					) : (
						<EnterKey show={nav.active === at(run)} />
					)}
				</Row>
			)}

			{prompts.length > 0 && <Head icon={<MagnifyingGlassIcon />}>Try</Head>}
			{prompts.map((it) => (
				<Row key={it.text} i={at(it)} active={nav.active} onHover={nav.setActive} onClick={() => runSearch(it.text)}>
					<MagnifyingGlassIcon className="h-4 w-4 shrink-0 text-amber-400/60" aria-hidden />
					<span className="min-w-0 flex-1 truncate text-[15px] text-gray-300">{it.text}</span>
					<EnterKey show={nav.active === at(it)} />
				</Row>
			))}

			{fRows.length > 0 && <Head icon={<span className="block h-2 w-2 rounded-full bg-gray-400" />}>Filters</Head>}
			{fRows.length > 0 && (
				<div className={`flex gap-2 px-2 pb-1 ${phone ? "overflow-x-auto" : "flex-wrap"}`}>
					{fRows.map((it) => (
						<span key={it.m.id} data-row={at(it)} onMouseEnter={() => nav.setActive(at(it))}>
							<FilterMatchChip m={it.m} active={nav.active === at(it)} />
						</span>
					))}
				</div>
			)}

			{asking && <Head icon={<FilmIcon />}>Titles</Head>}
			{asking && tRows.length === 0 && (
				<p className="flex h-11 items-center px-3 text-[13px] text-gray-500">{titles.loading ? "Looking…" : `No title called “${typed}”`}</p>
			)}
			{tRows.map((it) => (
				<TitleItem key={it.t.key} it={it.t} i={at(it)} nav={nav} uses={uses} remember={known.remember} phone={phone} />
			))}

			{pRows.length > 0 && <Head icon={<UserIcon />}>People</Head>}
			{pRows.map((it) => {
				const on = people.has(it.p.id)
				return (
					<Row key={it.p.id} i={at(it)} active={nav.active} onHover={nav.setActive} onClick={() => people.toggle(it.p)}>
						<Face src={it.p.profile} size={32} />
						<span className="min-w-0 flex-1">
							<span className="block truncate text-[14px] font-semibold text-gray-100">{it.p.name}</span>
							<span className="block text-[12px] text-gray-500">{roleOf(it.p.department)}</span>
						</span>
						<span
							className={`flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold whitespace-nowrap ${on ? "text-white" : "text-gray-300 ring-1 ring-inset ring-white/10"}`}
							style={on ? chipStyle(PURPLE) : undefined}
						>
							{on ? <CheckIcon className="h-3.5 w-3.5 text-purple-200" /> : <PlusIcon className="h-3.5 w-3.5" />}
							Cast and crew
							{on && <XMarkIcon className="h-3 w-3 text-white/60" />}
						</span>
						<EnterKey show={nav.active === at(it)} />
					</Row>
				)
			})}
		</div>
	)

	const shaping = <Shaping d={d} uses={uses} known={known.known} people={people} phone={phone} onExample={(k) => uses.toggle("similarTo", k)} />

	if (phone)
		return (
			<div className="flex flex-col gap-6">
				{listBody}
				{shaping}
			</div>
		)
	return (
		<div className="grid h-full min-h-0 grid-cols-[minmax(0,1fr)_380px]">
			<div className="min-h-0 overflow-y-auto overscroll-contain border-r border-white/[0.06] px-5 py-4">{listBody}</div>
			<div className="min-h-0 overflow-y-auto overscroll-contain px-5 py-5">{shaping}</div>
		</div>
	)
}

function Row({
	i,
	active,
	onHover,
	onClick,
	children,
	tall = false,
}: {
	i: number
	active: number
	onHover: (i: number) => void
	onClick: () => void
	children: ReactNode
	tall?: boolean
}) {
	const on = i === active
	return (
		// biome-ignore lint/a11y/useKeyWithClickEvents: the bar's field drives the keyboard (↑ ↓ Enter)
		<div
			data-row={i}
			role="option"
			aria-selected={on}
			tabIndex={-1}
			onMouseEnter={() => onHover(i)}
			onClick={onClick}
			className={`flex min-w-0 shrink-0 items-center gap-3 rounded-xl px-3 cursor-pointer ${tall ? "h-12" : "h-11"} ${
				on ? "bg-white/[0.08] ring-1 ring-inset ring-white/10" : "hover:bg-white/[0.04]"
			}`}
		>
			{children}
		</div>
	)
}

function Head({ icon, children }: { icon: ReactNode; children: ReactNode }) {
	return (
		<h3 className={`${SECTION_LABEL} mt-2 flex h-6 shrink-0 items-center gap-1.5 px-3 text-gray-500 [&>svg]:h-3.5 [&>svg]:w-3.5`}>
			{icon}
			{children}
		</h3>
	)
}

function EnterKey({ show }: { show: boolean }) {
	return (
		<kbd
			className={`hidden h-6 w-7 shrink-0 place-items-center rounded-md bg-black/30 text-amber-200/80 transition-opacity sm:grid ${show ? "opacity-100" : "opacity-0"}`}
			aria-hidden
		>
			<ArrowTurnDownLeftIcon className="h-3.5 w-3.5" />
		</kbd>
	)
}

function TitleItem({
	it,
	i,
	nav,
	uses,
	remember,
	phone,
}: {
	it: FoundTitle
	i: number
	nav: { active: number; setActive: (i: number) => void }
	uses: TitleUses
	remember: (t: FoundTitle) => void
	phone: boolean
}) {
	const toggle = (u: (typeof STEER_ORDER)[number]) => {
		remember(it)
		uses.toggle(u, it.key)
	}
	return (
		<Row i={i} active={nav.active} onHover={nav.setActive} onClick={() => toggle("similarTo")}>
			<PosterThumb poster={it.poster} title={it.title} className="h-[38px] w-[26px]" />
			<span className="min-w-0 flex-1">
				<span className="block truncate text-[14px] font-semibold text-gray-100">{it.title}</span>
				<span className="block text-[12px] text-gray-500">{[it.year, it.mediaType === "movie" ? "Movie" : "Show"].filter(Boolean).join(" · ")}</span>
			</span>
			{/* biome-ignore lint/a11y/useKeyWithClickEvents: only stops the row's own click */}
			<span className="flex shrink-0 items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
				<SteerToggle use="loved" on={uses.has("loved", it.key)} onToggle={() => toggle("loved")} />
				<SteerToggle use="disliked" on={uses.has("disliked", it.key)} onToggle={() => toggle("disliked")} />
				<SteerToggle use="similarTo" on={uses.has("similarTo", it.key)} onToggle={() => toggle("similarTo")} wide={!phone} />
			</span>
			<EnterKey show={nav.active === i} />
		</Row>
	)
}

/** What steers this list now: picked titles by way, picked people. Session chips, each removable. */
function Shaping({
	d,
	uses,
	known,
	people,
	phone,
	onExample,
}: {
	d: SectionProps["d"]
	uses: TitleUses
	known: ReturnType<typeof useKnown>["known"]
	people: ReturnType<typeof usePeople>
	phone: boolean
	onExample: (k: (typeof EXAMPLE_KEYS)[number]["key"]) => void
}) {
	const any = uses.picked.length > 0 || people.chosen.length > 0
	return (
		<div>
			<h3 className={`${SECTION_LABEL} mb-3 flex h-5 items-center gap-2 px-1 text-gray-400`}>
				This list
				<span className="font-normal normal-case tracking-normal tabular-nums text-gray-500">{d.total != null ? `${short(d.total)} titles` : ""}</span>
			</h3>
			{!any && (
				<div className="flex flex-col gap-2">
					{STEER_ORDER.map((u) => (
						<span
							key={u}
							className={`flex h-9 items-center gap-1.5 rounded-full border border-dashed border-white/[0.12] px-3 text-[13px] font-semibold text-gray-500 [&>svg]:h-4 [&>svg]:w-4 ${STEER[u].text} opacity-60`}
						>
							{STEER[u].icon}
							<span className="text-gray-500">{STEER[u].label}</span>
						</span>
					))}
					{!phone && (
						<div className="mt-3 flex flex-wrap gap-1.5">
							{EXAMPLE_KEYS.slice(0, 2).map((t) => (
								<motion.button
									key={t.key}
									type="button"
									whileTap={TAP}
									onClick={() => onExample(t.key)}
									className="flex h-8 items-center gap-1.5 rounded-full bg-white/[0.05] px-3 text-[13px] text-gray-300 ring-1 ring-inset ring-white/10 cursor-pointer outline-none hover:bg-white/[0.1] focus-visible:ring-2 focus-visible:ring-amber-400 [&>svg]:h-3.5 [&>svg]:w-3.5"
								>
									{STEER.similarTo.icon}
									{t.title}
								</motion.button>
							))}
						</div>
					)}
				</div>
			)}
			<div className="flex flex-wrap gap-2">
				{STEER_ORDER.flatMap((u) =>
					uses.listOf(u).map((k) => {
						const t = known(k)
						return (
							<SteerChip key={`${u}:${k}`} use={u} title={t?.title ?? "…"} poster={t?.poster ?? null} onRemove={() => uses.toggle(u, k)} />
						)
					}),
				)}
				{people.chosen.map((id) => {
					const p = people.known(id)
					return (
						<span
							key={id}
							className="inline-flex h-9 shrink-0 items-center rounded-full pl-1 text-[14px] font-semibold whitespace-nowrap text-white"
							style={chipStyle(PURPLE)}
						>
							<Face src={p?.profile ?? null} size={26} />
							<span className="ml-2 max-w-[180px] truncate">{p?.name ?? "…"}</span>
							<button
								type="button"
								onClick={() => people.remove(id)}
								aria-label={`Remove ${p?.name ?? "person"}`}
								className="grid h-full w-8 place-items-center rounded-r-full text-white/50 cursor-pointer outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
							>
								<XMarkIcon className="h-3.5 w-3.5" />
							</button>
						</span>
					)
				})}
			</div>
		</div>
	)
}
