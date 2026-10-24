// The IMDb import, from Bring to Done. Without an import open it is the Bring step: the upload, then how to get the
// file. A ratings file opens its import (ImdbImportCurrent); a Watchlist or custom list file is a general import
// (SourceImportCurrent). A running import is opened on arrival, so its progress shows directly.
import { useEffect, useState } from "react"
import type {
	ImdbFileSummary,
	ImdbImportListResponse,
} from "~/domain/imdb-import"
import type { ImportSummary } from "~/domain/imports"
import { ImdbExportSteps } from "./ImdbExportSteps"
import { ImdbImportCurrent } from "./ImdbImportCurrent"
import { ImdbUpload } from "./ImdbUpload"
import type { ImportHandoff } from "./ImportFileRouting"
import { useReportStep } from "./ImportFlowParts"
import { SourceImportCurrent } from "./SourceImportCurrent"
import { useSourceImports } from "./SourceImportHooks"
import { useImdbImports } from "./api"

export function ImdbImportFlow({
	initial,
	handoff,
	initialId,
	initialLists = [],
}: {
	initial?: ImdbImportListResponse
	initialLists?: ImportSummary[]
	/** A recognized IMDb file: the upload opens and asks list intent when needed. */
	handoff?: ImportHandoff
	/** An import to open on arrival, chosen in the page's history. */
	initialId?: string
}) {
	const list = useImdbImports(initial)
	const native = useSourceImports({ imports: initialLists })
	const [newListId, setNewListId] = useState<string | null>(null)
	const lists = (native.data?.imports ?? []).filter(
		(item) => item.source === "imdb_list",
	)
	const [openId, setOpenId] = useState<string | null>(initialId ?? null)
	const [bring, setBring] = useState(!!handoff)
	// Once the member has done something here, a step that appears takes focus. Not on arrival.
	const [acted, setActed] = useState(!!handoff)
	// Used once: going back to the upload later doesn't send it again.
	const [pending, setPending] = useState(handoff)

	// A preview is not an import yet, so it has no place in the history.
	const latest: ImdbFileSummary | undefined = [
		...(list.data?.imports ?? []),
		...lists,
	]
		.filter((item) => item.status !== "preview")
		.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
	const shownId =
		openId ?? (!bring && latest?.status === "running" ? latest.id : null)
	// Keep a running import open once it finishes, so its Done step follows its progress.
	useEffect(() => {
		if (!openId && shownId) setOpenId(shownId)
	}, [openId, shownId])

	const open = (id: string) => {
		setActed(true)
		setPending(undefined)
		setBring(false)
		setOpenId(id)
	}
	const openUpload = () => {
		setNewListId(null)
		setActed(true)
		setPending(undefined)
		setOpenId(null)
		setBring(true)
	}

	if (shownId)
		return newListId === shownId ||
			lists.some((item) => item.id === shownId) ? (
			<SourceImportCurrent
				key={shownId}
				id={shownId}
				focus={acted}
				onUploadAnother={openUpload}
			/>
		) : (
			<ImdbImportCurrent
				key={shownId}
				id={shownId}
				focus={acted}
				onUploadAnother={openUpload}
			/>
		)
	return (
		<Bring
			handoff={pending}
			focusSteps={acted && bring}
			onPreview={(summary) => {
				if ("source" in summary) setNewListId(summary.id)
				open(summary.id)
			}}
		/>
	)
}

function Bring({
	handoff,
	focusSteps,
	onPreview,
}: {
	handoff?: ImportHandoff
	focusSteps: boolean
	onPreview: (summary: ImdbFileSummary) => void
}) {
	useReportStep({ step: 1, notes: ["IMDb", "", "", ""], allDone: false })
	return (
		<div className="flex flex-col gap-6">
			<ImdbUpload onPreview={onPreview} handoff={handoff} />
			<ImdbExportSteps focus={focusSteps} />
		</div>
	)
}
