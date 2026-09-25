// Share lists on Taste. Signed-in people get a link to My lists (their profile). Guests have no profile: if they
// started a list, Taste shows that browser draft with an invitation to sign up to keep and share it.
import { ChevronRightIcon, QueueListIcon } from "@heroicons/react/20/solid"
import { Link } from "@remix-run/react"
import { useEffect, useState } from "react"
import { CardFonts, ScaledCard } from "~/ui/share-card/ScaledCard"
import { designByKey } from "~/ui/share-card/designs"
import { myListsPath, newListPath } from "~/ui/share-card/links"
import {
	DEFAULT_PROMPT_ID,
	LIST_PROMPTS,
	LIST_SIZE,
	THEMES,
	cardDate,
	GUEST_BYLINE,
} from "~/ui/share-card/model"
import { RESUME_SHARE_PATH } from "~/ui/share-list-editor/ShareFlow"
import { readBrowserDraft } from "~/ui/share-list-editor/autosave"
import type { ListDraft } from "~/ui/share-list-editor/list-state"

export function MyListsLink() {
	return (
		<Link
			to={myListsPath}
			className="group flex items-center gap-4 rounded-2xl bg-gray-900 p-4 ring-1 ring-white/5 transition hover:bg-gray-800 hover:ring-white/15"
		>
			<span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-sky-500/15 text-sky-300">
				<QueueListIcon className="size-6" aria-hidden />
			</span>
			<span className="min-w-0 flex-1">
				<span className="block font-bold text-gray-100">My lists</span>
				<span className="block text-sm text-gray-400">
					Your top 5 lists, and the links you shared.
				</span>
			</span>
			<ChevronRightIcon
				className="size-5 text-gray-500 transition group-hover:translate-x-0.5 group-hover:text-gray-300"
				aria-hidden
			/>
		</Link>
	)
}

/** The guest's browser draft, if they started a list. Renders nothing until it has read the browser. */
export function GuestDraftCard() {
	const [draft, setDraft] = useState<ListDraft | null>(null)
	useEffect(() => {
		const found = readBrowserDraft()
		if (found?.items.length) setDraft(found)
	}, [])
	if (!draft) return null

	const design = designByKey(draft.design)
	const theme = THEMES[draft.theme]
	const title =
		draft.title ||
		LIST_PROMPTS.find((p) => p.id === (draft.promptId ?? DEFAULT_PROMPT_ID))
			?.title ||
		"My top 5"
	const missing = LIST_SIZE - draft.items.length
	return (
		<section className="mx-auto mt-4 flex max-w-4xl items-center gap-4 rounded-2xl bg-gray-900/90 p-3 pr-4 ring-1 ring-white/10 sm:gap-5">
			<CardFonts />
			<Link
				to={newListPath()}
				className="h-28 w-20 shrink-0 sm:h-32 sm:w-24"
				aria-label={`Continue ${title}`}
			>
				<div className="pointer-events-none h-full">
					<ScaledCard
						design={design}
						card={{
							title,
							items: draft.items,
							name: GUEST_BYLINE,
							theme: draft.theme,
							date: cardDate(new Date()),
						}}
						fill
						className="rounded-md shadow-lg shadow-black/50"
					/>
				</div>
			</Link>
			<div className="min-w-0 flex-1">
				<p className="text-xs font-bold tracking-widest text-gray-400 uppercase">
					Your draft
				</p>
				<p className="truncate font-bold text-gray-100">{title}</p>
				<p className="text-sm text-gray-400">
					{missing > 0
						? `Add ${missing} more ${missing === 1 ? "title" : "titles"}, then sign up to keep and share it.`
						: "It's saved in this browser only. Sign up to keep it and share it."}
				</p>
				<div className="mt-2 flex flex-wrap gap-2">
					<Link
						to={newListPath()}
						className="rounded-full bg-white/10 px-3.5 py-1.5 text-sm font-bold text-gray-100 hover:bg-white/15"
					>
						Continue editing
					</Link>
					<Link
						to={`/sign-up?redirectTo=${encodeURIComponent(missing > 0 ? newListPath() : RESUME_SHARE_PATH)}`}
						className="rounded-full px-3.5 py-1.5 text-sm font-black text-black hover:brightness-110"
						style={{
							backgroundImage: `linear-gradient(90deg, ${theme.accent}, ${theme.accent2})`,
						}}
					>
						Sign up to share
					</Link>
				</div>
			</div>
		</section>
	)
}
