// PROTOTYPE - throwaway. Controls around the round-7 map (#180). Round 6's controls (history, rail, minimap, the
// island in the middle, toasts, styles) are reused as they are; this adds the top bar with room for the Combine
// button, the bar that says what's being combined (and lets it go), and a development-only label for the renderer.
import { Link, useSearchParams } from "@remix-run/react"
import type { ReactNode } from "react"
import type { Ex4 } from "~/ui/prototype-rec-explorer-4/useExplorer4"
import { GROUPINGS } from "~/ui/prototype-rec-explorer-4/wire4"
import type { GlLevel } from "./wire7"

export function TopBar7({ ex, history, extra }: { ex: Ex4; history: ReactNode; extra?: ReactNode }) {
	const mine = ex.services.filter((s) => s.mine)
	return (
		<header className="rx6-top">
			<div className="rx6-top-row">
				<h1 className="rx6-brand">Explore</h1>
				<div role="radiogroup" aria-label="Lay the islands out by" className="rx6-seg rx6-noscroll">
					{GROUPINGS.map((g) => (
						<button key={g.id} type="button" role="radio" aria-checked={ex.group === g.id} onClick={() => ex.setGroup(g.id)} className={`rx6-seg-b ${ex.group === g.id ? "rx6-seg-on" : ""}`}>
							{g.name}
						</button>
					))}
				</div>
			</div>
			<div className="rx6-top-row rx6-top-row2 rx6-noscroll">
				{history}
				<button type="button" aria-pressed={ex.onlyMine} onClick={() => ex.setOnlyMine(!ex.onlyMine)} className={`rx6-tog ${ex.onlyMine ? "rx6-tog-on" : ""}`} disabled={!ex.hasServices}>
					<span className="rx6-logos" aria-hidden>
						{mine.slice(0, 3).map((s) => (
							<img key={s.id} src={s.logo} alt="" />
						))}
					</span>
					On my services
				</button>
				<button type="button" aria-pressed={ex.notSeen} onClick={() => ex.setNotSeen(!ex.notSeen)} className={`rx6-tog ${ex.notSeen ? "rx6-tog-on" : ""}`}>
					<span className="rx6-tick" aria-hidden />
					Not seen yet
				</button>
				{extra}
			</div>
			<Who ex={ex} />
		</header>
	)
}

function Who({ ex }: { ex: Ex4 }) {
	const [params] = useSearchParams()
	const w = ex.who
	const other = new URLSearchParams(params)
	other.set("as", w.mode === "me" ? "demo" : "me")
	return (
		<p className="rx6-who">
			{w.mode === "me" ? `Picked for you from your ${w.rated.toLocaleString("en")} ratings` : `Picked for a demo member with ${w.rated} ratings`}
			{w.demoServices ? ", demo services" : ", your services"} in {w.country}.{" "}
			{w.signedIn && (
				<Link to={`?${other}`} reloadDocument className="rx6-who-a">
					{w.mode === "me" ? "Switch to the demo member" : "Use my profile"}
				</Link>
			)}
		</p>
	)
}

/** Two overlapping rings: the Combine button's mark. */
export function BlendMark({ className = "" }: { className?: string }) {
	return (
		<svg viewBox="0 0 20 14" className={`rx7-mark ${className}`} aria-hidden>
			<circle cx="7" cy="7" r="5.6" fill="none" stroke="currentColor" strokeWidth="1.6" />
			<circle cx="13" cy="7" r="5.6" fill="none" stroke="currentColor" strokeWidth="1.6" />
			<path d="M10 2.4a5.6 5.6 0 0 1 0 9.2a5.6 5.6 0 0 1 0-9.2z" fill="currentColor" opacity=".55" />
		</svg>
	)
}

export type Side = { name: string; color: string }

/**
 * What's being combined, in one line over the map:
 * picking   the islands picked so far and what to do next;
 * forming   while the bridge's titles are found;
 * bridge    the two islands, how many titles they share, and a button to let the bridge go.
 */
