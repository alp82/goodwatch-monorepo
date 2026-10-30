// The share list editor. The card is the centerpiece; Edit flips it to one panel with the title, ranking, and titles
// to add. The card is signed with the owner's @handle (byline). A single toolbar holds Lists (back to the lists),
// Edit, the design and color pickers, the save status, and Share: one row at 1024 px and wider, two rows below (Lists,
// Edit and Share, then the pickers). The toolbar has the page width of the profile header and tab row; the page keeps
// the site's background.
import { ChevronLeftIcon, PencilSquareIcon } from "@heroicons/react/24/outline"
import { Link } from "@remix-run/react"
import { type CSSProperties, useState } from "react"
import { CardFonts } from "~/ui/share-card/ScaledCard"
import type { CardTitle } from "~/ui/share-card/model"
import {
	CardPreview,
	CardPreviewStyles,
} from "~/ui/share-list-editor/CardPreview"
import { EditorDialogs } from "~/ui/share-list-editor/Dialogs"
import { DesignPicker, ThemePicker } from "~/ui/share-list-editor/Pickers"
import { Ranking } from "~/ui/share-list-editor/Ranking"
import { TitleGrid } from "~/ui/share-list-editor/TitleGrid"
import {
	type SaveStatus,
	type SaveTarget,
	isComplete,
	useAutosave,
} from "~/ui/share-list-editor/autosave"
import type { ListDraft } from "~/ui/share-list-editor/list-state"
import {
	DragGhost,
	PromptLinks,
	TitleInput,
	sectionLabel,
} from "~/ui/share-list-editor/parts"
import { type Editor, useEditor } from "~/ui/share-list-editor/useEditor"

/**
 * What Share does: returns the link to copy, or null when it handled the click another way (for example by asking
 * a guest to sign up). Without it, Share is disabled.
 */
export type ShareAction = (draft: ListDraft) => Promise<string | null>

/** The page width, as the profile header and the tab row (ui/my-pages/bits.tsx). */
const WRAP = "mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8"

/**
 * The Profile tab row's height, as a CSS variable for the offsets under the sticky rows (the h-16 header, the visitor
 * bar's --visitor-bar-h, then this row). The values are TAB_ROW_PX.one in ui/navigation/AreaTabs.tsx, written out
 * because Tailwind only sees literal class names.
 */
export const TAB_ROW_H = "[--tab-row-h:45px] lg:[--tab-row-h:49px]"

/** The toolbar's Lists key: back to the lists. */
export function BackToLists({ href }: { href: string }) {
	return (
		<Link
			to={href}
			prefetch="intent"
			className="flex shrink-0 items-center gap-1 rounded-full bg-white/10 py-2.5 pr-4 pl-3 font-bold text-white transition hover:bg-white/15"
		>
			<ChevronLeftIcon className="size-5" aria-hidden />
			Lists
		</Link>
	)
}

// The card never gets narrower than this ratio, so the back panel has room on square and wide cards.
const MIN_BOX_RATIO = 0.62

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
			disabled={!share || !isComplete(ed.list.draft)}
			onClick={onClick}
			title={
				!share
					? "Save the list to share it."
					: isComplete(ed.list.draft)
						? "Copies a link. The card is its preview image."
						: "Add 5 titles to share the list."
			}
			className="w-32 rounded-full py-2.5 sm:w-40 text-center text-base font-black whitespace-nowrap text-black transition hover:brightness-110 disabled:opacity-40"
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
	byline,
	saveTarget,
	share,
	back,
}: {
	initial: ListDraft
	quickPicks: Record<string, CardTitle[]>
	date: string
	byline: string
	saveTarget: SaveTarget
	share?: ShareAction
	/** Where the Lists key goes. Without it (guests), the toolbar starts with Edit. */
	back?: string | null
}) {
	const ed = useEditor({ initial, quickPicks, date, byline })
	const status = useAutosave(ed.list, saveTarget)
	const [flipped, setFlipped] = useState(false)
	const [opened, setOpened] = useState(false)
	const ratio = Math.max(ed.shown.design.w / ed.shown.design.h, MIN_BOX_RATIO)

	return (
		<div className="relative flex h-[calc(100dvh-4rem)] flex-col overflow-hidden text-white max-lg:h-[calc(100dvh-8rem)]">
			<CardFonts />
			<CardPreviewStyles ed={ed} />

			<div
				data-list-toolbar
				className={`${WRAP} relative z-10 flex flex-wrap items-center gap-x-3 gap-y-3 pt-4 lg:gap-x-4`}
			>
				<div className="order-1 flex items-center gap-3">
					{back && <BackToLists href={back} />}
					<button
						type="button"
						onClick={() => {
							setOpened(true)
							setFlipped(!flipped)
						}}
						className="flex w-24 items-center justify-center gap-2 rounded-full bg-white py-2.5 font-black text-black transition hover:bg-neutral-200 sm:w-28"
					>
						{flipped ? (
							"Done"
						) : (
							<>
								<PencilSquareIcon className="size-5" /> Edit
							</>
						)}
					</button>
				</div>
				<div className="order-3 flex w-full items-center justify-center gap-3 lg:order-2 lg:w-auto lg:flex-1">
					<DesignPicker ed={ed} />
					<ThemePicker ed={ed} />
				</div>
				<div className="order-2 ml-auto flex items-center gap-3 lg:order-3 lg:ml-0">
					<span
						className="w-36 text-right text-xs whitespace-nowrap text-gray-500 max-sm:hidden"
						aria-live="polite"
					>
						{SAVE_LABELS[status]}
					</span>
					<ShareButton ed={ed} share={share} />
				</div>
			</div>

			<div className="relative flex min-h-0 flex-1 items-center justify-center px-4 pt-4 pb-4 [perspective:2200px] [container-type:size]">
				<div
					className="share-editor-fit relative transition-transform duration-700 [transform-style:preserve-3d]"
					style={
						{
							"--editor-ratio": ratio,
							transform: flipped ? "rotateY(180deg)" : "none",
						} as CSSProperties
					}
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
						style={{ display: opened ? undefined : "none" }}
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
