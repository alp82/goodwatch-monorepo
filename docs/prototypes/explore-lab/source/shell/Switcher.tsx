// PROTOTYPE - throwaway (prototype/explore-r4). The one switcher for every concept (prototype-only, hidden in
// production): concept picker with ← →, page links, Movies | Shows, and the notes panel. It collapses to a small tab in
// the corner so it never covers the page, and remembers that.
import { Link, useNavigate } from "@remix-run/react"
import { useEffect, useState } from "react"
import {
	type Address,
	type Kind,
	PREFIX,
	best,
	familyPage,
	href,
	hub,
	ing,
	otherKind,
	place,
	realPath,
} from "../kit/address"
import type { ConceptModule, Note, QuickLink } from "../kit/contract"
import type { ExploreData } from "./load.server"
import { concepts } from "./registry"

/** The page links every concept gets unless it brings its own. */
export const defaultQuickLinks = (kind: Kind): QuickLink[] => [
	{ label: "Hub", address: hub(kind) },
	{ label: "Moods", address: familyPage(kind, "mood") },
	{ label: "Mood", address: place(kind, [ing("mood", "cozy")]) },
	{ label: "Genre", address: place(kind, [ing("genre", "comedy")]) },
	{ label: "Decade", address: place(kind, [ing("decade", "1990s")]) },
	{ label: "Country", address: place(kind, [ing("country", "japan")]) },
	{ label: "Service", address: place(kind, [ing("service", "netflix")]) },
	{ label: "Best", address: best(kind) },
	{ label: "Blend of 2", address: place(kind, [ing("mood", "cozy"), ing("genre", "comedy")]) },
	{
		label: "Blend of 3",
		address: place(kind, [ing("mood", "dark"), ing("genre", "thriller"), ing("decade", "2010s")]),
	},
]

const STORE = "gw-explore-switcher"

