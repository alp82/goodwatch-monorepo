// PROTOTYPE - throwaway. The full relevant state, apart from the product copy: the URL's discovery context, the V7
// answer, the derived readout, and what the grid shows. Opened with the State button or `inspect=1`.
import { useLocation } from "@remix-run/react"
import { useQuery } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { useGo, useParams } from "./parts"
import type { PrototypeSearch } from "./usePreferencePrototype"

export function Inspector({ proto, page }: { proto: PrototypeSearch; page: Record<string, unknown> }) {
	const params = useParams()
	const go = useGo()
	const location = useLocation()
	const open = params.get("inspect") === "1"
	const [scrollY, setScrollY] = useState(0)
	useEffect(() => {
		const on = () => setScrollY(Math.round(window.scrollY))
		window.addEventListener("scroll", on, { passive: true })
		return () => window.removeEventListener("scroll", on)
	}, [])
	const config = useQuery({
		queryKey: ["prototype-v7-config"],
		queryFn: () => fetch("/__prototype-v7/api/config").then((r) => r.json()),
		enabled: open,
	})
	const toggle = () => {
		const next = new URLSearchParams(params)
		if (open) next.delete("inspect")
		else next.set("inspect", "1")
		go(next, true)
	}
	const a = proto.answer
	const r = proto.readout
	const state = {
		prototype: { variant: proto.variant, model: "claude-opus-5-5 (medium)", fixtures: "none: results are the live V7 preview service's" },
		url: {
			path: location.pathname,
			q: params.get("q"),
			manualFilters_sentAsExisting: proto.existing || "(none)",
			sort: params.get("sort") ?? "(default: relevance while searching)",
			strictView_B: params.get("strict") === "1",
			open_details: params.get("open"),
			mode: params.get("mode") ?? "easy",
			historyLength: typeof window === "undefined" ? null : window.history.length,
			scrollY,
		},
		v7: a
			? {
					branch: a.branch,
					semanticQuery: a.semanticQuery,
					catalogue_wordsAllFilters: a.catalogue,
					transportAction: a.transportAction,
					params: a.params,
					prefs: a.prefs.map((p) => `${p.parameter}=${p.value} ← “${p.phrase}”`),
					retainedHard: a.retainedHard.map((p) => `${p.parameter}=${p.value} ← “${p.phrase}”`),
					negativeClauses: a.negativeClauses,
					recognizedTitles: a.recognized,
					totals: { v7: a.v7.total, original_baseline: a.baseline.total, original_in_v7: r?.originalInList ?? null },
					identityRepairs: a.identityRepairs.length,
					timing: a.timing,
					source: a.source,
				}
			: proto.loading
				? "loading…"
				: proto.error
					? { error: proto.error, detail: proto.errorDetail ?? "request failed" }
					: "(browsing: no search)",
		readout: r
			? {
					preferences: r.prefs.map((w) => `${w.param}=${w.value}`),
					strictFromWords: r.searchStrict.map((w) => `${w.param}=${w.value} (${w.why})`),
					pinned: r.pinned.map((w) => `${w.param}=${w.value}${w.phrase ? " (also in words)" : " (manual only)"}`),
					setAside: r.setAside.map((s) => `“${s.phrase}” ← ${s.by.param}=${s.by.value} wins`),
					how: r.how,
				}
			: null,
		grid: page,
		forYou: "Off for prototype searches (foryou=0 to results), so V7 order and Top rated tiers arrive as sent. Guest only; no member taste is read or simulated.",
		previewConfig: config.data ?? (open ? "loading…" : "(opens with the panel)"),
	}
	return (
		<>
			<button
				type="button"
				onClick={toggle}
				className="fixed left-4 bottom-44 lg:bottom-6 z-50 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-black shadow-2xl ring-2 ring-fuchsia-500"
			>
				{open ? "Close state" : "State"}
			</button>
			{open && (
				<aside className="fixed top-16 left-4 bottom-20 z-50 w-[min(440px,calc(100vw-2rem))] overflow-auto rounded-xl bg-neutral-950/95 p-3 font-mono text-[11px] leading-snug text-lime-200 shadow-2xl ring-2 ring-fuchsia-500">
					<div className="mb-2 font-sans text-xs font-bold text-fuchsia-300">PROTOTYPE STATE (not product UI)</div>
					<pre className="whitespace-pre-wrap break-words">{JSON.stringify(state, null, 2)}</pre>
				</aside>
			)}
		</>
	)
}
