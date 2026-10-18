// Every import source as a row of overlapping marks. Hover, focus, or a tap opens a pop-out under the row with the
// source's name, how it comes in, how long it takes, and what GoodWatch takes from it. The pop-out sits under the
// whole row, with a pointer at its mark, so it never runs off a phone's screen.
import { Link } from "@remix-run/react"
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react"
import {
	IMPORT_SOURCE_LIST,
	type ImportSourceEntry,
	type ImportSourceId,
} from "~/ui/imports/ImportSources"
import { SourceMark } from "~/ui/imports/SourceMark"
import { primaryButton, secondaryButton } from "~/ui/imports/shared"
import { assetUrl } from "~/utils/asset-url"
import { WaitChip, connectPath } from "./StartImport"

function Mark({ source }: { source: ImportSourceEntry }) {
	const frame =
		"flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl sm:size-12 sm:rounded-2xl md:size-14"
	if (!source.logo)
		return (
			<span
				aria-hidden
				className={`${frame} bg-zinc-600 text-sm font-black tracking-tight text-white`}
			>
				{source.tile}
			</span>
		)
	return (
		<span
			aria-hidden
			className={`${frame} ${source.id === "tmdb" ? "bg-[#0d253f] p-1.5" : ""}`}
		>
			<img
				src={assetUrl(source.logo)}
				alt=""
				className="size-full object-contain"
			/>
		</span>
	)
}

export function SourceLogoRow({
	onPick,
	connectTo = connectPath,
	prompt = "Need the file? Pick where it lives",
}: {
	onPick: (id: ImportSourceId) => void
	/** Where an account source's Connect goes: the Imports page by default. */
	connectTo?: (id: ImportSourceId) => string
	prompt?: string
}) {
	const [hot, setHot] = useState<ImportSourceId | null>(null)
	const [pinned, setPinned] = useState(false)
	const row = useRef<HTMLDivElement>(null)
	const pop = useRef<HTMLDivElement>(null)
	const pointer = useRef<HTMLSpanElement>(null)
	const markX = useRef(0)
	const popId = useId()

	const show = (id: ImportSourceId, el: HTMLElement) => {
		const box = el.getBoundingClientRect()
		markX.current = box.left + box.width / 2
		setHot(id)
	}
	const close = () => {
		setPinned(false)
		setHot(null)
	}
	// The pointer sits under the shown mark, measured against where the pop-out landed.
	useLayoutEffect(() => {
		if (!hot || !pop.current || !pointer.current) return
		pointer.current.style.left = `${markX.current - pop.current.getBoundingClientRect().left - 6}px`
	}, [hot])
	// A press outside the row, or Escape, closes a pinned pop-out.
	useEffect(() => {
		if (!hot) return
		const outside = (e: PointerEvent) => {
			if (!row.current?.contains(e.target as Node)) close()
		}
		const onKey = (e: KeyboardEvent) => e.key === "Escape" && close()
		window.addEventListener("pointerdown", outside)
		window.addEventListener("keydown", onKey)
		return () => {
			window.removeEventListener("pointerdown", outside)
			window.removeEventListener("keydown", onKey)
		}
	}, [hot])

	const source = IMPORT_SOURCE_LIST.find((s) => s.id === hot)
	return (
		<div
			ref={row}
			className="relative mx-auto flex w-full max-w-xl flex-col items-center"
			onMouseLeave={() => !pinned && setHot(null)}
		>
			<p className="text-sm text-gray-400">
				{prompt}
			</p>
			<ul className="mt-3 flex items-center justify-center pl-2.5 sm:pl-3">
				{IMPORT_SOURCE_LIST.map((s, i) => (
					<li
						key={s.id}
						className="-ml-2.5 sm:-ml-3"
						style={{ zIndex: hot === s.id ? 20 : 10 - Math.abs(i - 4) }}
					>
						<button
							type="button"
							aria-label={s.name}
							aria-expanded={hot === s.id}
							aria-controls={hot === s.id ? popId : undefined}
							onMouseEnter={(e) => !pinned && show(s.id, e.currentTarget)}
							onFocus={(e) => show(s.id, e.currentTarget)}
							onClick={(e) => {
								if (hot === s.id && pinned) return close()
								show(s.id, e.currentTarget)
								setPinned(true)
							}}
							className={`block cursor-pointer rounded-2xl ring-4 ring-gray-950 transition-[transform,opacity] duration-200 ease-out ${hot === s.id ? "-translate-y-1.5 scale-110" : "hover:-translate-y-1"} ${hot && hot !== s.id ? "opacity-60" : ""}`}
						>
							<Mark source={s} />
						</button>
					</li>
				))}
			</ul>
			<div className="relative h-0 w-full">
				{source && (
					<section
						ref={pop}
						id={popId}
						aria-label={source.name}
						className="absolute inset-x-0 top-3 z-30 mx-auto w-full max-w-sm rounded-2xl bg-gray-900 p-4 text-left shadow-2xl ring-1 ring-white/10"
					>
						<span
							ref={pointer}
							aria-hidden
							className="absolute -top-1.5 size-3 rotate-45 border-l border-t border-white/10 bg-gray-900"
						/>
						<div className="flex items-center gap-3">
							<SourceMark source={source} />
							<div className="min-w-0 flex-1">
								<div className="font-bold text-white">{source.name}</div>
								<div className="text-xs text-gray-400">
									{source.connect
										? "Connect your account"
										: "Upload an export file"}
								</div>
							</div>
							<WaitChip source={source} />
						</div>
						<ul
							className="mt-3 flex flex-wrap gap-1.5"
							aria-label="What GoodWatch imports"
						>
							{source.gets.map((g) => (
								<li
									key={g}
									className="rounded-full bg-slate-800 px-2.5 py-1 text-xs font-semibold text-gray-200"
								>
									{g}
								</li>
							))}
						</ul>
						{source.connect ? (
							<Link
								to={connectTo(source.id)}
								className={`${primaryButton} mt-4 w-full`}
							>
								Connect {source.name}
							</Link>
						) : (
							<button
								type="button"
								className={`${secondaryButton} mt-4 w-full`}
								onClick={() => {
									close()
									onPick(source.id)
								}}
							>
								How to get your {source.name} file
							</button>
						)}
					</section>
				)}
			</div>
		</div>
	)
}
