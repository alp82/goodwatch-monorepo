// PROTOTYPE - throwaway. The intro lab: every clip of the GoodWatch intro film, by section. Pick one clip per section
// (or none), set the speed and the hand-over, and play the sequence or any clip alone. The choice lives in the URL
// (`seq`, `speed`, `tr`), and "Play on the TV" opens the start page's film variant with the same sequence.
import { type LoaderFunctionArgs, json } from "@remix-run/node"
import { Link, useLoaderData, useSearchParams } from "@remix-run/react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { tvHomeLoader } from "~/server/living-room/tv-loader.server"
import { loadIntroData } from "~/server/prototype-intro/index.server"
import { type Clip, type IntroData, SECTIONS } from "~/ui/prototype-intro/clip"
import { ALL_CLIPS, clipById } from "~/ui/prototype-intro/clips"
import { Sequence, Stage, TRANSITIONS, type TransitionId, sequenceMs } from "~/ui/prototype-intro/Sequence"

export async function loader(args: LoaderFunctionArgs) {
	if (process.env.NODE_ENV === "production") throw new Response("Not found", { status: 404 })
	const res = (await tvHomeLoader(args as never)) as Response
	const home = await res.json()
	return json(await loadIntroData(args.request, home))
}

export const meta = () => [{ title: "Intro lab · GoodWatch" }, { name: "robots", content: "noindex, nofollow" }]

const SPEEDS = [
	{ label: "0.7×", k: 1.43 },
	{ label: "0.8×", k: 1.25 },
	{ label: "0.9×", k: 1.11 },
	{ label: "1×", k: 1 },
	{ label: "1.15×", k: 0.87 },
]

const fmt = (ms: number) => `${(ms / 1000).toFixed(1)} s`

