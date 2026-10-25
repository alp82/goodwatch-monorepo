import { useEffect, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { type ProfileShell, seesPart } from "~/domain/profile"
import type { ProfileTropes } from "~/server/profile/tropes-data"
import { seesTropes } from "~/server/profile/tropes-model"
import type { TropesPreview } from "~/server/profile/tropes-preview"
import { WRAP } from "~/ui/my-pages/bits"
import { ProfileFrame } from "~/ui/profile/ProfileFrame"
import { Body, TILE, count } from "~/ui/profile/parts"
import { TropesPage } from "./TropesPage"
import { useUser } from "~/utils/auth"

export interface TropesTabProps {
	shell: ProfileShell
	preview: TropesPreview | null
	pending: boolean
}

export function TropesTab({ shell, preview, pending }: TropesTabProps) {
	const [mounted, setMounted] = useState(false)
	useEffect(() => {
		setMounted(true)
	}, [])
	const client = useQueryClient()
	const { user } = useUser()
	const key = [
		"profile-tropes-data",
		shell.handle,
		shell.viewer,
		user?.id ?? null,
		shell.visibility,
	]
	type FullData = {
		tropes: ProfileTropes | null
		pending: boolean
		unchanged?: boolean
	}
	const full = useQuery<FullData>({
		queryKey: key,
		enabled: mounted && seesTropes(shell) && (pending || !!preview?.total),
		queryFn: async ({ signal }) => {
			const previous = client.getQueryData<FullData>(key)
			const version = previous?.tropes?.version
			const params = new URLSearchParams()
			if (version) params.set("version", String(version))
			if (previous?.tropes?.catalogVersion)
				params.set("catalogVersion", previous.tropes.catalogVersion)
			const response = await fetch(
				`/u/${encodeURIComponent(shell.handle)}/tropes/data${params.size ? `?${params}` : ""}`,
				{ signal },
			)
			if (!response.ok) throw new Error("Loading the trope filters failed.")
			const result: FullData = await response.json()
			return result.unchanged
				? { ...result, tropes: previous?.tropes ?? null }
				: result
		},
		refetchInterval: (query) => (query.state.data?.pending ? 1500 : false),
	})
	const tropes = seesTropes(shell) ? (full.data?.tropes ?? preview?.data) : null
	const initial = full.data?.tropes ? undefined : (preview ?? undefined)
	const owner = shell.viewer === "owner"
	const carrying =
		initial?.carrying ?? tropes?.pool.filter((t) => t.r.length > 0).length ?? 0
	const ready = !!tropes?.tropes.length
	return (
		<ProfileFrame
			shell={shell}
			tab="tropes"
			// The tab shows scores and the titles that carry them: both parts must be visible.
			part={seesPart(shell, "taste") ? "scores" : "taste"}
			title="Tropes"
			line={
				tropes && ready
					? `${count(initial?.total ?? tropes.tropes.length)} tropes across ${count(carrying)} of ${owner ? "your" : "their"} titles`
					: undefined
			}
		>
			{tropes && ready ? (
				<div className={`${WRAP} pt-6 pb-40 text-white`}>
					<TropesPage
						key={shell.handle}
						shell={shell}
						data={tropes}
						preview={initial}
						loading={!full.isError}
						retry={() => {
							void full.refetch()
						}}
					/>
				</div>
			) : (
				<Body>
					<p className={`${TILE} px-6 py-14 text-center text-gray-400`}>
						{pending && !full.data?.tropes ? (
							<span role="status">
								{full.isError ? (
									<>
										Tropes could not load.{" "}
										<button
											type="button"
											className="underline"
											onClick={() => {
												void full.refetch()
											}}
										>
											Try again
										</button>
									</>
								) : (
									"Preparing tropes…"
								)}
							</span>
						) : owner ? (
							"Your tropes show up here once you've scored more titles."
						) : (
							`@${shell.handle} hasn't scored enough titles for tropes yet.`
						)}
					</p>
				</Body>
			)}
		</ProfileFrame>
	)
}
