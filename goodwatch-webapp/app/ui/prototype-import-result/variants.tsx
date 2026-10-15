// PROTOTYPE - throwaway (#651). Four layouts of the import receipt and the Undo receipt, same sample data.
//   A sections   grouped by kind of change, one bordered list per group (the shipped receipt's list style)
//   B ledger     one row per title with every change as a chip, plus filters
//   C tiles      success hero and count tiles that open their details; Undo leads with a to-do list
//   D compare    before and after, side by side, per title
import { ArrowDownTrayIcon, ChevronDownIcon, ExclamationTriangleIcon } from "@heroicons/react/20/solid"
import { CheckCircleIcon } from "@heroicons/react/24/solid"
import { type ReactNode, useId, useState } from "react"
import { FocusHeading } from "~/ui/imports/FocusHeading"
import { secondaryButton, textLink } from "~/ui/imports/shared"
import {
	IMPORT,
	type ImportChange,
	type ListName,
	SKIPPED,
	TITLES,
	TOTALS,
	type Title,
	UNDO_TOTALS,
	type UndoChange,
	changedTitles,
	formatDay,
	keptTitles,
	leftAlone,
	notRestored,
	undoneTitles,
} from "./data"
import {
	FixButton,
	Poster,
	Score,
	Src,
	SuccessBox,
	TitleLink,
	Year,
	attentionBox,
	episodeRange,
	importLine,
	plural,
	undoLine,
	watchRange,
} from "./parts"

export interface Variant {
	Import: () => ReactNode
	Undo: () => ReactNode
}

const list = "divide-y divide-slate-800 rounded-lg border border-slate-700 bg-slate-900/60"
const sectionHeading = "mb-2 flex items-baseline justify-between font-semibold text-gray-100"

function useFixes() {
	const [fixed, setFixed] = useState<Set<string>>(new Set())
	const toggle = (key: string) =>
		setFixed((s) => {
			const next = new Set(s)
			next.has(key) ? next.delete(key) : next.add(key)
			return next
		})
	return { fixed, toggle }
}

function Footer({ undo = true }: { undo?: boolean }) {
	return (
		<div className="flex flex-col gap-3">
			<div className="flex flex-wrap items-center gap-3">
				{undo && (
					<a href="#skipped" className={secondaryButton}>
						<ArrowDownTrayIcon className="size-5" aria-hidden />
						Download skipped rows ({SKIPPED.length} CSV)
					</a>
				)}
				<button type="button" className={secondaryButton}>
					Import another export
				</button>
			</div>
			{undo && (
				<button type="button" className={`${textLink} min-h-11 self-start`}>
					Undo import
				</button>
			)}
		</div>
	)
}

function ExportNotes() {
	return (
		<div className="rounded-lg border border-amber-800 bg-amber-950/40 p-4">
			<p className="font-semibold text-amber-100">Export notes</p>
			<ul className="mt-2 list-disc pl-5 text-amber-100">
				{IMPORT.warnings.map((w) => (
					<li key={w}>{w}</li>
				))}
			</ul>
		</div>
	)
}

const importSummary = () =>
	[
		TOTALS.ratingsAdded && plural(TOTALS.ratingsAdded, "rating") + " added",
		TOTALS.ratingsReplaced && plural(TOTALS.ratingsReplaced, "rating") + " replaced",
		TOTALS.watchesAdded && plural(TOTALS.watchesAdded, "watch", "watches") + " added",
		TOTALS.listAdded && `${TOTALS.listAdded} added to Want to See`,
		TOTALS.listCleared && `${plural(TOTALS.listCleared, "title")} taken off a list`,
	]
		.filter(Boolean)
		.join(", ")

const undoSummary = () =>
	[
		UNDO_TOTALS.ratingsRemoved && plural(UNDO_TOTALS.ratingsRemoved, "rating") + " removed",
		UNDO_TOTALS.ratingsRestored && plural(UNDO_TOTALS.ratingsRestored, "rating") + " put back",
		UNDO_TOTALS.watchesRemoved && plural(UNDO_TOTALS.watchesRemoved, "watch", "watches") + " removed",
		UNDO_TOTALS.listRemoved && `${UNDO_TOTALS.listRemoved} removed from Want to See`,
	]
		.filter(Boolean)
		.join(", ")

// ---------------------------------------------------------------------------------------------------------
// A. Sections: one list per kind of change.
// ---------------------------------------------------------------------------------------------------------

