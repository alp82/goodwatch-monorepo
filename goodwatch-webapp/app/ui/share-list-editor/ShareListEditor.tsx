// The share list editor. The card is the centerpiece; Edit flips it to one panel with the title, signature, ranking,
// and titles to add. A single toolbar holds Edit, the design and color pickers, the save status, and Share: one row at
// 1024 px and wider, two rows below (Edit and Share, then the pickers).
import { PencilSquareIcon } from "@heroicons/react/24/outline"
import { useRef, useState } from "react"
import type { CardTitle } from "~/ui/share-card/model"
import {
	CardFonts,
	useIsomorphicLayoutEffect,
} from "~/ui/share-card/ScaledCard"
import {
	type SaveStatus,
	type SaveTarget,
	useAutosave,
} from "~/ui/share-list-editor/autosave"
import {
	CardPreview,
	CardPreviewStyles,
} from "~/ui/share-list-editor/CardPreview"
import { EditorDialogs } from "~/ui/share-list-editor/Dialogs"
import type { ListDraft } from "~/ui/share-list-editor/list-state"
import {
	DragGhost,
	PromptLinks,
	SignatureInput,
	TitleInput,
	sectionLabel,
} from "~/ui/share-list-editor/parts"
import { DesignPicker, ThemePicker } from "~/ui/share-list-editor/Pickers"
import { Ranking } from "~/ui/share-list-editor/Ranking"
import { TitleGrid } from "~/ui/share-list-editor/TitleGrid"
import { type Editor, useEditor } from "~/ui/share-list-editor/useEditor"

/**
 * What Share does: returns the link to copy, or null when it handled the click another way (for example by asking
 * a guest to sign up). Without it, Share is disabled.
 */
export type ShareAction = (draft: ListDraft) => Promise<string | null>

// The card never gets narrower than this ratio, so the back panel has room on square and wide cards.
const MIN_BOX_RATIO = 0.62

// Fits a box of the given ratio into the element.
function useFit(ratio: number) {
	const ref = useRef<HTMLDivElement>(null)
	const [size, setSize] = useState({ w: 0, h: 0 })
	useIsomorphicLayoutEffect(() => {
		const el = ref.current
		if (!el) return
		const observer = new ResizeObserver(([entry]) => {
			const { width, height } = entry.contentRect
			const w = Math.min(width, height * ratio)
			setSize({ w, h: w / ratio })
		})
		observer.observe(el)
		return () => observer.disconnect()
	}, [ratio])
	return { ref, size }
}

const SAVE_LABELS: Record<SaveStatus, string> = {
	idle: "",
	saving: "Saving…",
	saved: "✓ Saved",
	incomplete: "Add 5 titles to save",
	failed: "Not saved",
}

function ShareButton({ ed, share }: { ed: Editor; share?: ShareAction }) {
	const [state, setState] = useState<"idle" | "copied">("idle")
	const onClick = async () => {
		if (!share) return
		const url = await share(ed.list.draft)
		if (!url) return
		try {
			await navigator.clipboard.writeText(url)
			setState("copied")
			setTimeout(() => setState("idle"), 2000)
		} catch {
			window.prompt("Copy this link", url)
		}
	}
	return (
		<button
			type="button"
			disabled={!share || ed.list.items.length === 0}
			onClick={onClick}
			title={
				share
					? "Copies a link. The card is its preview image."
					: "Save the list to share it."
			}
			className="w-40 rounded-full py-2.5 text-center text-base font-black whitespace-nowrap text-black transition hover:brightness-110 disabled:opacity-40"
			style={{
				backgroundImage: `linear-gradient(90deg, ${ed.colors.accent}, ${ed.colors.accent2})`,
			}}
		>
			{state === "copied" ? "Link copied ✓" : "Share"}
		</button>
	)
}

