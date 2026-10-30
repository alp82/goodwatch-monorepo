// The inline reading stays small; its detailed popout loads only on intent.
import { lazy, Suspense, useEffect, useId, useRef, useState } from "react"
import type { ReadingChip } from "~/server/combined-search/reading-retrieval.server"
import { getFingerprintMeta } from "~/ui/fingerprint/fingerprintMeta"
import { fingerprintChipStyle } from "~/ui/title-card/ReasonChips"
import { reloadOnStaleChunk } from "~/utils/stale-chunk"
import { readAsChips } from "./ReadAsChips"

const importDetails = () => import("./ReadingDetails")
const Details = lazy(reloadOnStaleChunk(importDetails))

export function ReadingPill({ chip }: { chip: ReadingChip }) {
	const avoiding = chip.kind === "avoid" || chip.kind === "excluded"
	return (
		<span
			className={`rounded-full px-2 py-0.5 text-xs font-semibold leading-tight ${avoiding ? "bg-white/5 text-gray-300 line-through decoration-rose-400/80" : chip.kind === "want" && chip.key ? "" : "bg-sky-400/15 text-sky-100"}`}
			style={
				chip.kind === "want" && chip.key
					? fingerprintChipStyle(chip.key)
					: undefined
			}
		>
			{chip.key ? getFingerprintMeta(chip.key).label : chip.text}
		</span>
	)
}

export function ReadingPreview({ reading }: { reading: ReadingChip[] }) {
	const [open, setOpen] = useState(false)
	const panelId = useId()
	const suppressFocus = useRef(false)
	const pinned = useRef(false)
	const anchor = useRef<HTMLButtonElement>(null)
	const timer = useRef<ReturnType<typeof setTimeout>>()
	const visible = readAsChips(reading)
	const close = () => {
		if (open) suppressFocus.current = true
		clearTimeout(timer.current)
		pinned.current = false
		setOpen(false)
	}
	const enter = () => {
		clearTimeout(timer.current)
		void importDetails().catch(() => {})
		timer.current = setTimeout(() => setOpen(true), 160)
	}
	const leave = () => {
		clearTimeout(timer.current)
		if (!pinned.current) timer.current = setTimeout(() => setOpen(false), 160)
	}
	useEffect(() => () => clearTimeout(timer.current), [])
	useEffect(close, [reading])
	return (
		<span
			className="flex min-w-0"
			onPointerEnter={(event) => {
				if (event.pointerType === "mouse") enter()
			}}
			onPointerLeave={leave}
		>
			<button
				ref={anchor}
				type="button"
				aria-label={`Read as: ${reading.map((chip) => chip.text).join(", ")}. Show details`}
				aria-expanded={open}
				aria-controls={open ? panelId : undefined}
				aria-haspopup="dialog"
				onFocus={() => {
					if (suppressFocus.current) suppressFocus.current = false
					else enter()
				}}
				onBlur={leave}
				onClick={() => {
					clearTimeout(timer.current)
					if (pinned.current) close()
					else {
						pinned.current = true
						setOpen(true)
					}
				}}
				className="flex max-h-6 min-w-0 items-center gap-1 rounded-full cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
			>
				<span aria-hidden className="flex items-center gap-1 overflow-hidden">
					{visible.map((chip) => (
						<ReadingPill key={`${chip.kind}:${chip.text}`} chip={chip} />
					))}
				</span>
				{reading.length > visible.length && (
					<span className="pr-1 text-xs font-bold text-amber-200">
						+{reading.length - visible.length}
					</span>
				)}
			</button>
			{open && (
				<Suspense fallback={null}>
					<Details
						id={panelId}
						reading={reading}
						anchor={anchor}
						close={close}
						onEnter={() => clearTimeout(timer.current)}
						onLeave={leave}
					/>
				</Suspense>
			)}
		</span>
	)
}