export function Switcher({
	d,
	concept,
	notes,
}: {
	d: ExploreData
	concept: ConceptModule | null
	notes: Note[]
}) {
	const navigate = useNavigate()
	const [open, setOpen] = useState(true)
	const [showNotes, setShowNotes] = useState(false)
	useEffect(() => {
		try {
			if (localStorage.getItem(STORE) === "closed") setOpen(false)
		} catch {}
	}, [])
	const toggle = () => {
		setOpen((o) => {
			try {
				localStorage.setItem(STORE, o ? "closed" : "open")
			} catch {}
			return !o
		})
	}
	const CONCEPTS = concepts()
	const gallery = d.address.view === "kit"
	const at = CONCEPTS.findIndex((c) => c.id === d.concept)
	// The same address under another concept.
	const under = (id: string) => (gallery ? `${PREFIX}/${id}/movies` : href(id, d.address))
	const go = (step: number) => {
		if (!CONCEPTS.length) return
		const next = CONCEPTS[(Math.max(0, at) + step + CONCEPTS.length) % CONCEPTS.length]
		navigate(under(next.id))
	}
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return
			// A page's own arrow-key widgets keep their keys: the guide's rows, dials, menus, tabs, rails.
			const own =
				"input, textarea, select, [contenteditable], [role=slider], [role=radiogroup], [role=tablist], [role=menu], [role=listbox], [role=dialog], [data-row], [data-rail], [data-keys]"
			if (
				(e.target as HTMLElement).closest(own) ||
				(document.activeElement as HTMLElement | null)?.closest(own)
			)
				return
			if (e.key === "ArrowLeft") go(-1)
			if (e.key === "ArrowRight") go(1)
		}
		window.addEventListener("keydown", onKey)
		return () => window.removeEventListener("keydown", onKey)
	})
	if (process.env.NODE_ENV === "production") return null

	const kind = d.address.kind
	const links = concept?.quickLinks?.(kind) ?? defaultQuickLinks(kind)
	const here = (a: Address) => realPath(a) === realPath(d.address)
	const pill = "shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors"

	if (!open)
		return (
			<button
				type="button"
				onClick={toggle}
				data-proto-switcher=""
				aria-label="Open the prototype switcher"
				className="fixed right-3 bottom-[5.75rem] z-[60] flex h-9 items-center gap-1.5 rounded-full bg-white px-3 text-xs font-bold text-black shadow-xl ring-2 ring-fuchsia-500 lg:bottom-4"
			>
				<span aria-hidden className="h-2 w-2 rounded-full bg-fuchsia-500" />
				{concept?.name ?? "Kit"}
			</button>
		)

	return (
		<div
			data-proto-switcher=""
			className="fixed bottom-[5.75rem] left-1/2 z-[60] w-[min(100vw-1rem,760px)] -translate-x-1/2 text-black lg:bottom-4"
		>
			{showNotes && (
				<div className="mb-2 max-h-[55vh] overflow-y-auto rounded-2xl bg-white p-4 text-sm shadow-2xl ring-2 ring-fuchsia-500">
					<p className="text-xs font-bold tracking-wide text-fuchsia-600 uppercase">
						Prototype notes · {concept?.name ?? "Kit gallery"}
					</p>
					{concept && <p className="mt-1 font-semibold">{concept.tagline}</p>}
					{notes.length > 0 && (
						<dl className="mt-3 space-y-2">
							{notes.map((n) => (
								<div key={n.term}>
									<dt className="inline font-bold">
										{n.term}
										{n.isNew && (
											<span className="ml-1.5 rounded bg-fuchsia-100 px-1 py-0.5 text-[10px] font-bold text-fuchsia-700 uppercase">
												new
											</span>
										)}
										{": "}
									</dt>
									<dd className="inline text-neutral-700">{n.means}</dd>
								</div>
							))}
						</dl>
					)}
					<p className="mt-3 border-t border-neutral-200 pt-3 text-xs text-neutral-600">
						Real address <code className="font-mono text-neutral-900">{d.canonical}</code>
						{d.address.view === "place" &&
							` · ${d.titles.toLocaleString("en-US")} well-known titles · ${d.indexable ? "indexable" : "noindex (too few titles)"}`}
						{` · server ${d.ms} ms`}
					</p>
				</div>
			)}
			<div className="rounded-2xl bg-white p-1.5 shadow-2xl ring-2 ring-fuchsia-500">
				<div className="flex items-center gap-1">
					<button
						type="button"
						onClick={() => go(-1)}
						className="rounded-full px-2.5 py-1 text-sm font-bold hover:bg-neutral-200 max-sm:hidden"
						aria-label="Previous concept"
					>
						←
					</button>
					<div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto [scrollbar-width:none]">
						{CONCEPTS.map((c) => (
							<Link
								key={c.id}
								to={under(c.id)}
								title={c.tagline}
								className={`${pill} ${c.id === d.concept ? "bg-fuchsia-600 text-white" : "bg-neutral-100 hover:bg-neutral-200"}`}
							>
								{c.name}
							</Link>
						))}
						<Link
							to={`${PREFIX}/_kit`}
							className={`${pill} max-sm:hidden ${gallery ? "bg-fuchsia-600 text-white" : "text-neutral-500 hover:bg-neutral-200"}`}
						>
							Kit
						</Link>
					</div>
					<button
						type="button"
						onClick={() => go(1)}
						className="rounded-full px-2.5 py-1 text-sm font-bold hover:bg-neutral-200 max-sm:hidden"
						aria-label="Next concept"
					>
						→
					</button>
					<button
						type="button"
						onClick={() => setShowNotes((s) => !s)}
						aria-pressed={showNotes}
						className={`${pill} ${showNotes ? "bg-neutral-900 text-white" : "bg-neutral-100 hover:bg-neutral-200"}`}
					>
						Notes
					</button>
					<button
						type="button"
						onClick={toggle}
						aria-label="Collapse the prototype switcher"
						className="rounded-full px-2 py-1 text-sm font-bold text-neutral-500 hover:bg-neutral-200"
					>
						×
					</button>
				</div>
				{!gallery && (
					<div className="mt-1 flex items-center gap-1 overflow-x-auto [scrollbar-width:none]">
						<Link
							to={href(d.concept, otherKind(d.address))}
							className={`${pill} bg-neutral-900 text-white`}
							title="Switch between movies and shows"
						>
							{kind === "all" ? "Both ⇄" : kind === "movie" ? "Movies ⇄" : "Shows ⇄"}
						</Link>
						{links.map((l) => (
							<Link
								key={l.label}
								to={href(d.concept, l.address)}
								className={`${pill} ${here(l.address) ? "bg-fuchsia-100 text-fuchsia-800" : "bg-neutral-100 hover:bg-neutral-200"}`}
							>
								{l.label}
							</Link>
						))}
					</div>
				)}
			</div>
		</div>
	)
}