type Row = { title: Title; detail: ReactNode; source: ImportChange["source"]; action?: ReactNode }

function Section({ heading, count, rows, tone = "", id }: { heading: string; count?: number; rows: Row[]; tone?: string; id?: string }) {
	if (rows.length === 0) return null
	return (
		<div id={id}>
			<h4 className={sectionHeading}>
				<span>{heading}</span>
				<span className="tabular-nums text-gray-400">{count ?? rows.length}</span>
			</h4>
			<ul className={`${list} ${tone}`}>
				{rows.map((r, i) => (
					<li key={`${r.title.tmdbId}-${i}`} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5">
						<Poster title={r.title} />
						<div className="min-w-0 flex-1">
							<p className="truncate">
								<TitleLink title={r.title} />
								<Year title={r.title} />
							</p>
							<p className="text-sm text-gray-300">
								{r.detail}
								<Src source={r.source} />
							</p>
						</div>
						{r.action && <div className="w-full pl-11 sm:w-auto sm:pl-0">{r.action}</div>}
					</li>
				))}
			</ul>
		</div>
	)
}

const rowsOf = <T extends ImportChange["type"]>(type: T, detail: (c: Extract<ImportChange, { type: T }>, t: Title) => ReactNode): Row[] =>
	TITLES.flatMap((t) =>
		t.importChanges
			.filter((c): c is Extract<ImportChange, { type: T }> => c.type === type)
			.map((c) => ({ title: t, detail: detail(c, t), source: c.source })),
	)
const undoRowsOf = <T extends UndoChange["type"]>(type: T, detail: (c: Extract<UndoChange, { type: T }>, t: Title) => ReactNode): Row[] =>
	TITLES.flatMap((t) =>
		t.undoChanges
			.filter((c): c is Extract<UndoChange, { type: T }> => c.type === type)
			.map((c) => ({ title: t, detail: detail(c, t), source: c.source })),
	)

function SkippedSection() {
	return (
		<div id="skipped">
			<h4 className={sectionHeading}>
				<span>Not imported</span>
				<span className="tabular-nums text-gray-400">{SKIPPED.length}</span>
			</h4>
			<ul className={list}>
				{SKIPPED.map((s) => (
					<li key={s.row} className="px-4 py-2.5 text-sm">
						<p>
							<span className="font-semibold text-gray-100">{s.label}</span>
							<span className="text-gray-400">
								{" "}
								· {s.kind} · row {s.row}
							</span>
						</p>
						<p className="text-gray-400">
							{s.reason}
							<Src source="item" />
						</p>
					</li>
				))}
			</ul>
		</div>
	)
}