export function CombineBar({
	state,
	top,
	onCancel,
	onGo,
}: {
	state:
		| { k: "picking"; picked: Side[] }
		| { k: "lifting"; from: Side; over: Side | null }
		| { k: "forming"; a: Side; b: Side }
		| { k: "bridge"; a: Side; b: Side; count: number; kind: "both" | "between" }
	top: number
	onCancel: () => void
	onGo?: () => void
}) {
	const dot = (s: Side) => <span className="rx7-cdot" style={{ background: s.color, boxShadow: `0 0 10px ${s.color}` }} />
	let body: ReactNode = null
	if (state.k === "picking")
		body = state.picked.length ? (
			<>
				{dot(state.picked[0])}
				<b>{state.picked[0].name}</b>
				<span className="rx7-cmute">and which other island?</span>
			</>
		) : (
			<span>Pick two islands to see what they share</span>
		)
	else if (state.k === "lifting")
		body = state.over ? (
			<>
				{dot(state.from)}
				<b>{state.from.name}</b>
				<span className="rx7-cplus">+</span>
				{dot(state.over)}
				<b>{state.over.name}</b>
				<span className="rx7-cmute">let go to combine</span>
			</>
		) : (
			<>
				{dot(state.from)}
				<b>{state.from.name}</b>
				<span className="rx7-cmute">drop it on another island</span>
			</>
		)
	else if (state.k === "forming")
		body = (
			<>
				{dot(state.a)}
				<b>{state.a.name}</b>
				<span className="rx7-cplus">+</span>
				{dot(state.b)}
				<b>{state.b.name}</b>
				<span className="rx7-cmute">finding what they share…</span>
			</>
		)
	else
		body = (
			<>
				<span className="rx7-cpair">
					{dot(state.a)}
					{dot(state.b)}
				</span>
				<button type="button" className="rx7-cgo" onClick={onGo}>
					<b>
						{state.a.name} + {state.b.name}
					</b>
				</button>
				<span className="rx7-cmute">
					{state.count.toLocaleString("en")} {state.kind === "both" ? (state.count === 1 ? "title in both" : "titles in both") : "titles between them"}
				</span>
			</>
		)
	const closable = state.k !== "lifting"
	return (
		<div className="rx7-combo" style={{ top }} role="status" aria-live="polite">
			{body}
			{closable && (
				<button type="button" className="rx7-cx" onClick={onCancel}>
					{state.k === "bridge" ? "Separate" : "Cancel"}
				</button>
			)}
		</div>
	)
}

const GL_NAME: Record<GlLevel, string> = { 2: "WebGL 2", 1: "WebGL 1", 0: "Canvas 2D" }

/** Development only, with ?gl=: which renderer draws the sea. */
export function GlBadge({ kind, asked }: { kind: GlLevel | null; asked: GlLevel }) {
	if (kind == null) return null
	return (
		<p className="rx7-gl">
			Sea drawn with {GL_NAME[kind]}
			{kind !== asked ? ` (${GL_NAME[asked]} unavailable)` : ""}
		</p>
	)
}

const CSS7 = `
.rx7-comb{flex:none;display:inline-flex;align-items:center;gap:8px;height:36px;padding:0 13px 0 10px;border-radius:12px;font-size:13.5px;font-weight:600;color:var(--mute);background:var(--glass);border:1px solid var(--line);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);transition:color .2s,border-color .2s,background .2s}
.rx7-comb:hover{color:#fff;border-color:var(--line-2)}
.rx7-comb-on{color:#0b0f1c;background:#f4f6ff;border-color:#f4f6ff}
.rx7-comb-on:hover{color:#0b0f1c}
.rx7-mark{width:20px;height:14px;flex:none}
.rx7-combo{position:absolute;z-index:29;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:8px;max-width:calc(100% - 24px);height:40px;padding:0 6px 0 14px;border-radius:14px;background:var(--glass-2);border:1px solid var(--line-2);backdrop-filter:blur(22px) saturate(1.5);-webkit-backdrop-filter:blur(22px) saturate(1.5);box-shadow:0 18px 40px rgba(0,0,0,.45);font-size:13.5px;white-space:nowrap;animation:rx7drop .28s cubic-bezier(.2,.8,.2,1) both}
.rx7-combo b{font-weight:700;color:#fff;overflow:hidden;text-overflow:ellipsis}
.rx7-cmute{color:var(--mute);overflow:hidden;text-overflow:ellipsis}
.rx7-cplus{color:var(--mute);font-weight:700}
.rx7-cdot{width:9px;height:9px;border-radius:99px;flex:none;display:inline-block}
.rx7-cpair{display:inline-flex}.rx7-cpair .rx7-cdot+.rx7-cdot{margin-left:-3px;outline:2px solid rgba(14,19,34,.9)}
.rx7-cgo{min-width:0;display:inline-flex;overflow:hidden}
.rx7-cgo:hover b{text-decoration:underline;text-underline-offset:3px}
.rx7-cx{flex:none;height:30px;padding:0 11px;border-radius:10px;font-size:13px;font-weight:700;color:#fff;background:rgba(255,255,255,.1);margin-left:4px}
.rx7-cx:hover{background:rgba(255,255,255,.18)}
@keyframes rx7drop{from{opacity:0;transform:translate(-50%,-6px)}to{opacity:1;transform:translate(-50%,0)}}
@media (max-width:639px){.rx7-combo{font-size:12.5px;height:38px;gap:6px;padding-left:11px}}
.rx7-gl{position:absolute;z-index:31;right:18px;top:20px;font-size:12px;font-weight:600;color:rgba(222,229,255,.7);padding:5px 10px;border-radius:9px;background:var(--glass);border:1px solid var(--line);pointer-events:none}
@media (max-width:1023px){.rx7-gl{top:auto;right:auto;left:12px;bottom:160px}}
@media (prefers-reduced-motion:reduce){.rx7-combo{animation:none}}
`
export function Styles7() {
	// biome-ignore lint/security/noDangerouslySetInnerHtml: the page's own static styles.
	return <style dangerouslySetInnerHTML={{ __html: CSS7 }} />
}
