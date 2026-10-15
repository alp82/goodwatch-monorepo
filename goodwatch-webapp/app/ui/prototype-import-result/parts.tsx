// PROTOTYPE - throwaway (#651). Small pieces the four receipt variants share: poster, title link, change wording,
// and the data-source tag that `?data=1` shows next to every line.
import { CheckCircleIcon } from "@heroicons/react/24/solid"
import { Link } from "@remix-run/react"
import { type ReactNode, createContext, useContext } from "react"
import {
	type ImportChange,
	type Source,
	SOURCE_LABEL,
	type Title,
	type UndoChange,
	type Watch,
	formatDay,
	titlePath,
} from "./data"

export const PostersContext = createContext<Record<number, string | null>>({})
export const ShowDataContext = createContext(false)

export function Poster({ title, size = "sm" }: { title: Title; size?: "sm" | "md" }) {
	const posters = useContext(PostersContext)
	const path = posters[title.tmdbId]
	const box = size === "sm" ? "h-12 w-8" : "h-[4.5rem] w-12"
	return path ? (
		<img src={`https://image.tmdb.org/t/p/w92${path}`} alt="" className={`${box} shrink-0 rounded object-cover`} loading="lazy" />
	) : (
		<span className={`${box} shrink-0 rounded bg-slate-800`} aria-hidden />
	)
}

export function TitleLink({ title, className = "" }: { title: Title; className?: string }) {
	return (
		<Link to={titlePath(title)} className={`font-semibold text-gray-100 hover:text-indigo-200 hover:underline underline-offset-4 ${className}`}>
			{title.title}
		</Link>
	)
}

export function Year({ title }: { title: Title }) {
	return (
		<span className="text-gray-400">
			{" "}
			· {title.year}
			{title.mediaType === "show" ? " · Show" : ""}
		</span>
	)
}

const SOURCE_TONE: Record<Source, string> = {
	item: "bg-slate-700 text-slate-100",
	journal: "bg-sky-900 text-sky-100",
	plan: "bg-teal-900 text-teal-100",
	new: "bg-fuchsia-800 text-fuchsia-50",
}
/** Prototype-only: where the line's data comes from. Shown with `?data=1`. */
export function Src({ source }: { source: Source }) {
	if (!useContext(ShowDataContext)) return null
	return <span className={`ml-2 inline-block rounded px-1.5 py-0.5 align-middle text-[11px] font-semibold ${SOURCE_TONE[source]}`}>{SOURCE_LABEL[source]}</span>
}

export const watchRange = (watches: Watch[]) => {
	const dated = watches.map((w) => w.date).filter((d): d is string => d !== null).sort()
	if (dated.length === 0) return "No date"
	const first = formatDay(dated[0])
	const last = formatDay(dated.at(-1) ?? null)
	return first === last ? first : `${first} – ${last}`
}
export const episodeRange = (watches: Watch[]) => {
	const eps = watches.map((w) => w.episode).filter(Boolean) as string[]
	if (eps.length === 0) return null
	if (eps.length === 1) return eps[0]
	const season = eps[0].split(" ")[0]
	return `${season} E${eps[0].split("E")[1]}–E${eps.at(-1)?.split("E")[1]}`
}
export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

/** One sentence per import change, for the variants that list changes as text. */
export function importLine(c: ImportChange): ReactNode {
	switch (c.type) {
		case "rating-added":
			return <>Rated <Score n={c.score} /></>
		case "rating-replaced":
			return <>Rating <Score n={c.from} muted /> → <Score n={c.to} /></>
		case "watches-added": {
			const eps = episodeRange(c.watches)
			return eps ? <>Watched {eps} · {watchRange(c.watches)}</> : <>Watched · {watchRange(c.watches)}</>
		}
		case "status-set":
			return <>Status set to {c.to}</>
		case "list-added":
			return <>Added to {c.list}</>
		case "list-cleared":
			return <>Taken off {c.list}, because {c.because}</>
		case "kept":
			return <>{c.what}: {c.reason}</>
	}
}

export function undoLine(c: UndoChange): ReactNode {
	switch (c.type) {
		case "rating-removed":
			return <>Rating <Score n={c.score} muted /> removed</>
		case "rating-restored":
			return <>Rating back to <Score n={c.to} /> (was <Score n={c.from} muted />)</>
		case "watches-removed": {
			const eps = episodeRange(c.watches)
			return eps ? <>{plural(c.watches.length, "watch", "watches")} removed · {eps}</> : <>Watch removed · {watchRange(c.watches)}</>
		}
		case "status-restored":
			return <>Status back to {c.to} (was {c.from})</>
		case "list-removed":
			return <>Removed from {c.list}</>
		case "left-alone":
			return <>{c.what} stays: {c.reason}</>
		case "not-restored":
			return <>Not put back on {c.list}</>
	}
}

export function Score({ n, muted = false }: { n: number; muted?: boolean }) {
	return <span className={`tabular-nums font-bold ${muted ? "text-gray-400 line-through decoration-1" : "text-amber-300"}`}>{n}</span>
}

export const successBox = "py-3 px-4 text-base border-l-8 border-emerald-600 text-emerald-50 bg-emerald-950"
export const attentionBox = "rounded-lg border border-amber-700 bg-amber-950/50 p-4 text-amber-100"

export function SuccessBox({ title, children }: { title: string; children?: ReactNode }) {
	return (
		<div className={`${successBox} flex gap-3`} role="status">
			<CheckCircleIcon className="mt-0.5 size-6 shrink-0 text-emerald-400" aria-hidden />
			<div>
				<p className="font-semibold">{title}</p>
				{children && <div className="mt-1 text-emerald-100/90">{children}</div>}
			</div>
		</div>
	)
}

/** A list action the build would wire to the real Want to See / Not interested writers. In memory here. */
export function FixButton({ list, done, onClick }: { list: string; done: boolean; onClick: () => void }) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={`inline-flex min-h-9 shrink-0 cursor-pointer items-center gap-1 rounded-md border px-3 py-1 text-sm font-semibold ${done ? "border-emerald-700 bg-emerald-950 text-emerald-200" : "border-slate-600 bg-slate-800 text-gray-200 hover:bg-slate-700"}`}
		>
			{done ? `Back on ${list}` : list === "Want to See" ? "Add back to Want to See" : "Mark Not interested again"}
		</button>
	)
}
