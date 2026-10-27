// PROTOTYPE (start page lab): tv d · With a remote. A small play mark on the screen and a remote-shaped "Watch the
// intro" label; the camera push of variant a, and once the picture lands a small remote beside it (under it on a
// phone) is the film's controls: play/pause on OK, previous and next chapter on the wheel, power off closes.
import { GoodWatchG } from "~/ui/brand/GoodWatchWordmark"
import { CHAPTERS as CHAPTER_LIST } from "~/ui/living-room/intro/scene"
import { ICON, Icon } from "~/ui/living-room/Remote"
import type { IntroFrom, Rect } from "../../lab/types"
import { CHAPTERS, type FilmControl, NearLabel, PlayGlyph, filmBox, useViewport } from "./kit"
import { PushTheater, type TheaterLayout } from "./push"

export function RemoteHint({ size, onPlay }: { size: { w: number; h: number }; onPlay: () => void }) {
	const d = Math.max(16, Math.round(size.h * 0.24))
	return (
		<button
			type="button"
			onClick={onPlay}
			className="labtv-hint flex h-full w-full items-center justify-center bg-black/45 text-white"
			aria-label="Watch the intro"
		>
			<PlayGlyph className="drop-shadow" style={{ width: d, height: d }} />
		</button>
	)
}

function RemoteGlyph() {
	return (
		<svg viewBox="0 0 12 22" className="h-[18px] w-[10px]" aria-hidden="true">
			<rect x="0.75" y="0.75" width="10.5" height="20.5" rx="5" fill="#26272b" stroke="rgba(255,255,255,0.5)" strokeWidth="1.2" />
			<circle cx="6" cy="5" r="1.4" fill="#f87171" />
			<circle cx="6" cy="11" r="2.6" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.1" />
			<path d="M5.2 9.9v2.2l1.8-1.1z" fill="#fbbf24" />
		</svg>
	)
}

export function RemoteNear({ tvRect, onPlay }: { tvRect: Rect; onPlay: () => void }) {
	return (
		<NearLabel tvRect={tvRect} onPlay={onPlay} className="labtv-label-in">
			<RemoteGlyph />
			Watch the intro
		</NearLabel>
	)
}

const REMOTE = { w: 120, h: 268 }

const remoteLayout: TheaterLayout = (vp) => {
	if (vp.w < vp.h) {
		const film = filmBox({ left: 0, top: 0, width: vp.w, height: Math.max(120, vp.h - REMOTE.h - 48) })
		const total = film.height + 24 + REMOTE.h
		film.top = Math.max(12, (vp.h - total) / 2)
		return {
			film,
			controls: { left: (vp.w - REMOTE.w) / 2, top: film.top + film.height + 24, width: REMOTE.w, height: REMOTE.h },
		}
	}
	const wide = vp.w >= 900
	const m = wide ? 24 : 12
	const gap = wide ? 32 : 16
	const film = filmBox({ left: 0, top: 0, width: vp.w - REMOTE.w - gap - 2 * m, height: vp.h })
	film.left = (vp.w - (film.width + gap + REMOTE.w)) / 2
	const scale = Math.min(1, (vp.h - 16) / REMOTE.h)
	return {
		film,
		controls: {
			left: film.left + film.width + gap,
			top: (vp.h - REMOTE.h * scale) / 2,
			width: REMOTE.w,
			height: REMOTE.h * scale,
		},
	}
}

const PAUSE = "M8 5v14M16 5v14"
const LEFT = "M15 6l-6 6 6 6"
const RIGHT = "M9 6l6 6-6 6"

function FilmRemote({ control, onPower }: { control: FilmControl; onPower: () => void }) {
	const vp = useViewport()
	const scale = vp.w < vp.h ? 1 : Math.min(1, (vp.h - 16) / REMOTE.h)
	const inQuiz = control.at >= CHAPTERS
	const chapter = CHAPTER_LIST[Math.min(control.at, CHAPTER_LIST.length - 1)]?.name ?? ""
	return (
		<div
			className="labtv-remote flex origin-top-left flex-col items-center px-2 pb-4 pt-4"
			style={{ width: REMOTE.w, height: REMOTE.h, transform: scale < 1 ? `scale(${scale})` : undefined }}
		>
			<button
				type="button"
				onClick={onPower}
				className="labtv-key labtv-key-power flex size-11 shrink-0 items-center justify-center rounded-full"
				aria-label="Turn off (close the intro)"
			>
				<Icon d={ICON.power} className="size-[19px]" />
			</button>
			<div className="labtv-wheel relative mt-[18px] size-[104px] shrink-0 rounded-full">
				<div className="labtv-face pointer-events-none absolute inset-[8px] rounded-full" />
				<button
					type="button"
					onClick={control.prev}
					disabled={control.at === 0}
					className="labtv-arrow absolute left-[2px] top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full"
					aria-label="Previous chapter"
				>
					<Icon d={LEFT} className="size-[18px]" />
				</button>
				<button
					type="button"
					onClick={control.next}
					disabled={inQuiz}
					className="labtv-arrow absolute right-[2px] top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full"
					aria-label="Next chapter"
				>
					<Icon d={RIGHT} className="size-[18px]" />
				</button>
				<button
					type="button"
					onClick={control.togglePause}
					disabled={inQuiz}
					className="labtv-ok absolute left-1/2 top-1/2 flex size-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full disabled:opacity-40"
					aria-label={control.paused ? "Play" : "Pause"}
				>
					{control.paused ? <PlayGlyph className="ml-0.5 size-[18px]" /> : <Icon d={PAUSE} className="size-[18px]" />}
				</button>
			</div>
			<p className="mt-3 w-full truncate text-center text-[11px] font-semibold leading-4 text-white/70">{chapter}</p>
			<p className="text-center text-[10px] leading-4 text-white/40">
				{inQuiz ? "The end" : `${control.at + 1} of ${CHAPTERS}`}
			</p>
			<GoodWatchG height={18} className="mt-auto opacity-20" />
		</div>
	)
}

export function RemoteTheater({ from, onClose }: { from: IntroFrom | null; onClose: () => void }) {
	return <PushTheater from={from} onClose={onClose} layout={remoteLayout} Controls={FilmRemote} />
}
