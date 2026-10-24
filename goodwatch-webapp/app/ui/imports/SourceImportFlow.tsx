// One source's import, from Bring to Done. Without an import open it is the Bring step: the source's upload or its
// connection. A file, a connection, or a past import opens that import (SourceImportCurrent). A running import, and
// TV Time's preview that is still matching, open on arrival.
import { useEffect, useState } from "react"
import {
	type ImportSource,
	type ImportSummary,
	isFileImportSource,
} from "~/domain/imports"
import type { ImportHandoff } from "./ImportFileRouting"
import { useReportStep } from "./ImportFlowParts"
import { MdblistConnectPanel } from "./MdblistConnectPanel"
import { PlexConnectPanel } from "./PlexConnectPanel"
import { SourceImportCurrent } from "./SourceImportCurrent"
import { type ImportListResponse, useSourceImports } from "./SourceImportHooks"
import type {
	PreviewUpdate,
	SourceImportChoices,
} from "./SourceImportPreviewModel"
import { SourceImportUploadPanel } from "./SourceImportUploadPanel"
import { TmdbConnectPanel } from "./TmdbConnectPanel"
import { sourceName } from "./import-flow-model"

export function SourceImportFlow({
	source,
	initial,
	connectState,
	initialId,
	handoff,
}: {
	source: ImportSource
	initial: ImportListResponse
	connectState?: string
	initialId?: string
	/** A file the page recognized as this source's: the upload opens and sends it. */
	handoff?: ImportHandoff
}) {
	const query = useSourceImports(initial)
	const imports = query.data?.imports ?? []
	const latest = imports.find(
		(item) => item.source === source && item.status !== "preview",
	)
	const resumable =
		source === "tvtime" && !handoff
			? imports.find(
					(item) => item.source === source && item.status === "preview",
				)
			: undefined
	const [openId, setOpenId] = useState<string | null>(
		initialId ?? resumable?.id ?? null,
	)
	const [bring, setBring] = useState(!!handoff)
	// A handed-off file is the member's act, so its preview takes focus when it opens.
	const [acted, setActed] = useState(!!handoff)
	// Used once: going back to the upload later doesn't send it again.
	const [pending, setPending] = useState(handoff)
	// A preview the member updated with their matches, or ran again. The earlier preview isn't deleted, only left.
	const [replaced, setReplaced] = useState<
		(PreviewUpdate & { id: string }) | null
	>(null)
	const [choices, setChoices] = useState<SourceImportChoices>()
	const shownId =
		openId ?? (!bring && latest?.status === "running" ? latest.id : null)
	useEffect(() => {
		if (!openId && shownId) setOpenId(shownId)
	}, [openId, shownId])
	const open = (id: string, keep?: SourceImportChoices) => {
		setChoices(keep)
		setActed(true)
		setPending(undefined)
		setBring(false)
		setOpenId(id)
	}
	const upload = () => {
		setChoices(undefined)
		setActed(true)
		setPending(undefined)
		setOpenId(null)
		setBring(true)
	}
	return shownId ? (
		<SourceImportCurrent
			key={shownId}
			id={shownId}
			focus={acted}
			initialChoices={choices}
			onChoicesChange={setChoices}
			onUploadAnother={upload}
			onPreviewReplaced={(next, update) => {
				setReplaced({ id: next.id, ...update })
				// TV Time keeps the kinds and answers on a new preview; a wishlist's new preview counts its titles again,
				// so its answers start over. Matching is asked again either way, so a hidden match panel never loads
				// the new preview's entries on its own.
				open(
					next.id,
					choices && {
						kinds: choices.kinds,
						answers:
							source === "tvtime"
								? { ...choices.answers, matching: undefined }
								: {},
					},
				)
			}}
			updated={replaced?.id === shownId ? replaced : undefined}
		/>
	) : (
		<Bring
			source={source}
			connectState={connectState}
			handoff={pending}
			onPreview={(summary: ImportSummary) => open(summary.id)}
		/>
	)
}

/** The Bring step of one source: its upload, with how to get the file, or its connection. */
function Bring({
	source,
	connectState,
	handoff,
	onPreview,
}: {
	source: ImportSource
	connectState?: string
	handoff?: ImportHandoff
	onPreview: (summary: ImportSummary) => void
}) {
	useReportStep({
		step: 1,
		notes: [sourceName(source), "", "", ""],
		allDone: false,
	})
	if (!isFileImportSource(source))
		return source === "plex" ? (
			<PlexConnectPanel state={connectState} />
		) : source === "mdblist" ? (
			<MdblistConnectPanel />
		) : (
			<TmdbConnectPanel state={connectState} />
		)
	return (
		<SourceImportUploadPanel
			source={source}
			onPreview={onPreview}
			handoff={handoff}
			onOpenMatching={(id) => onPreview({ id } as ImportSummary)}
		/>
	)
}
