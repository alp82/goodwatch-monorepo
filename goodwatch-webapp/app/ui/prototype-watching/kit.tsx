// PROTOTYPE - throwaway. Pieces the variants of /prototype/watching share: the one-tap Watched button, the rows of
// shows that have no Next episode, the toast, and the prototype's own chrome (state panel, Tonight's pick preview).
import { CheckIcon, ChevronDownIcon } from "@heroicons/react/24/solid"
import { AnimatePresence, motion } from "framer-motion"
import { type ReactNode, useEffect } from "react"
import { type Entry, type Slot, type Store, type VariantKey, ago, aired, code, img, isNew, tonightsPick, waitLine, watchNextOf } from "./model"

/** The one-tap mark: the Next episode is watched now, and the card moves on to the following one. */
export function WatchedButton({
	entry,
	store,
	className = "",
	label = "long",
}: { entry: Entry; store: Store; className?: string; label?: "long" | "short" | "none" }) {
	const ep = entry.next
	if (!ep) return null
	return (
		<button
			type="button"
			data-watched={entry.show.key}
			onClick={(e) => {
				e.preventDefault()
				e.stopPropagation()
				store.markWatched(entry.show.key)
			}}
			aria-label={`Mark ${entry.show.title} ${code(ep)} watched`}
			className={`inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-white/10 font-semibold text-white ring-1 ring-white/10 hover:bg-green-500/25 hover:ring-green-400/60 ${label === "none" ? "h-10 w-10" : "h-10 px-3 text-sm"} ${className}`}
		>
			<CheckIcon className="h-5 w-5 text-green-400" aria-hidden />
			{label === "long" ? `Watched ${code(ep)}` : label === "short" ? "Watched" : null}
		</button>
	)
}

export const NewBadge = ({ className = "" }: { className?: string }) => (
	<span className={`rounded bg-amber-400 px-1.5 py-0.5 text-[11px] font-black uppercase tracking-wide text-black ${className}`}>New</span>
)

/** Episodes watched of all the show has. */
export function Progress({ entry, className = "" }: { entry: Entry; className?: string }) {
	const pct = Math.round((entry.done / Math.max(1, entry.show.total)) * 100)
	return (
		<span className={`block h-1 overflow-hidden rounded-full bg-white/10 ${className}`} title={`${entry.done} of ${entry.show.total} episodes watched`}>
			<span className="block h-full rounded-full bg-amber-400/80" style={{ width: `${pct}%` }} />
		</span>
	)
}

/** "Aired Sep 29 · you watched E3 yesterday". */
export const episodeFacts = (today: string, e: Entry) =>
	[e.next ? aired(today, e.next) : null, e.kind === "seenNew" ? `${e.left} new since you saw it` : `last watched ${ago(e.track.lastWatch)}`]
		.filter(Boolean)
		.join(" · ")

/** A show without a Next episode tonight, or one that is On hold: a compact row with its date or its way back. */
export function QuietRow({ entry, store }: { entry: Entry; store: Store }) {
	const { show, kind } = entry
	const line =
		kind === "caughtUp"
			? `Caught up · ${waitLine(entry)}`
			: kind === "comingBack"
				? `Seen · ${waitLine(entry)}`
				: kind === "seenNew" && entry.next
					? `Seen · ${entry.left} new: ${code(entry.next)} · ${entry.next.name}`
					: kind === "onHold"
						? `On hold · stopped ${entry.next ? `before ${code(entry.next)}` : ""} · last watched ${ago(entry.track.lastWatch)}`
						: entry.next
							? `${code(entry.next)} · ${entry.next.name} · last watched ${ago(entry.track.lastWatch)}`
							: ""
	return (
		<li className="flex items-center gap-3 rounded-lg bg-white/[0.04] p-2 ring-1 ring-white/5" data-row={show.key} data-kind={kind}>
			<img src={img(show.poster, "w92")} alt="" className="h-14 w-[38px] shrink-0 rounded object-cover" loading="lazy" />
			<span className="min-w-0 flex-1">
				<span className="block truncate text-sm font-bold text-white">{show.title}</span>
				<span className="block truncate text-xs text-gray-400">{line}</span>
			</span>
			{kind === "onHold" && (
				<button
					type="button"
					onClick={() => store.setStatus(show.key, "watching")}
					className="hidden h-10 shrink-0 cursor-pointer rounded-lg px-3 text-sm font-semibold text-gray-300 hover:bg-white/10 sm:block"
				>
					Back to Watching
				</button>
			)}
			<WatchedButton entry={entry} store={store} label="long" />
		</li>
	)
}

/** A group that starts closed: On hold, and in variant B the Watching shows not watched for a while. */
export function Collapsed({ title, count, children, open = false }: { title: string; count: number; children: ReactNode; open?: boolean }) {
	if (!count) return null
	return (
		<details className="group" open={open} data-group={title}>
			<summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg py-2 text-sm font-bold text-gray-300 hover:text-white [&::-webkit-details-marker]:hidden">
				<ChevronDownIcon className="h-4 w-4 -rotate-90 transition-transform group-open:rotate-0" aria-hidden />
				{title}
				<span className="rounded-full bg-white/10 px-2 py-0.5 text-xs tabular-nums text-gray-300">{count}</span>
			</summary>
			<div className="pb-2 pt-1">{children}</div>
		</details>
	)
}

