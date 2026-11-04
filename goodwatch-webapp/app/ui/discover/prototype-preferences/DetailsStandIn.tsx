// PROTOTYPE - throwaway. A stand-in for the title page: the real one needs production databases, which this harness
// doesn't have. A card click adds `open=<key>` to the URL (a new history entry), so Back returns to the same results,
// sort, scroll and read items; reload keeps it open. Its text comes from the V7 preview's read-only card endpoint.
import { XMarkIcon } from "@heroicons/react/20/solid"
import { useNavigate } from "@remix-run/react"
import { useQuery } from "@tanstack/react-query"
import { useEffect } from "react"
import { useParams } from "./parts"

interface Card {
	key: number
	title: string
	year: number | null
	type: string
	poster: string | null
	score: number | null
	genres: string[]
	synopsis: string
	url: string
}

export function DetailsStandIn({ tagged, why }: { tagged: (key: number) => string | null; why: string | null }) {
	const params = useParams()
	const navigate = useNavigate()
	const key = Number(params.get("open"))
	const open = Number.isSafeInteger(key) && key > 1e12
	const card = useQuery({
		queryKey: ["prototype-v7-card", key],
		queryFn: async () => {
			let response: Response
			// The preview answers one request at a time: wait out a busy answer.
			for (let attempt = 0; ; attempt++) {
				response = await fetch("/__prototype-v7/api/cards", {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({ keys: [key] }),
				})
				if (response.status !== 429 || attempt >= 5) break
				await new Promise((resolve) => setTimeout(resolve, 300 * (attempt + 1)))
			}
			return ((await response.json()).cards?.[0] ?? null) as Card | null
		},
		enabled: open,
	})
	const back = () => {
		if (window.history.length > 1 && window.history.state?.idx > 0) navigate(-1)
		else {
			const next = new URLSearchParams(params)
			next.delete("open")
			navigate({ search: `?${next}` }, { replace: true, preventScrollReset: true })
		}
	}
	useEffect(() => {
		if (!open) return
		const key = (e: KeyboardEvent) => e.key === "Escape" && back()
		window.addEventListener("keydown", key)
		return () => window.removeEventListener("keydown", key)
	})
	if (!open) return null
	const c = card.data
	const tier = tagged(key)
	return (
		<div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-6" onClick={back}>
			<div role="dialog" aria-label={c?.title ?? "Title"} onClick={(e) => e.stopPropagation()} className="relative w-full max-w-2xl rounded-t-2xl bg-gray-900 p-5 ring-1 ring-white/15 sm:rounded-2xl">
				<div className="mb-3 rounded-md bg-fuchsia-500/15 px-2 py-1 text-[11px] font-semibold text-fuchsia-200">
					Prototype stand-in for the title page. Back returns to your results.
				</div>
				<button type="button" onClick={back} aria-label="Back to results" className="absolute top-3 right-3 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-gray-300 hover:bg-white/10">
					<XMarkIcon className="h-5 w-5" aria-hidden />
				</button>
				{c ? (
					<div className="flex gap-4">
						{c.poster && <img src={c.poster} alt="" className="w-28 shrink-0 rounded-lg sm:w-36" />}
						<div className="min-w-0">
							<h2 className="brand-header text-2xl text-white">{c.title}</h2>
							<p className="mt-1 text-sm text-gray-400">
								{c.year ?? ""} · {c.type === "show" ? "Show" : "Movie"} · {c.genres.join(", ")}
								{c.score != null && ` · GW ${c.score}`}
							</p>
							{tier && <p className="mt-2 text-[13px] text-sky-200">{tier}</p>}
							{why && <p className="mt-1 text-[12px] text-gray-500">{why}</p>}
							<p className="mt-3 text-[14px] leading-relaxed text-gray-200">{c.synopsis}</p>
							<div className="mt-4 flex gap-3">
								<button type="button" onClick={back} className="cursor-pointer rounded-full bg-amber-400 px-4 py-2 text-sm font-bold text-gray-950 hover:bg-amber-300">
									Back to results
								</button>
								<a href={c.url} target="_blank" rel="noreferrer" className="rounded-full px-4 py-2 text-sm font-semibold text-gray-300 ring-1 ring-white/15 hover:text-white">
									Real page on goodwatch.app (new tab)
								</a>
							</div>
						</div>
					</div>
				) : (
					<p className="py-10 text-center text-gray-400">Loading…</p>
				)}
			</div>
		</div>
	)
}
