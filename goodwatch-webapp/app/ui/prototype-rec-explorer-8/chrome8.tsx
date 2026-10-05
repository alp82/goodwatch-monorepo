// PROTOTYPE - throwaway. Controls around the round-8 map (#180). The page never scrolls: the map fills the window
// under the site header (and above the bottom navigation on phones), the site footer is hidden on this route, and
// every control sits on the map, a little larger than in round 7. Round 6's history, rail, minimap and card are
// reused, restyled bigger from here.
import { Link, useSearchParams } from "@remix-run/react"
import type { ReactNode } from "react"
import type { Ex4 } from "~/ui/prototype-rec-explorer-4/useExplorer4"
import { GROUPINGS, type GroupId } from "~/ui/prototype-rec-explorer-4/wire4"

export function TopBar8({ ex, history }: { ex: Ex4; history: ReactNode }) {
	const mine = ex.services.filter((s) => s.mine)
	const filters = (
		<div className="rx8-filters">
			<button type="button" aria-pressed={ex.onlyMine} onClick={() => ex.setOnlyMine(!ex.onlyMine)} className={`rx8-tog ${ex.onlyMine ? "rx8-tog-on" : ""}`} disabled={!ex.hasServices}>
				<span className="rx8-logos" aria-hidden>
					{mine.slice(0, 3).map((s) => (
						<img key={s.id} src={s.logo} alt="" />
					))}
				</span>
				<span className="rx8-wide">On my services</span>
				<span className="rx8-narrow">My services</span>
			</button>
			<button type="button" aria-pressed={ex.notSeen} onClick={() => ex.setNotSeen(!ex.notSeen)} className={`rx8-tog ${ex.notSeen ? "rx8-tog-on" : ""}`}>
				<span className="rx8-tick" aria-hidden />
				Not seen yet
			</button>
		</div>
	)
	return (
		<header className="rx8-top">
			<div className="rx8-row">
				<h1 className="rx8-brand">Explore</h1>
				<div role="radiogroup" aria-label="Lay the islands out by" className="rx8-seg">
					{GROUPINGS.map((g) => (
						<button key={g.id} type="button" role="radio" aria-checked={ex.group === g.id} onClick={() => ex.setGroup(g.id)} className={`rx8-seg-b ${ex.group === g.id ? "rx8-seg-on" : ""}`}>
							{g.name}
						</button>
					))}
				</div>
				<label className="rx8-pick">
					<span className="sr-only">Lay the islands out by</span>
					<select value={ex.group} onChange={(e) => ex.setGroup(e.target.value as GroupId)}>
						{GROUPINGS.map((g) => (
							<option key={g.id} value={g.id}>
								{g.name}
							</option>
						))}
					</select>
					<svg viewBox="0 0 12 8" aria-hidden className="rx8-caret">
						<path d="M1 1.5l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
					</svg>
				</label>
				<div className="rx8-hist-top">{history}</div>
				{filters}
			</div>
			<div className="rx8-row rx8-row2">
				<div className="rx8-hist-side">{history}</div>
				<Who ex={ex} />
			</div>
		</header>
	)
}

function Who({ ex }: { ex: Ex4 }) {
	const [params] = useSearchParams()
	const w = ex.who
	const other = new URLSearchParams(params)
	other.set("as", w.mode === "me" ? "demo" : "me")
	return (
		<p className="rx8-who">
			{w.mode === "me" ? `From your ${w.rated.toLocaleString("en")} ratings` : `A demo member with ${w.rated} ratings`}
			{w.demoServices ? ", demo services" : ", your services"} in {w.country}.{" "}
			{w.signedIn && (
				<Link to={`?${other}`} reloadDocument className="rx8-who-a">
					{w.mode === "me" ? "Switch to the demo member" : "Use my profile"}
				</Link>
			)}
		</p>
	)
}

export type Side = { id: string; name: string; color: string }