function SectionsImport() {
	const status = (t: Title) => t.importChanges.find((c) => c.type === "status-set") as Extract<ImportChange, { type: "status-set" }> | undefined
	return (
		<section className="flex flex-col gap-5">
			<FocusHeading focus>Import complete</FocusHeading>
			<SuccessBox title={`${plural(TOTALS.titles, "title")} changed in your GoodWatch library`}>
				<p>
					{importSummary()}. From {IMPORT.fileName}.
				</p>
			</SuccessBox>
			<Section heading="Ratings added" rows={rowsOf("rating-added", (c) => <>Rated <Score n={c.score} /></>)} />
			<Section heading="Ratings replaced" rows={rowsOf("rating-replaced", (c) => <>Your <Score n={c.from} muted /> is now <Score n={c.to} /></>)} />
			<Section
				heading="Watches added"
				count={TOTALS.watchesAdded}
				rows={rowsOf("watches-added", (c, t) => {
					const eps = episodeRange(c.watches)
					const s = status(t)
					return (
						<>
							{eps ? `${plural(c.watches.length, "episode")} (${eps}) · ` : ""}
							{watchRange(c.watches)}
							{s && ` · now ${s.to}`}
						</>
					)
				})}
			/>
			<Section heading="Added to Want to See" rows={rowsOf("list-added", () => <>Added to Want to See</>)} />
			<Section
				heading="Taken off your lists"
				tone="border-amber-800"
				rows={rowsOf("list-cleared", (c) => <>Off {c.list}, because {c.because}. Undo won't put it back.</>)}
			/>
			<Section heading="Kept as it was" rows={rowsOf("kept", (c) => <>{c.what}. {c.reason}</>)} />
			<SkippedSection />
			<ExportNotes />
			<Footer />
		</section>
	)
}

function SectionsUndo() {
	const { fixed, toggle } = useFixes()
	const notBack: Row[] = notRestored.map(({ title, list: l }) => ({
		title,
		detail: <>Was on {l} before the import</>,
		source: (title.undoChanges.find((c) => c.type === "not-restored" && c.list === l) as UndoChange).source,
		action: <FixButton list={l} done={fixed.has(`${title.tmdbId}:${l}`)} onClick={() => toggle(`${title.tmdbId}:${l}`)} />,
	}))
	return (
		<section className="flex flex-col gap-5">
			<FocusHeading focus>Import undone</FocusHeading>
			<SuccessBox title={`GoodWatch reverted ${plural(UNDO_TOTALS.titles, "title")}`}>
				<p>{undoSummary()}.</p>
			</SuccessBox>
			<div className={attentionBox}>
				<p className="flex items-center gap-2 font-semibold">
					<ExclamationTriangleIcon className="size-5" aria-hidden /> {plural(notRestored.length, "list choice")} could not be put back
				</p>
				<p className="mt-1 text-sm">The import took these titles off a list. Put them back here, or leave them.</p>
			</div>
			<Section heading="Not put back" rows={notBack} tone="border-amber-800" />
			<Section heading="Ratings removed" rows={undoRowsOf("rating-removed", (c) => <>Your <Score n={c.score} muted /> is gone</>)} />
			<Section heading="Ratings put back" rows={undoRowsOf("rating-restored", (c) => <>Back to <Score n={c.to} /> (the import set <Score n={c.from} muted />)</>)} />
			<Section
				heading="Watches removed"
				count={UNDO_TOTALS.watchesRemoved}
				rows={undoRowsOf("watches-removed", (c, t) => {
					const eps = episodeRange(c.watches)
					const s = t.undoChanges.find((x) => x.type === "status-restored") as Extract<UndoChange, { type: "status-restored" }> | undefined
					return (
						<>
							{eps ? `${plural(c.watches.length, "episode")} (${eps}) · ` : ""}
							{watchRange(c.watches)}
							{s && ` · back to ${s.to}`}
						</>
					)
				})}
			/>
			<Section heading="Removed from Want to See" rows={undoRowsOf("list-removed", () => <>Removed from Want to See</>)} />
			<Section heading="Left as you changed it" rows={undoRowsOf("left-alone", (c) => <>{c.what} stays. {c.reason}</>)} />
			<Footer undo={false} />
		</section>
	)
}

// ---------------------------------------------------------------------------------------------------------
// B. Ledger: one row per title, every change as a chip, with filters.
// ---------------------------------------------------------------------------------------------------------

type Filter = { key: string; label: string; match: (t: Title) => boolean }

function Chips({ children }: { children: ReactNode }) {
	return <div className="mt-1.5 flex flex-wrap gap-1.5">{children}</div>
}
const chip = "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-sm"
const chipTone = {
	add: "border-emerald-800 bg-emerald-950/60 text-emerald-100",
	change: "border-indigo-700 bg-indigo-950/60 text-indigo-100",
	warn: "border-amber-700 bg-amber-950/60 text-amber-100",
	quiet: "border-slate-700 bg-slate-800/60 text-gray-300",
	remove: "border-rose-800 bg-rose-950/50 text-rose-100",
}

function ImportChip({ c }: { c: ImportChange }) {
	const [open, setOpen] = useState(false)
	const tone =
		c.type === "list-cleared" ? chipTone.warn : c.type === "kept" ? chipTone.quiet : c.type === "rating-replaced" || c.type === "status-set" ? chipTone.change : chipTone.add
	if (c.type === "watches-added" && c.watches.length > 1)
		return (
			<span className="contents">
				<button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className={`${chip} ${tone} cursor-pointer`}>
					{importLine(c)}
					<ChevronDownIcon className={`size-4 ${open ? "rotate-180" : ""}`} aria-hidden />
					<Src source={c.source} />
				</button>
				{open && (
					<span className="basis-full rounded-md bg-gray-950/60 px-3 py-2 text-sm text-gray-300">
						{c.watches.map((w) => (
							<span key={w.episode} className="mr-4 inline-block tabular-nums">
								{w.episode} · {formatDay(w.date)}
							</span>
						))}
					</span>
				)}
			</span>
		)
	return (
		<span className={`${chip} ${tone}`}>
			{importLine(c)}
			<Src source={c.source} />
		</span>
	)
}

function Ledger({ filters, rows, initial }: { filters: Filter[]; rows: (t: Title) => ReactNode; initial: string }) {
	const [active, setActive] = useState(initial)
	const f = filters.find((x) => x.key === active) ?? filters[0]
	const shown = TITLES.filter(f.match)
	return (
		<div className="flex flex-col gap-3">
			<div role="radiogroup" aria-label="Show" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
				{filters.map((x) => {
					const n = x.key === "skipped" ? SKIPPED.length : TITLES.filter(x.match).length
					if (n === 0) return null
					return (
						<button
							key={x.key}
							type="button"
							role="radio"
							aria-checked={x.key === active}
							onClick={() => setActive(x.key)}
							className={`min-h-9 shrink-0 cursor-pointer whitespace-nowrap rounded-full border px-3 text-sm font-semibold ${x.key === active ? "border-indigo-500 bg-indigo-700 text-white" : "border-slate-600 bg-slate-800 text-gray-300 hover:bg-slate-700"}`}
						>
							{x.label} <span className="tabular-nums opacity-80">{n}</span>
						</button>
					)
				})}
			</div>
			{active === "skipped" ? (
				<ul className={list}>
					{SKIPPED.map((s) => (
						<li key={s.row} className="px-4 py-3 text-sm">
							<p className="font-semibold text-gray-100">
								{s.label} <span className="font-normal text-gray-400">· {s.kind} · row {s.row}</span>
							</p>
							<p className="text-gray-400">{s.reason}</p>
						</li>
					))}
				</ul>
			) : (
				<ul className={list}>
					{shown.map((t) => (
						<li key={t.tmdbId} className="flex gap-3 px-4 py-3">
							<Poster title={t} size="md" />
							<div className="min-w-0 flex-1">
								<p>
									<TitleLink title={t} />
									<Year title={t} />
								</p>
								{rows(t)}
							</div>
						</li>
					))}
				</ul>
			)}
		</div>
	)
}

const has = (t: Title, ...types: string[]) => t.importChanges.some((c) => types.includes(c.type))
const hasUndo = (t: Title, ...types: string[]) => t.undoChanges.some((c) => types.includes(c.type))

function LedgerImport() {
	const filters: Filter[] = [
		{ key: "all", label: "Changed", match: (t) => has(t, "rating-added", "rating-replaced", "watches-added", "list-added", "list-cleared") },
		{ key: "ratings", label: "Ratings", match: (t) => has(t, "rating-added", "rating-replaced") },
		{ key: "watches", label: "Watches", match: (t) => has(t, "watches-added") },
		{ key: "lists", label: "Lists", match: (t) => has(t, "list-added", "list-cleared") },
		{ key: "kept", label: "Kept", match: (t) => has(t, "kept") },
		{ key: "skipped", label: "Not imported", match: () => false },
	]
	return (
		<section className="flex flex-col gap-4">
			<div className="flex items-start gap-3">
				<CheckCircleIcon className="size-10 shrink-0 text-emerald-400" aria-hidden />
				<div>
					<FocusHeading focus>Import complete: {plural(TOTALS.titles, "title")} changed</FocusHeading>
					<p className="text-gray-400">{importSummary()}.</p>
				</div>
			</div>
			<Ledger
				filters={filters}
				initial="all"
				rows={(t) => (
					<Chips>
						{t.importChanges.map((c, i) => (
							<ImportChip key={i} c={c} />
						))}
					</Chips>
				)}
			/>
			<ExportNotes />
			<Footer />
		</section>
	)
}

function LedgerUndo() {
	const { fixed, toggle } = useFixes()
	const filters: Filter[] = [
		{ key: "needs", label: "Needs you", match: (t) => hasUndo(t, "not-restored", "left-alone") },
		{ key: "all", label: "Reverted", match: (t) => t.undoChanges.length > 0 },
		{ key: "ratings", label: "Ratings", match: (t) => hasUndo(t, "rating-removed", "rating-restored") },
		{ key: "watches", label: "Watches", match: (t) => hasUndo(t, "watches-removed") },
		{ key: "lists", label: "Lists", match: (t) => hasUndo(t, "list-removed", "not-restored") },
	]
	return (
		<section className="flex flex-col gap-4">
			<div className="flex items-start gap-3">
				<CheckCircleIcon className="size-10 shrink-0 text-emerald-400" aria-hidden />
				<div>
					<FocusHeading focus>Import undone: {plural(UNDO_TOTALS.titles, "title")} reverted</FocusHeading>
					<p className="text-gray-400">
						{undoSummary()}. {plural(notRestored.length + leftAlone.length, "thing")} need{notRestored.length + leftAlone.length === 1 ? "s" : ""} a look.
					</p>
				</div>
			</div>
			<Ledger
				filters={filters}
				initial="needs"
				rows={(t) => (
					<Chips>
						{t.undoChanges.map((c, i) => {
							const tone = c.type === "not-restored" || c.type === "left-alone" ? chipTone.warn : c.type === "rating-restored" || c.type === "status-restored" ? chipTone.change : chipTone.remove
							return (
								<span key={i} className={`${chip} ${tone}`}>
									{undoLine(c)}
									<Src source={c.source} />
								</span>
							)
						})}
						{t.undoChanges
							.filter((c): c is Extract<UndoChange, { type: "not-restored" }> => c.type === "not-restored")
							.map((c) => (
								<FixButton key={c.list} list={c.list} done={fixed.has(`${t.tmdbId}:${c.list}`)} onClick={() => toggle(`${t.tmdbId}:${c.list}`)} />
							))}
					</Chips>
				)}
			/>
			<Footer undo={false} />
		</section>
	)
}

// ---------------------------------------------------------------------------------------------------------
// C. Tiles: a success hero and count tiles that open their details; Undo leads with a to-do list.
// ---------------------------------------------------------------------------------------------------------

type Tile = { key: string; big: string; label: string; sub: string; tone?: string; body: ReactNode }

function Tiles({ tiles, initial }: { tiles: Tile[]; initial: string | null }) {
	const [open, setOpen] = useState<string | null>(initial)
	const panelId = useId()
	const current = tiles.find((t) => t.key === open)
	return (
		<div className="flex flex-col gap-3">
			<div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
				{tiles.map((t) => (
					<button
						key={t.key}
						type="button"
						aria-expanded={open === t.key}
						aria-controls={panelId}
						onClick={() => setOpen(open === t.key ? null : t.key)}
						className={`flex cursor-pointer flex-col items-start rounded-lg border p-3 text-left ${open === t.key ? "border-indigo-500 bg-indigo-950/60" : `${t.tone ?? "border-slate-700"} bg-slate-900/60 hover:bg-slate-800/70`}`}
					>
						<span className="text-2xl font-bold tabular-nums text-gray-100">{t.big}</span>
						<span className="font-semibold text-gray-100">{t.label}</span>
						<span className="text-sm text-gray-400">{t.sub}</span>
					</button>
				))}
			</div>
			<div id={panelId}>{current?.body}</div>
		</div>
	)
}

function PlainRows({ rows }: { rows: { title: Title; lines: { node: ReactNode; source: ImportChange["source"] }[] }[] }) {
	return (
		<ul className={list}>
			{rows.map(({ title, lines }) => (
				<li key={title.tmdbId} className="flex items-center gap-3 px-4 py-2.5">
					<Poster title={title} />
					<div className="min-w-0">
						<p>
							<TitleLink title={title} />
							<Year title={title} />
						</p>
						{lines.map((l, i) => (
							<p key={i} className="text-sm text-gray-300">
								{l.node}
								<Src source={l.source} />
							</p>
						))}
					</div>
				</li>
			))}
		</ul>
	)
}

const pick = (types: ImportChange["type"][]) =>
	TITLES.filter((t) => has(t, ...types)).map((t) => ({
		title: t,
		lines: t.importChanges.filter((c) => types.includes(c.type)).map((c) => ({ node: importLine(c), source: c.source })),
	}))
const pickUndo = (types: UndoChange["type"][]) =>
	TITLES.filter((t) => hasUndo(t, ...types)).map((t) => ({
		title: t,
		lines: t.undoChanges.filter((c) => types.includes(c.type)).map((c) => ({ node: undoLine(c), source: c.source })),
	}))

function TilesImport() {
	const tiles: Tile[] = [
		{ key: "ratings", big: `${TOTALS.ratingsAdded + TOTALS.ratingsReplaced}`, label: "Ratings", sub: `${TOTALS.ratingsAdded} new, ${TOTALS.ratingsReplaced} replaced`, body: <PlainRows rows={pick(["rating-added", "rating-replaced"])} /> },
		{ key: "watches", big: `${TOTALS.watchesAdded}`, label: "Watches", sub: `across ${pick(["watches-added"]).length} titles`, body: <PlainRows rows={pick(["watches-added", "status-set"])} /> },
		{
			key: "lists",
			big: `${TOTALS.listAdded + TOTALS.listCleared}`,
			label: "List changes",
			sub: `${TOTALS.listAdded} added, ${TOTALS.listCleared} taken off`,
			tone: "border-amber-700",
			body: <PlainRows rows={pick(["list-added", "list-cleared"])} />,
		},
		{
			key: "rest",
			big: `${TOTALS.kept + TOTALS.skipped}`,
			label: "Not changed",
			sub: `${TOTALS.kept} kept, ${TOTALS.skipped} not imported`,
			body: (
				<div className="flex flex-col gap-3">
					<PlainRows rows={pick(["kept"])} />
					<SkippedSection />
				</div>
			),
		},
	]
	return (
		<section className="flex flex-col gap-5">
			<div className="flex flex-col items-center gap-2 rounded-lg border border-emerald-800 bg-emerald-950/40 px-4 py-6 text-center">
				<CheckCircleIcon className="size-12 text-emerald-400" aria-hidden />
				<FocusHeading focus>Your import is in</FocusHeading>
				<p className="text-emerald-100/90">
					{plural(TOTALS.titles, "title")} changed from {IMPORT.fileName}
				</p>
			</div>
			<Tiles tiles={tiles} initial="lists" />
			<ExportNotes />
			<Footer />
		</section>
	)
}

function TilesUndo() {
	const { fixed, toggle } = useFixes()
	const todo = [...notRestored.map((n) => ({ ...n, key: `${n.title.tmdbId}:${n.list}` }))]
	const done = todo.filter((t) => fixed.has(t.key)).length
	const tiles: Tile[] = [
		{ key: "removed", big: `${UNDO_TOTALS.ratingsRemoved + UNDO_TOTALS.watchesRemoved + UNDO_TOTALS.listRemoved}`, label: "Removed", sub: `${UNDO_TOTALS.ratingsRemoved} ratings, ${UNDO_TOTALS.watchesRemoved} watches, ${UNDO_TOTALS.listRemoved} list`, body: <PlainRows rows={pickUndo(["rating-removed", "watches-removed", "list-removed"])} /> },
		{ key: "restored", big: `${UNDO_TOTALS.ratingsRestored + UNDO_TOTALS.statusRestored}`, label: "Put back", sub: `${plural(UNDO_TOTALS.ratingsRestored, "rating")}, ${plural(UNDO_TOTALS.statusRestored, "show status", "show statuses")}`, body: <PlainRows rows={pickUndo(["rating-restored", "status-restored"])} /> },
		{ key: "left", big: `${UNDO_TOTALS.leftAlone}`, label: "Left alone", sub: "changed after the import", body: <PlainRows rows={pickUndo(["left-alone"])} /> },
	]
	return (
		<section className="flex flex-col gap-5">
			<div className="flex flex-col items-center gap-2 rounded-lg border border-emerald-800 bg-emerald-950/40 px-4 py-6 text-center">
				<CheckCircleIcon className="size-12 text-emerald-400" aria-hidden />
				<FocusHeading focus>Back to how it was</FocusHeading>
				<p className="text-emerald-100/90">The import from {IMPORT.fileName} is undone.</p>
			</div>
			<div className={attentionBox}>
				<p className="flex items-center justify-between gap-2 font-semibold">
					<span>Your to-do</span>
					<span className="tabular-nums text-sm">
						{done} of {todo.length} done
					</span>
				</p>
				<p className="mt-1 text-sm">Undo can't put titles back on a list the import took them off. Fix them here.</p>
				<ul className="mt-3 flex flex-col gap-2">
					{todo.map((t) => (
						<li key={t.key} className="flex flex-wrap items-center gap-3 rounded-md bg-gray-950/50 px-3 py-2">
							<Poster title={t.title} />
							<p className="min-w-0 flex-1 basis-40 text-gray-100">
								<TitleLink title={t.title} />
								<span className="block text-sm text-amber-100/80">was on {t.list}</span>
							</p>
							<FixButton list={t.list} done={fixed.has(t.key)} onClick={() => toggle(t.key)} />
						</li>
					))}
				</ul>
			</div>
			<Tiles tiles={tiles} initial={null} />
			<Footer undo={false} />
		</section>
	)
}

// ---------------------------------------------------------------------------------------------------------
// D. Compare: before and after, side by side, per title.
// ---------------------------------------------------------------------------------------------------------

type Side = { node: ReactNode; source?: ImportChange["source"] }[]

/** What the title looked like before the import, from the journal's `before` and the plan's cleared lists. */
function beforeOf(t: Title): Side {
	const out: Side = []
	for (const c of t.importChanges) {
		if (c.type === "rating-replaced") out.push({ node: <>Rated <Score n={c.from} /></>, source: c.source })
		if (c.type === "rating-added") out.push({ node: <span className="text-gray-500">Not rated</span>, source: c.source })
		if (c.type === "list-cleared") out.push({ node: <>On {c.list}</>, source: c.source })
		if (c.type === "status-set") out.push({ node: <span className="text-gray-500">Not tracked</span>, source: c.source })
		if (c.type === "watches-added") out.push({ node: <span className="text-gray-500">No watches</span> })
		if (c.type === "list-added") out.push({ node: <span className="text-gray-500">Not on Want to See</span> })
	}
	return out
}
function afterOf(t: Title): Side {
	return t.importChanges.flatMap((c): Side => {
		if (c.type === "rating-added" || c.type === "rating-replaced") return [{ node: <>Rated <Score n={c.type === "rating-added" ? c.score : c.to} /></>, source: c.source }]
		if (c.type === "watches-added") {
			const eps = episodeRange(c.watches)
			return [{ node: <>{eps ? `${eps} watched` : "Watched"} · {watchRange(c.watches)}</>, source: c.source }]
		}
		if (c.type === "status-set") return [{ node: <>{c.to}</>, source: c.source }]
		if (c.type === "list-added") return [{ node: <>On {c.list}</>, source: c.source }]
		if (c.type === "list-cleared") return [{ node: <span className="text-amber-200">Off {c.list}</span>, source: c.source }]
		return []
	})
}

function SideCell({ side, label }: { side: Side; label: string }) {
	return (
		<div className="min-w-0">
			<p className="text-xs font-semibold uppercase tracking-wide text-gray-500 sm:hidden">{label}</p>
			{side.map((s, i) => (
				<p key={i} className="text-sm text-gray-200">
					{s.node}
					{s.source && <Src source={s.source} />}
				</p>
			))}
		</div>
	)
}

function CompareTable({ heads, rows }: { heads: [string, string, string]; rows: { title: Title; left: Side; right: Side; flag?: ReactNode }[] }) {
	return (
		<div className={`${list} overflow-hidden`}>
			<div className="hidden grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)] gap-4 bg-slate-800/60 px-4 py-2 text-sm font-semibold text-gray-300 sm:grid">
				{heads.map((h) => (
					<span key={h}>{h}</span>
				))}
			</div>
			{rows.map((r) => (
				<div key={r.title.tmdbId} className="grid grid-cols-2 gap-x-4 gap-y-2 px-4 py-3 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)]">
					<div className="col-span-2 flex items-center gap-3 sm:col-span-1">
						<Poster title={r.title} />
						<div className="min-w-0">
							<TitleLink title={r.title} />
							<p className="text-sm text-gray-400">
								{r.title.year}
								{r.title.mediaType === "show" ? " · Show" : ""}
							</p>
							{r.flag}
						</div>
					</div>
					<SideCell side={r.left} label={heads[1]} />
					<SideCell side={r.right} label={heads[2]} />
				</div>
			))}
		</div>
	)
}

function CompareImport() {
	return (
		<section className="flex flex-col gap-5">
			<FocusHeading focus>Import complete</FocusHeading>
			<SuccessBox title={`${plural(TOTALS.titles, "title")} changed. Here is each one, before and after.`}>
				<p>{importSummary()}.</p>
			</SuccessBox>
			<CompareTable heads={["Title", "Before", "After"]} rows={changedTitles.map((t) => ({ title: t, left: beforeOf(t), right: afterOf(t) }))} />
			<details className="rounded-lg border border-slate-700 bg-slate-900/60">
				<summary className="flex min-h-11 cursor-pointer items-center justify-between px-4 py-3 font-semibold text-gray-100">
					<span>Kept as it was</span>
					<span className="tabular-nums">{keptTitles.length}</span>
				</summary>
				<div className="border-t border-slate-800 px-4 py-3 text-sm">
					{keptTitles.map((t) => (
						<p key={t.tmdbId} className="py-1">
							<TitleLink title={t} />
							<span className="text-gray-400"> · {t.importChanges.map((c) => (c.type === "kept" ? `${c.what}. ${c.reason}` : "")).join("")}</span>
						</p>
					))}
				</div>
			</details>
			<details id="skipped" className="rounded-lg border border-slate-700 bg-slate-900/60">
				<summary className="flex min-h-11 cursor-pointer items-center justify-between px-4 py-3 font-semibold text-gray-100">
					<span>Not imported</span>
					<span className="tabular-nums">{SKIPPED.length}</span>
				</summary>
				<div className="border-t border-slate-800 px-4 py-3 text-sm">
					{SKIPPED.map((s) => (
						<p key={s.row} className="py-1">
							<span className="font-semibold text-gray-100">{s.label}</span>
							<span className="text-gray-400"> · {s.reason}</span>
						</p>
					))}
				</div>
			</details>
			<ExportNotes />
			<Footer />
		</section>
	)
}

function CompareUndo() {
	const { fixed, toggle } = useFixes()
	const now = (t: Title): Side =>
		t.undoChanges.map((c) => {
			if (c.type === "rating-removed") return { node: <span className="text-gray-500">Not rated</span>, source: c.source }
			if (c.type === "rating-restored") return { node: <>Rated <Score n={c.to} /></>, source: c.source }
			if (c.type === "watches-removed") return { node: <span className="text-gray-500">No watches</span>, source: c.source }
			if (c.type === "status-restored") return { node: <span className="text-gray-500">{c.to}</span>, source: c.source }
			if (c.type === "list-removed") return { node: <span className="text-gray-500">Not on {c.list}</span>, source: c.source }
			if (c.type === "left-alone") return { node: <span className="text-amber-200">{c.what} stays</span>, source: c.source }
			return { node: <span className="text-amber-200">Still off {c.list}</span>, source: c.source }
		})
	const flag = (t: Title) => {
		const missing = t.undoChanges.filter((c): c is Extract<UndoChange, { type: "not-restored" }> => c.type === "not-restored")
		const left = t.undoChanges.find((c) => c.type === "left-alone") as Extract<UndoChange, { type: "left-alone" }> | undefined
		if (!missing.length && !left) return null
		return (
			<div className="mt-1.5 flex flex-col items-start gap-1.5">
				{left && <span className="text-sm text-amber-200">{left.reason}</span>}
				{missing.map((c) => (
					<FixButton key={c.list} list={c.list} done={fixed.has(`${t.tmdbId}:${c.list}`)} onClick={() => toggle(`${t.tmdbId}:${c.list}`)} />
				))}
			</div>
		)
	}
	const ordered = [...undoneTitles].sort((a, b) => Number(!!flag(b)) - Number(!!flag(a)))
	return (
		<section className="flex flex-col gap-5">
			<FocusHeading focus>Import undone</FocusHeading>
			<SuccessBox title={`${plural(UNDO_TOTALS.titles, "title")} reverted. Here is each one, after the import and now.`}>
				<p>
					{undoSummary()}. {plural(notRestored.length, "list choice")} could not be put back; those titles come first.
				</p>
			</SuccessBox>
			<CompareTable heads={["Title", "After the import", "Now"]} rows={ordered.map((t) => ({ title: t, left: afterOf(t), right: now(t), flag: flag(t) }))} />
			<Footer undo={false} />
		</section>
	)
}

export const VARIANTS: Record<string, { name: string; view: Variant }> = {
	A: { name: "Sections by kind of change", view: { Import: SectionsImport, Undo: SectionsUndo } },
	B: { name: "Per-title ledger with filters", view: { Import: LedgerImport, Undo: LedgerUndo } },
	C: { name: "Summary tiles and to-do", view: { Import: TilesImport, Undo: TilesUndo } },
	D: { name: "Before and after per title", view: { Import: CompareImport, Undo: CompareUndo } },
}

export type { ListName }
