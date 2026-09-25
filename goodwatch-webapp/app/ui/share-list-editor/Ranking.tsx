// The ranking on the back of the card: five rows that reorder by drag and drop. While a title is dragged over the
// list, a gap opens where it will land, and in a full list the row that will drop off is marked.
import type { PointerEvent } from "react"
import { type CardTitle, LIST_SIZE } from "~/ui/share-card/model"
import { Thumb, titleMeta } from "~/ui/share-list-editor/parts"
import type { Editor } from "~/ui/share-list-editor/useEditor"

function DropGap({ item, accent }: { item?: CardTitle; accent: string }) {
	return (
		<div
			className="flex items-center gap-2 rounded-lg border-2 border-dashed p-1.5"
			style={{ borderColor: accent }}
		>
			<span className="w-5" />
			{item && <Thumb item={item} className="w-7 rounded opacity-60" />}
			<span
				className="truncate text-sm font-semibold"
				style={{ color: accent }}
			>
				{item?.title}
			</span>
		</div>
	)
}

export function Ranking({ ed }: { ed: Editor }) {
	const { list, dnd, colors } = ed
	const drag = dnd.drag
	const dragKey = drag?.payload.item.key
	const overIndex = drag?.over?.kind === "list" ? drag.over.index : null
	const rows = list.items.filter((i) => i.key !== dragKey)
	const dropsOff =
		drag &&
		!list.has(drag.payload.item.key) &&
		overIndex != null &&
		list.items.length >= LIST_SIZE
			? list.items[list.items.length - 1]?.key
			: null
	const gap = <DropGap item={drag?.payload.item} accent={colors.accent} />

	return (
		<ol
			data-droplist
			className={`flex flex-col gap-1.5 rounded-2xl transition ${overIndex != null ? "bg-white/[0.04] ring-1 ring-white/10" : ""}`}
		>
			{list.items.map((item, rank) => {
				// The dragged row stays mounted but hidden: removing it would strand touch events.
				const lifted = item.key === dragKey
				const i = rows.indexOf(item)
				const shownRank = i + 1 + (overIndex != null && overIndex <= i ? 1 : 0)
				const grab = (e: PointerEvent) => {
					if ((e.target as HTMLElement).closest("button")) return
					dnd.start(e, { item, from: rank })
				}
				return (
					<li
						key={item.key}
						className={`flex flex-col gap-1.5 ${lifted ? "hidden" : ""}`}
					>
						{!lifted && overIndex === i && gap}
						<div
							data-row={lifted ? undefined : ""}
							onPointerDown={grab}
							className={`flex cursor-grab touch-pan-y items-center gap-2 rounded-lg bg-white/5 p-1.5 pr-2 select-none active:cursor-grabbing ${dropsOff === item.key ? "opacity-35" : ""}`}
						>
							<span
								className="w-5 text-center text-sm font-black"
								style={{ color: colors.accent }}
							>
								{shownRank}
							</span>
							<Thumb item={item} className="w-7 rounded" />
							<div className="min-w-0 flex-1">
								<div className="truncate text-sm font-bold">{item.title}</div>
								{dropsOff === item.key && (
									<div className="text-xs text-neutral-400">
										Drops off the list
									</div>
								)}
							</div>
							<span className="sr-only">{titleMeta(item)}</span>
							<button
								type="button"
								aria-label={`Remove ${item.title}`}
								onClick={() => list.remove(item.key)}
								className="rounded-md px-1.5 py-0.5 text-neutral-500 hover:bg-white/10 hover:text-white"
							>
								✕
							</button>
						</div>
					</li>
				)
			})}
			{overIndex != null && overIndex >= rows.length && gap}
			{!drag && list.items.length < LIST_SIZE && (
				<li className="flex items-center justify-center gap-3 rounded-lg border border-dashed border-white/15 p-2 text-xs text-neutral-500">
					Drop a title here · {LIST_SIZE - list.items.length} left
				</li>
			)}
		</ol>
	)
}