const dot = (s: Side) => <span key={s.id} className="rx8-dot" style={{ background: s.color, boxShadow: `0 0 12px ${s.color}` }} />
const names = (list: Side[]) => <b className="rx8-nm">{list.map((s) => s.name).join(" + ")}</b>
/** "130 titles in both", and "130 in both" where there's little room. */
const count = (c: number, kind: "both" | "between", n = 2) => (
	<span className="rx8-count">
		<span className="rx8-lg">{shared(c, kind, n)}</span>
		<span className="rx8-sm">{kind === "both" ? `${c.toLocaleString("en")} in ${n > 2 ? "all" : "both"}` : `${c.toLocaleString("en")} between`}</span>
	</span>
)
export const shared = (count: number, kind: "both" | "between", n = 2) =>
	kind === "both"
		? `${count.toLocaleString("en")} ${count === 1 ? "title" : "titles"} in ${n > 2 ? "all three" : "both"}`
		: `${count.toLocaleString("en")} titles between ${n > 2 ? "the three" : "them"}`

export type BarState =
	| { k: "lit"; lit: Side; next: string }
	| { k: "reach"; from: Side; over: Side | null; count: number | null; kind: "both" | "between" | null; push: boolean }
	| { k: "forming"; list: Side[] }
	| { k: "bridge"; list: Side[]; count: number; kind: "both" | "between"; more: string | null }

/**
 * What's being combined, in one line over the map, with the way back always on it:
 * lit      an island is lit: what to do next, "Go in", and a button to let it go;
 * reach    a pull or push in progress, and what letting go would make;
 * forming  while the bridge's titles are found;
 * bridge   the islands, what they share, and "Separate".
 */
export function Bar8({ state, onUndo, onGo }: { state: BarState; onUndo: () => void; onGo: () => void }) {
	let body: ReactNode
	let undo: string | null = null
	let go: string | null = null
	if (state.k === "lit") {
		body = (
			<>
				{dot(state.lit)}
				<b>{state.lit.name}</b>
				<span className="rx8-mute">{state.next}</span>
			</>
		)
		undo = "Let go"
	} else if (state.k === "reach") {
		body = state.over ? (
			<>
				<span className="rx8-pair">
					{dot(state.from)}
					{dot(state.over)}
				</span>
				{names([state.from, state.over])}
				{state.count != null && state.kind && count(state.count, state.kind)}
				<span className="rx8-mute">let go to combine</span>
			</>
		) : (
			<>
				{dot(state.from)}
				<b>{state.from.name}</b>
				<span className="rx8-mute">{state.push ? "push it into another island" : "pull the light onto another island"}</span>
			</>
		)
	} else if (state.k === "forming") {
		body = (
			<>
				<span className="rx8-pair">{state.list.map(dot)}</span>
				{names(state.list)}
				<span className="rx8-mute">finding what they share…</span>
			</>
		)
	} else {
		body = (
			<>
				<span className="rx8-pair">{state.list.map(dot)}</span>
				<button type="button" className="rx8-go-name" onClick={onGo}>
					{names(state.list)}
				</button>
				{count(state.count, state.kind, state.list.length)}
				{state.more && <span className="rx8-mute rx8-more">{state.more}</span>}
			</>
		)
		undo = "Separate"
	}
	return (
		<div className={`rx8-bar ${state.k === "reach" ? "rx8-bar-live" : ""}`} role="status" aria-live="polite">
			<div className="rx8-bar-body">{body}</div>
			{go && (
				<button type="button" className="rx8-bar-go" onClick={onGo}>
					{go}
				</button>
			)}
			{undo && (
				<button type="button" className="rx8-bar-x" onClick={onUndo}>
					<svg viewBox="0 0 12 12" aria-hidden>
						<path d="M2.5 2.5l7 7M9.5 2.5l-7 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
					</svg>
					{undo}
				</button>
			)}
		</div>
	)
}

