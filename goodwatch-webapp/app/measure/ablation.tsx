// THROWAWAY measurement switch (branch measure/hydration-ablation). Not for production.
// `?ablate=a,b,c` leaves the named sections out of the render. The server and the browser read the same URL, so the
// HTML and the hydration agree. Every section is also wrapped in a React Profiler: with the profiling build of
// react-dom (GW_PROFILE=1 at build time) each commit's render time per section lands in `window.__gwProfile`.
import { useSearchParams } from "@remix-run/react"
import { Profiler, type ProfilerOnRenderCallback, type ReactNode } from "react"

export function useAblated(): (name: string) => boolean {
	const [params] = useSearchParams()
	const names = new Set((params.get("ablate") ?? "").split(",").filter(Boolean))
	return (name) => names.has(name)
}

const onRender: ProfilerOnRenderCallback = (
	id,
	phase,
	actualDuration,
	baseDuration,
	startTime,
	commitTime,
) => {
	if (typeof window === "undefined") return
	const w = window as unknown as { __gwProfile?: unknown[] }
	if (!w.__gwProfile) w.__gwProfile = []
	w.__gwProfile.push({ id, phase, actualDuration, baseDuration, startTime, commitTime })
}

/** A page section that `?ablate=<name>` removes. */
export function Measured({ name, part, children }: { name: string; part?: string; children: ReactNode }) {
	const ablated = useAblated()
	if (ablated(name)) return null
	return (
		<Profiler id={part ?? name} onRender={onRender}>
			{children}
		</Profiler>
	)
}

export function RootProfiler({ children }: { children: ReactNode }) {
	return (
		<Profiler id="ROOT" onRender={onRender}>
			{children}
		</Profiler>
	)
}
