import {
	type RefObject,
	useEffect,
	useId,
	useLayoutEffect,
	useRef,
	useState,
} from "react"
import { createPortal } from "react-dom"
import type { ReadingChip } from "~/server/combined-search/reading-retrieval.server"
import { getFingerprintMeta } from "~/ui/fingerprint/fingerprintMeta"
import { ReadingPill } from "./ReadingPreview"

const ROLE = {
	want: "Prefer",
	avoid: "Prefer less",
	attribute: "Required",
	excluded: "Excluded",
	phrase: "Text match",
}
export function readingDetail(chip: ReadingChip) {
	const description =
		chip.description ||
		(chip.key ? getFingerprintMeta(chip.key).description : undefined)
	if (chip.kind === "phrase")
		return {
			role: ROLE.phrase,
			description: "Looks for this phrase in title descriptions.",
		}
	return {
		role: chip.filters === false ? "Prefer" : ROLE[chip.kind],
		description:
			description ||
			(chip.kind === "excluded"
				? "Titles with this attribute are excluded from the search."
				: "The search interpreted this as an attribute to look for."),
	}
}

export default function ReadingDetails({
	id,
	reading,
	anchor,
	close,
	onEnter,
	onLeave,
}: {
	id: string
	reading: ReadingChip[]
	anchor: RefObject<HTMLButtonElement>
	close: () => void
	onEnter: () => void
	onLeave: () => void
}) {
	const panel = useRef<HTMLDivElement>(null)
	const heading = useId()
	const [position, setPosition] = useState({ top: 0, left: 0, maxHeight: 400 })
	useLayoutEffect(() => {
		const place = () => {
			const rect = anchor.current?.getBoundingClientRect()
			if (!rect) return
			const below = window.innerHeight - rect.bottom - 24
			const height = Math.min(
				panel.current?.scrollHeight ?? 400,
				window.innerHeight - 32,
			)
			const above = below < Math.min(height, 240) && rect.top > below
			setPosition({
				left: Math.max(
					16,
					Math.min(
						rect.left,
						window.innerWidth - (panel.current?.offsetWidth ?? 360) - 16,
					),
				),
				top: above ? Math.max(16, rect.top - height - 8) : rect.bottom + 8,
				maxHeight: above ? rect.top - 24 : below,
			})
		}
		place()
		window.addEventListener("resize", place)
		window.addEventListener("scroll", place, true)
		return () => {
			window.removeEventListener("resize", place)
			window.removeEventListener("scroll", place, true)
		}
	}, [anchor])
	useEffect(() => {
		const outside = (event: PointerEvent) => {
			if (
				!panel.current?.contains(event.target as Node) &&
				!anchor.current?.contains(event.target as Node)
			)
				close()
		}
		const escape = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				event.stopPropagation()
				close()
				anchor.current?.focus({ preventScroll: true })
			}
		}
		document.addEventListener("pointerdown", outside)
		document.addEventListener("keydown", escape)
		return () => {
			document.removeEventListener("pointerdown", outside)
			document.removeEventListener("keydown", escape)
		}
	}, [anchor, close])
	return createPortal(
		<div
			ref={panel}
			id={id}
			role="dialog"
			aria-labelledby={heading}
			onPointerEnter={onEnter}
			onPointerLeave={onLeave}
			onFocus={onEnter}
			onBlur={(event) => {
				if (!event.currentTarget.contains(event.relatedTarget as Node))
					onLeave()
			}}
			style={position}
			className="search-private ph-no-capture sentry-mask fixed z-[100] w-max max-w-[calc(100vw-32px)] overflow-auto rounded-2xl bg-gray-900 p-4 text-sm text-gray-300 shadow-[0_18px_60px_-12px_rgba(0,0,0,.9)] ring-1 ring-white/15"
		>
			<h3 id={heading} className="font-bold text-white">
				How your search was read
			</h3>
			<ul className="mt-2 grid grid-cols-[max-content_max-content_max-content] gap-x-4 text-xs">
				{[
					...reading.filter((chip) => chip.kind === "phrase"),
					...reading.filter((chip) => chip.kind !== "phrase"),
				].map((chip) => {
					const detail = readingDetail(chip)
					return (
						<li
							key={`${chip.kind}:${chip.text}`}
							className="col-span-3 grid grid-cols-subgrid items-center border-b border-white/[0.08] py-2.5 last:border-0 last:pb-0"
						>
							<span className="justify-self-start whitespace-nowrap">
								<ReadingPill chip={chip} />
							</span>
							<span className="whitespace-nowrap text-[11px] text-gray-400">
								{detail.role}
							</span>
							<span className="whitespace-nowrap text-gray-300">
								{detail.description}
							</span>
						</li>
					)
				})}
			</ul>
		</div>,
		document.body,
	)
}