export function ShareListEditor({
	initial,
	quickPicks,
	date,
	saveTarget,
	share,
}: {
	initial: ListDraft
	quickPicks: Record<string, CardTitle[]>
	date: string
	saveTarget: SaveTarget
	share?: ShareAction
}) {
	const ed = useEditor({ initial, quickPicks, date })
	const status = useAutosave(ed.list, saveTarget)
	const [flipped, setFlipped] = useState(false)
	const { ref, size } = useFit(
		Math.max(ed.shown.design.w / ed.shown.design.h, MIN_BOX_RATIO),
	)

	return (
		<div className="relative flex h-[calc(100dvh-4rem)] flex-col overflow-hidden bg-neutral-950 text-white max-lg:h-[calc(100dvh-8rem)]">
			<CardFonts />
			<CardPreviewStyles ed={ed} />
			<div
				className="pointer-events-none absolute inset-0 opacity-40 transition-colors duration-700"
				style={{
					backgroundImage: `radial-gradient(ellipse at 50% 35%, ${ed.shown.colors.accent}33 0%, transparent 60%)`,
				}}
			/>

			<div className="relative z-10 flex flex-wrap items-center gap-x-4 gap-y-3 px-4 pt-4">
				<button
					type="button"
					onClick={() => setFlipped(!flipped)}
					className="order-1 flex w-28 items-center justify-center gap-2 rounded-full bg-white py-2.5 font-black text-black transition hover:bg-neutral-200"
				>
					{flipped ? (
						"Done"
					) : (
						<>
							<PencilSquareIcon className="size-5" /> Edit
						</>
					)}
				</button>
				<div className="order-3 flex w-full items-center justify-center gap-3 lg:order-2 lg:w-auto lg:flex-1">
					<DesignPicker ed={ed} />
					<ThemePicker ed={ed} />
				</div>
				<div className="order-2 ml-auto flex items-center gap-3 lg:order-3 lg:ml-0">
					<span
						className="w-36 text-right text-xs whitespace-nowrap text-neutral-500 max-sm:hidden"
						aria-live="polite"
					>
						{SAVE_LABELS[status]}
					</span>
					<ShareButton ed={ed} share={share} />
				</div>
			</div>

			<div
				ref={ref}
				className="relative flex min-h-0 flex-1 items-center justify-center px-4 pt-4 pb-4 [perspective:2200px]"
			>
				<div
					className="relative transition-transform duration-700 [transform-style:preserve-3d]"
					style={{
						width: size.w,
						height: size.h,
						transform: flipped ? "rotateY(180deg)" : "none",
					}}
				>
					<div
						className="absolute inset-0 [backface-visibility:hidden]"
						aria-hidden={flipped}
						{...({ inert: flipped ? "" : undefined } as object)}
					>
						<CardPreview ed={ed} />
					</div>
					<div
						data-drag-scroll
						className="absolute inset-0 flex flex-col gap-5 overflow-y-auto rounded-[18px] bg-neutral-900 p-4 ring-1 ring-white/10 [backface-visibility:hidden] [transform:rotateY(180deg)]"
						aria-hidden={!flipped}
						// React 18 doesn't know `inert`; as a string attribute it reaches the DOM and keeps the hidden side out of tab order.
						{...({ inert: flipped ? undefined : "" } as object)}
					>
						<div className="flex shrink-0 flex-col gap-2">
							<div className={sectionLabel}>Title</div>
							<TitleInput
								ed={ed}
								className="rounded-2xl bg-white/10 px-4 py-2.5 text-lg"
							/>
							<PromptLinks ed={ed} />
						</div>
						<div className="flex shrink-0 flex-col gap-2">
							<div className={sectionLabel}>Signed</div>
							<SignatureInput ed={ed} />
						</div>
						<div className="flex shrink-0 flex-col gap-2">
							<div className={sectionLabel}>Ranking</div>
							<Ranking ed={ed} />
						</div>
						<div className="flex min-h-72 flex-1 flex-col gap-2">
							<div className={sectionLabel}>Add titles</div>
							<TitleGrid ed={ed} />
						</div>
					</div>
				</div>
			</div>

			<DragGhost ed={ed} />
			<EditorDialogs ed={ed} />
		</div>
	)
}