const CSS8 = `
html:has(.rx8-stage){overflow:hidden;scrollbar-gutter:auto !important;overscroll-behavior:none}
body:has(.rx8-stage){overflow:hidden;height:100dvh;overscroll-behavior:none}
body:has(.rx8-stage)>footer{display:none}
body:has(.rx8-stage)>main{margin:0;padding:0;min-height:0;flex:none}
.rx6-stage.rx8-stage{position:fixed;left:0;right:0;top:4rem;bottom:0;height:auto;z-index:1}
@media (max-width:1023px){.rx6-stage.rx8-stage{bottom:65px}}
.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
/* ---- top bar */
.rx8-top{position:absolute;left:0;right:0;top:0;z-index:30;padding:16px 24px 34px;pointer-events:none;background:linear-gradient(to bottom,rgba(4,6,13,.82),rgba(4,6,13,.4) 62%,transparent)}
.rx8-row>*{pointer-events:auto}
.rx8-row{display:flex;align-items:center;gap:12px;min-width:0}
.rx8-row2{margin-top:10px;gap:16px}
.rx8-brand{font-size:32px;font-weight:800;letter-spacing:-.02em;line-height:1;color:#fff;flex:none;text-shadow:0 2px 24px rgba(120,160,255,.35);margin-right:4px}
.rx8-seg{display:flex;gap:2px;padding:4px;border-radius:15px;background:var(--glass);border:1px solid var(--line);backdrop-filter:blur(18px) saturate(1.5);-webkit-backdrop-filter:blur(18px) saturate(1.5);flex:none}
.rx8-seg-b{flex:none;height:40px;padding:0 15px;border-radius:11px;font-weight:600;font-size:15px;color:var(--mute);white-space:nowrap;transition:background .2s,color .2s}
.rx8-seg-b:hover{color:#fff;background:rgba(255,255,255,.06)}
.rx8-seg-on,.rx8-seg-on:hover{color:#0b0f1c;background:#f4f6ff;box-shadow:0 4px 18px rgba(160,190,255,.3)}
.rx8-pick{position:relative;display:none;flex:none}
.rx8-pick select{appearance:none;-webkit-appearance:none;height:44px;padding:0 38px 0 16px;border-radius:13px;font:700 15px Gabarito,system-ui,sans-serif;color:#0b0f1c;background:#f4f6ff;border:0;box-shadow:0 4px 18px rgba(160,190,255,.25)}
.rx8-caret{position:absolute;right:15px;top:50%;width:12px;height:8px;margin-top:-4px;color:#0b0f1c;pointer-events:none}
.rx8-filters{display:flex;gap:8px;margin-left:auto;flex:none}
.rx8-tog{flex:none;display:inline-flex;align-items:center;gap:9px;height:44px;padding:0 15px 0 11px;border-radius:13px;font-size:15px;font-weight:600;color:var(--mute);background:var(--glass);border:1px solid var(--line);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);transition:color .2s,border-color .2s,background .2s;white-space:nowrap}
.rx8-tog:hover{color:#fff;border-color:var(--line-2)}
.rx8-tog:disabled{opacity:.45}
.rx8-tog-on{color:#fff;border-color:rgba(251,191,36,.55);background:linear-gradient(180deg,rgba(251,191,36,.16),rgba(251,191,36,.06))}
.rx8-logos{display:flex}.rx8-logos img{width:22px;height:22px;border-radius:6px;box-shadow:0 0 0 2px rgba(10,14,26,.9)}.rx8-logos img+img{margin-left:-6px}
.rx8-tick{position:relative;width:18px;height:18px;border-radius:6px;border:1.5px solid rgba(255,255,255,.4);flex:none}
.rx8-tog-on .rx8-tick{background:var(--gold);border-color:var(--gold)}
.rx8-tog-on .rx8-tick::after{content:"";position:absolute;left:5px;top:1.5px;width:5px;height:9px;border:solid #0b0f1c;border-width:0 2px 2px 0;transform:rotate(45deg)}
.rx8-narrow{display:none}
.rx8-hist-top{display:none}
.rx8-who{font-size:13px;color:rgba(222,229,255,.55);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
.rx8-stage[data-bar] .rx8-who{visibility:hidden}
.rx8-who-a{text-decoration:underline;text-underline-offset:2px}.rx8-who-a:hover{color:#fff}
/* history, rail and minimap from round 6, larger */
.rx8-stage .rx6-crumbs{height:44px;padding:0 4px;border-radius:13px;gap:3px}
.rx8-stage .rx6-back{width:38px;height:36px;border-radius:10px}
.rx8-stage .rx6-crumb{height:36px;font-size:14.5px;padding:0 11px 0 8px;border-radius:10px;max-width:14rem}
.rx8-stage .rx6-crumb-img{width:18px;height:27px}
.rx8-stage .rx6-hist-btn{height:36px;padding:0 9px;border-radius:10px}
.rx8-stage .rx6-hist-n{font-size:12px;min-width:20px;height:20px}
.rx8-stage .rx6-hist-item{font-size:14.5px;padding:8px 10px}
.rx8-stage .rx6-i-s{width:1.15rem;height:1.15rem}
.rx8-stage .rx6-rail{right:18px;padding:6px;border-radius:18px}
.rx8-stage .rx6-zb{width:44px;height:44px;border-radius:13px}
.rx8-stage .rx6-rail-track{width:44px;height:150px}
.rx8-stage .rx6-rail-stop{height:24px;margin-top:-12px}
.rx8-stage .rx6-rail-dot{width:7px;height:7px}
.rx8-stage .rx6-rail-t{right:56px;font-size:13.5px}
.rx8-stage .rx6-mini{left:18px;bottom:18px}
.rx8-stage .rx6-where{height:44px;padding:0 16px;border-radius:13px;bottom:84px}
.rx8-stage .rx6-where-n{font-size:15px}.rx8-stage .rx6-where-c{font-size:13.5px}
.rx8-stage .rx6-hint{bottom:88px;font-size:15px;color:rgba(232,238,255,.82)}
.rx8-stage .rx6-toast{top:150px;font-size:15px;padding:11px 18px}
@media (max-width:1279px){
 .rx8-seg-b{padding:0 12px;font-size:14.5px}
 .rx8-wide{display:none}.rx8-narrow{display:inline}
}
@media (max-width:1099px){
 .rx8-seg{display:none}.rx8-pick{display:block}
}
@media (max-width:767px){
 .rx8-top{padding:12px 12px 26px}
 .rx8-brand{display:none}
 .rx8-row{gap:8px}
 .rx8-row2{margin-top:8px}
 .rx8-hist-top{display:block;min-width:0;flex:1}
 .rx8-hist-side{display:none}
 .rx8-who{display:none}
 .rx8-row:first-child{flex-wrap:wrap}
 .rx8-filters{margin-left:0;width:100%;order:3}
 .rx8-filters .rx8-tog{flex:1;justify-content:center;padding:0 10px}
 .rx8-stage .rx6-crumbs{max-width:100%}
 .rx8-stage .rx6-crumb{max-width:9.5rem}
 .rx8-stage .rx6-rail{bottom:84px;right:12px}
 .rx8-stage .rx6-mini{left:12px;bottom:84px}
 .rx8-stage .rx6-card-sheet{bottom:76px}
 .rx8-stage .rx6-hint{bottom:96px;font-size:14.5px;width:calc(100% - 170px)}
 .rx8-stage .rx6-hist-n{display:none}
 .rx8-stage .rx6-hist-btn{padding:0 6px}
 .rx8-pick select{padding:0 34px 0 14px}
 .rx8-caret{right:13px}
 .rx8-stage .rx6-toast{top:200px}
}
@media (min-width:768px) and (max-width:1023px){.rx8-stage .rx6-rail{bottom:74px}.rx8-stage .rx6-mini{bottom:74px}}
/* ---- the combine bar */
.rx8-bar{position:absolute;z-index:29;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:6px;max-width:calc(100% - 24px);min-height:50px;padding:5px 5px 5px 16px;border-radius:16px;background:var(--glass-2);border:1px solid var(--line-2);backdrop-filter:blur(22px) saturate(1.5);-webkit-backdrop-filter:blur(22px) saturate(1.5);box-shadow:0 18px 40px rgba(0,0,0,.45);font-size:15px;animation:rx8drop .28s cubic-bezier(.2,.8,.2,1) both}
.rx8-bar-live{border-color:rgba(255,236,190,.4);box-shadow:0 18px 40px rgba(0,0,0,.45),0 0 30px rgba(255,220,150,.12)}
.rx8-bar-body{display:flex;align-items:center;gap:8px;min-width:0;white-space:nowrap;overflow:hidden;padding-right:6px}
.rx8-bar b{font-weight:700;color:#fff}
.rx8-nm{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:0 1 auto}
.rx8-count{color:#fff4d6;font-weight:700;flex:none}
.rx8-sm{display:none}
.rx8-more::before{content:"";display:inline-block;width:1px;height:14px;margin:0 10px -2px 2px;background:rgba(255,255,255,.2)}
.rx8-mute{color:var(--mute);overflow:hidden;text-overflow:ellipsis;min-width:0}
.rx8-plus{color:var(--mute);font-weight:700}
.rx8-dot{width:10px;height:10px;border-radius:99px;flex:none;display:inline-block}
.rx8-pair{display:inline-flex;flex:none}.rx8-pair .rx8-dot+.rx8-dot{margin-left:-3px;outline:2px solid rgba(14,19,34,.9)}
.rx8-go-name{display:inline-flex;align-items:center;min-width:0;flex:0 1 auto}
.rx8-go-name:hover b{text-decoration:underline;text-underline-offset:3px}
.rx8-bar-go{flex:none;height:40px;padding:0 16px;border-radius:12px;font-size:15px;font-weight:700;color:#0b0f1c;background:#f4f6ff}
.rx8-bar-go:hover{background:#fff}
.rx8-bar-x{flex:none;display:inline-flex;align-items:center;gap:7px;height:40px;padding:0 14px 0 12px;border-radius:12px;font-size:15px;font-weight:700;color:#fff;background:rgba(255,255,255,.1)}
.rx8-bar-x svg{width:12px;height:12px}
.rx8-bar-x:hover{background:rgba(255,255,255,.18)}
@keyframes rx8drop{from{opacity:0;transform:translate(-50%,-6px)}to{opacity:1;transform:translate(-50%,0)}}
@media (max-width:767px){.rx8-lg{display:none}.rx8-sm{display:inline}.rx8-bar-body{flex-wrap:wrap;row-gap:0}.rx8-more{flex-basis:100%;font-size:13px}.rx8-more::before{display:none}.rx8-bar{font-size:14px;padding-left:12px;min-height:48px;width:calc(100% - 24px)}.rx8-bar-body{flex:1}.rx8-bar-x,.rx8-bar-go{padding:0 12px;font-size:14px}}
/* ---- things on the map: "Go in" on a lit island, and the labels of bridges that aren't there yet */
.rx8-on{position:absolute;left:0;top:0;will-change:transform;pointer-events:auto}
.rx8-goin{display:inline-flex;align-items:center;gap:8px;height:40px;padding:0 16px 0 14px;border-radius:99px;font-size:15px;font-weight:700;color:#0b0f1c;background:#f4f6ff;box-shadow:0 10px 30px rgba(0,0,0,.5),0 0 24px var(--c,rgba(255,255,255,.3));white-space:nowrap;animation:rx8pop .25s cubic-bezier(.2,.9,.3,1.2) both}
.rx8-goin:hover{background:#fff}
.rx8-goin svg{width:14px;height:14px}
.rx8-ghost{display:inline-flex;align-items:center;gap:8px;height:42px;padding:0 15px 0 12px;border-radius:14px;font-size:14.5px;font-weight:600;color:#fff;background:rgba(9,12,23,.74);border:1px solid color-mix(in srgb,var(--c) 55%,rgba(255,255,255,.18));backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);box-shadow:0 10px 28px rgba(0,0,0,.45);white-space:nowrap;animation:rx8fade .3s ease both;transition:background .18s,border-color .18s}
.rx8-ghost:hover,.rx8-ghost:focus-visible{background:color-mix(in srgb,var(--c) 26%,rgba(9,12,23,.86));border-color:var(--c)}
.rx8-ghost b{font-weight:800}
.rx8-ghost-n{color:var(--mute);font-weight:600}
.rx8-ghost-plus{width:22px;height:22px;border-radius:99px;display:inline-flex;align-items:center;justify-content:center;background:var(--c);color:#0b0f1c;font-weight:800;font-size:16px;line-height:1;flex:none}
.rx8-ghost-pv{pointer-events:none;flex-direction:column;align-items:center;gap:1px;height:auto;padding:8px 14px;border-radius:14px;background:rgba(9,12,23,.6);text-align:center}
.rx8-ghost-pv b{font-size:15px}
.rx8-ghost-pv span{font-size:13px;color:#fff4d6;font-weight:700}
@keyframes rx8pop{from{opacity:0;transform:scale(.9)}to{opacity:1;transform:none}}
@keyframes rx8fade{from{opacity:0}to{opacity:1}}
@media (prefers-reduced-motion:reduce){.rx8-bar,.rx8-goin,.rx8-ghost{animation:none}}
.rx8-gl{position:absolute;z-index:31;right:84px;bottom:18px;font-size:12px;font-weight:600;color:rgba(222,229,255,.7);padding:5px 10px;border-radius:9px;background:var(--glass);border:1px solid var(--line);pointer-events:none}
@media (max-width:1023px){.rx8-gl{right:auto;left:12px;bottom:130px}}
`
export function Styles8() {
	// biome-ignore lint/security/noDangerouslySetInnerHtml: the page's own static styles.
	return <style dangerouslySetInnerHTML={{ __html: CSS8 }} />
}