export default function IntroLab() {
	const data = useLoaderData<typeof loader>() as unknown as IntroData
	const [params, setParams] = useSearchParams()
	const set = (key: string, value: string | null) => {
		const p = new URLSearchParams(params)
		if (value === null) p.delete(key)
		else p.set(key, value)
		setParams(p, { replace: true, preventScrollReset: true })
	}
	const [older, setOlder] = useState(false)
	const bySection = useMemo(
		() =>
			Object.fromEntries(
				SECTIONS.map((s) => [
					s.id,
					// Newest first: round 5 clips are registered after round 4's.
					ALL_CLIPS.filter((c) => c.section === s.id && (older || !c.archived)).reverse(),
				]),
			),
		[older],
	)
	// The sequence: the URL's, else the first clip of every section.
	const seqIds = params.get("seq")?.split(",").filter(Boolean) ?? SECTIONS.flatMap((s) => bySection[s.id][0]?.id ?? [])
	// The sequence plays in chapter order, whatever order the URL lists it in.
	const order = (id: string) => SECTIONS.findIndex((s) => s.id === clipById(id)?.section)
	seqIds.sort((a, b) => order(a) - order(b))
	const seq = seqIds.flatMap((id) => clipById(id) ?? [])
	const chosen = (section: string) => seq.find((c) => c.section === section)?.id ?? null
	const choose = (section: string, id: string | null) => {
		const next = SECTIONS.flatMap((s) => (s.id === section ? (id ?? []) : (chosen(s.id) ?? [])))
		set("seq", next.join(",") || "none")
	}
	const speed = SPEEDS.find((s) => s.label === params.get("speed")) ?? SPEEDS[1]
	const tr = (params.get("tr") as TransitionId) in TRANSITIONS ? (params.get("tr") as TransitionId) : "fade"

	// What plays: the sequence, or one clip alone.
	const [playing, setPlaying] = useState<{ clips: Clip[]; label: string } | null>(null)
	const [run, setRun] = useState(0)
	const [at, setAt] = useState(0)
	const [loop, setLoop] = useState(false)
	const play = (clips: Clip[], label: string) => {
		setPlaying({ clips, label })
		setRun((n) => n + 1)
		// On a phone the stage is above the list: bring it into view.
		const stage = document.querySelector(".lpi-stage")
		const r = stage?.getBoundingClientRect()
		if (r && (r.top < 0 || r.bottom > innerHeight)) stage?.scrollIntoView({ behavior: "smooth", block: "start" })
	}
	const onEnd = useCallback(() => {}, [])
	const current = playing?.clips[at]
	const tvHref = `/?variant=film&clips=${seq.map((c) => c.id).join(",")}&speed=${encodeURIComponent(speed.label)}&tr=${tr}`

	return (
		<div className="min-h-screen bg-[#07080b] px-4 pb-24 pt-6 text-white md:px-8">
			<div className="mx-auto flex max-w-7xl flex-col gap-5 lg:flex-row">
				{/* The stage, in the TV's frame. */}
				<div className="lg:sticky lg:top-20 lg:w-[62%] lg:self-start">
					<div className="relative aspect-video w-full overflow-hidden rounded-md bg-black shadow-[0_0_0_10px_#111,0_0_60px_rgba(251,191,36,.12)]">
						<Stage k={speed.k}>
							{playing ? (
								<Sequence clips={playing.clips} data={data} k={speed.k} transition={tr} loop={loop} run={run} onEnd={onEnd} onAt={setAt} chapters />
							) : (
								<div className="absolute inset-0 flex items-center justify-center text-[3cqw] text-white/50">Press Play</div>
							)}
						</Stage>
					</div>
					<div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
						<button type="button" onClick={() => play(seq, "Sequence")} className="rounded-full bg-amber-400 px-4 py-2 font-bold text-black">
							▶ Play sequence ({fmt(sequenceMs(seq, speed.k, tr))})
						</button>
						<button type="button" onClick={() => setPlaying(null)} className="rounded-full bg-white/10 px-4 py-2 font-semibold">
							Stop
						</button>
						<label className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-2">
							<input type="checkbox" checked={loop} onChange={(e) => setLoop(e.target.checked)} /> Loop
						</label>
						<select value={speed.label} onChange={(e) => set("speed", e.target.value)} className="rounded-full bg-white/10 px-3 py-2">
							{SPEEDS.map((s) => (
								<option key={s.label} value={s.label} className="bg-black">
									Speed {s.label}
								</option>
							))}
						</select>
						<select value={tr} onChange={(e) => set("tr", e.target.value)} className="rounded-full bg-white/10 px-3 py-2">
							{Object.entries(TRANSITIONS).map(([id, t]) => (
								<option key={id} value={id} className="bg-black">
									{t.name}
								</option>
							))}
						</select>
						<Link to={tvHref} className="rounded-full bg-white/10 px-4 py-2 font-semibold">
							Play on the TV →
						</Link>
					</div>
					<div className="mt-2 min-h-5 text-sm text-white/60">
						{playing && current && (
							<>
								{playing.label}: <b className="text-white">{current.id}</b> · {current.name} ({at + 1}/{playing.clips.length})
							</>
						)}
					</div>
				</div>

				{/* The sections and their clips. */}
				<div className="flex flex-1 flex-col gap-3">
					<div className="text-xs text-white/50">
						{ALL_CLIPS.filter((c) => older || !c.archived).length} clips. Click a clip to play it and put it in the sequence.{" "}
						<label className="ml-2 inline-flex items-center gap-1">
							<input type="checkbox" checked={older} onChange={(e) => setOlder(e.target.checked)} /> Show older clips
						</label>
					</div>
					{SECTIONS.map((s, n) => (
						<section key={s.id} className="rounded-xl bg-white/[0.04] p-3 ring-1 ring-white/10">
							<div className="mb-2 flex items-baseline justify-between">
								<h2 className="font-bold">
									<span className="text-white/40">{n + 1}.</span> {s.name}
								</h2>
								<button type="button" onClick={() => choose(s.id, null)} className={`text-xs ${chosen(s.id) ? "text-white/50" : "font-bold text-amber-400"}`}>
									{chosen(s.id) ? "Leave out" : "Left out"}
								</button>
							</div>
							<ul className="flex flex-col gap-1.5">
								{bySection[s.id].map((c) => {
									const on = chosen(s.id) === c.id
									return (
										<li key={c.id} className={`flex items-start gap-2 rounded-lg px-2 py-1.5 ${on ? "bg-amber-400/15 ring-1 ring-amber-400" : "hover:bg-white/5"}`}>
											<button type="button" onClick={() => play([c], c.id)} aria-label={`Play ${c.id}`} className="mt-0.5 flex h-7 w-7 flex-none items-center justify-center rounded-full bg-white/10 text-xs">
												▶
											</button>
											<button
												type="button"
												onClick={() => {
													choose(s.id, c.id)
													play([c], c.id)
												}}
												className="flex-1 text-left"
											>
												<span className="font-semibold">{c.name}</span>{" "}
												<span className="text-xs text-white/40">
													{c.id} · {fmt(c.ms * speed.k)}
												</span>
												{c.note && <span className="block text-xs text-white/55">{c.note}</span>}
											</button>
										</li>
									)
								})}
								{!bySection[s.id].length && <li className="text-xs text-white/40">No clips yet.</li>}
							</ul>
						</section>
					))}
				</div>
			</div>
		</div>
	)
}

/** While clips are being built, a half-saved file can break the route for a moment: try again on our own. */
export function ErrorBoundary() {
	useEffect(() => {
		const t = setTimeout(() => window.location.reload(), 2500)
		return () => clearTimeout(t)
	}, [])
	return (
		<div className="flex min-h-[60vh] items-center justify-center bg-[#07080b] text-white/70">
			A clip is being saved. Reloading in a moment…
		</div>
	)
}