export function Toast({ store }: { store: Store }) {
	const { toast } = store
	useEffect(() => {
		if (!toast) return
		const t = setTimeout(store.dismiss, toast.rate ? 12_000 : 6_000)
		return () => clearTimeout(t)
	}, [toast?.id])
	return (
		<AnimatePresence>
			{toast && (
				<motion.output
					key={toast.id}
					data-toast
					initial={{ opacity: 0, y: 16 }}
					animate={{ opacity: 1, y: 0 }}
					exit={{ opacity: 0, y: 16 }}
					className="fixed inset-x-3 bottom-56 z-[70] mx-auto flex max-w-xl flex-wrap items-center gap-x-3 gap-y-2 rounded-xl bg-gray-950/95 px-4 py-3 text-sm text-gray-100 shadow-2xl ring-1 ring-white/15 lg:bottom-24"
				>
					<span className="min-w-0 flex-1 basis-56">{toast.text}</span>
					{toast.rate && (
						// The one dismissible prompt to rate when a show is watched through; rating itself is out of scope here.
						<button type="button" onClick={store.dismiss} className="cursor-pointer rounded-lg bg-amber-400 px-3 py-1.5 font-bold text-black">
							Rate it
						</button>
					)}
					{toast.undo && (
						<button type="button" onClick={store.undo} className="cursor-pointer rounded-lg bg-white/10 px-3 py-1.5 font-bold text-white hover:bg-white/20">
							Undo
						</button>
					)}
					<button type="button" onClick={store.dismiss} className="cursor-pointer px-1 text-gray-400 hover:text-white" aria-label="Dismiss">
						×
					</button>
				</motion.output>
			)}
		</AnimatePresence>
	)
}

/** What a place in Watch next is called in one line. */
export const slotLine = (slot: Slot) => (slot.entry?.next ? `${slot.title.title} · ${code(slot.entry.next)}` : slot.title.title)

/**
 * Prototype chrome: what the header (desktop) and the dock (phone) would show as Tonight's pick under this variant.
 * Drawn like the real thumb (ui/navigation/bits.tsx), inside a dashed frame so it reads as a preview.
 */
export function TonightPreview({ store, variant }: { store: Store; variant: VariantKey }) {
	const pick = tonightsPick(store, variant)
	const ep = pick?.entry?.next
	return (
		<div className="flex items-center gap-2 rounded-xl border border-dashed border-fuchsia-400/70 bg-gray-950/90 py-1 pl-1 pr-3" data-tonight>
			{pick?.title.poster ? (
				<img src={img(pick.title.poster, "w92")} alt="" className="h-11 w-[30px] shrink-0 rounded-md object-cover ring-[1.5px] ring-amber-400/85" />
			) : (
				<span className="h-11 w-[30px] shrink-0 rounded-md bg-gray-800 ring-[1.5px] ring-amber-400/85" />
			)}
			<span className="flex min-w-0 flex-col leading-[1.15]">
				<small className="text-[11px] font-bold text-amber-400">{ep ? `Tonight · ${code(ep)}` : "Tonight"}</small>
				<b className="max-w-[118px] truncate text-[13.5px] text-gray-100">{pick?.title.title ?? "Watch next"}</b>
			</span>
		</div>
	)
}

/** Prototype chrome: the full state after every action. */
export function StatePanel({ store, variant }: { store: Store; variant: VariantKey }) {
	const { slots, quiet } = watchNextOf(store, variant)
	const pick = tonightsPick(store, variant)
	return (
		<div className="max-h-[60vh] w-[min(92vw,30rem)] overflow-auto rounded-xl bg-white p-3 text-xs text-black shadow-2xl ring-2 ring-fuchsia-500" data-state>
			<p>
				<b>Tonight's pick:</b> {pick ? slotLine(pick) : "none"}
			</p>
			<p className="mt-1">
				<b>Watch next ({slots.length}):</b> {slots.slice(0, 6).map(slotLine).join(" → ")}
				{slots.length > 6 ? " → …" : ""}
			</p>
			{quiet.length > 0 && (
				<p className="mt-1">
					<b>Watching, not for 30 days ({quiet.length}):</b> after the Wishlist
				</p>
			)}
			<p className="mt-1">
				<b>Wishlist ({store.wishlist.length}):</b> {store.wishlist.map((t) => t.title).join(", ")}
			</p>
			<table className="mt-2 w-full border-collapse text-left">
				<thead>
					<tr className="border-b border-black/20">
						<th className="py-1 pr-2">Show</th>
						<th className="pr-2">Stored</th>
						<th className="pr-2">Today</th>
						<th className="pr-2">Next episode</th>
						<th>Last watch</th>
					</tr>
				</thead>
				<tbody>
					{store.entries.map((e) => (
						<tr key={e.show.key} className="border-b border-black/10 align-top">
							<td className="py-1 pr-2 font-semibold">{e.show.title}</td>
							<td className="pr-2">{e.track.status}</td>
							<td className="pr-2">{e.kind}</td>
							<td className="pr-2">{e.next ? `${code(e.next)}${isNew(store.today, e.next) ? " (new)" : ""}` : e.upcoming ? waitLine(e) : "none"}</td>
							<td>{ago(e.track.lastWatch)}</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	)
}
