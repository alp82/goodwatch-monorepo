// A square crop of a photo before upload: drag to place it, zoom with the slider (or the wheel), and the browser draws
// the square at 512 px, so only the crop leaves the device. The server re-encodes it anyway.
import { useEffect, useRef, useState } from "react"
import { AMBER_BUTTON, QUIET_BUTTON } from "../parts"

const OUT = 512
const MAX_UPLOAD = 5 * 1024 * 1024

export function PhotoCropper({
	file,
	onCancel,
	onCropped,
	busy,
}: {
	file: File
	onCancel: () => void
	onCropped: (blob: Blob) => void
	busy: boolean
}) {
	const [src, setSrc] = useState<string | null>(null)
	const [img, setImg] = useState<HTMLImageElement | null>(null)
	const [zoom, setZoom] = useState(1)
	const [offset, setOffset] = useState({ x: 0, y: 0 })
	const [error, setError] = useState<string | null>(null)
	const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(
		null,
	)

	useEffect(() => {
		// A run that was cleaned up (a new file, or React running the effect twice) must not report on its image.
		let live = true
		const url = URL.createObjectURL(file)
		setSrc(url)
		setImg(null)
		setError(null)
		setZoom(1)
		setOffset({ x: 0, y: 0 })
		const image = new Image()
		image.onload = () => live && setImg(image)
		image.onerror = () =>
			live && setError("That file isn't a photo this browser can read.")
		image.src = url
		return () => {
			live = false
			URL.revokeObjectURL(url)
		}
	}, [file])

	// The photo covers the square (size-64, 256 px) at zoom 1: its shorter side fills it.
	const size = 256
	const base = img ? size / Math.min(img.naturalWidth, img.naturalHeight) : 1
	const w = img ? img.naturalWidth * base * zoom : size
	const h = img ? img.naturalHeight * base * zoom : size
	const clamp = (o: { x: number; y: number }) => ({
		x: Math.min((w - size) / 2, Math.max(-(w - size) / 2, o.x)),
		y: Math.min((h - size) / 2, Math.max(-(h - size) / 2, o.y)),
	})

	const crop = () => {
		if (!img) return
		const canvas = document.createElement("canvas")
		canvas.width = OUT
		canvas.height = OUT
		const ctx = canvas.getContext("2d")
		if (!ctx) return
		const scale = OUT / size
		const dx = (size - w) / 2 + offset.x
		const dy = (size - h) / 2 + offset.y
		ctx.drawImage(img, dx * scale, dy * scale, w * scale, h * scale)
		const done = (blob: Blob | null) => {
			if (!blob) return setError("Cropping failed. Try another photo.")
			if (blob.size > MAX_UPLOAD)
				return setError("That photo is still larger than 5 MB.")
			onCropped(blob)
		}
		canvas.toBlob(
			(blob) =>
				blob && blob.type === "image/webp"
					? done(blob)
					: canvas.toBlob(done, "image/jpeg", 0.9),
			"image/webp",
			0.9,
		)
	}

	return (
		<div className="flex flex-col gap-3 rounded-2xl bg-gray-950/60 p-4 ring-1 ring-white/10 sm:flex-row sm:items-center sm:gap-6">
			<div
				className="relative size-64 shrink-0 touch-none overflow-hidden rounded-full bg-gray-900 ring-2 ring-white/20 select-none"
				onPointerDown={(e) => {
					;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
					drag.current = {
						x: e.clientX,
						y: e.clientY,
						ox: offset.x,
						oy: offset.y,
					}
				}}
				onPointerMove={(e) => {
					const d = drag.current
					if (d)
						setOffset(
							clamp({ x: d.ox + e.clientX - d.x, y: d.oy + e.clientY - d.y }),
						)
				}}
				onPointerUp={() => {
					drag.current = null
				}}
				onWheel={(e) =>
					setZoom((z) => Math.min(4, Math.max(1, z - e.deltaY * 0.002)))
				}
			>
				{src && img && (
					<img
						src={src}
						alt="Your photo, to crop"
						draggable={false}
						className="pointer-events-none absolute top-1/2 left-1/2 max-w-none cursor-grab"
						style={{
							width: w,
							height: h,
							transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
						}}
					/>
				)}
			</div>
			<div className="flex min-w-0 flex-1 flex-col gap-3">
				<p className="text-sm text-gray-300">
					Drag to place your photo in the circle, zoom to fit.
				</p>
				<label className="flex items-center gap-3 text-sm text-gray-400">
					Zoom
					<input
						type="range"
						min={1}
						max={4}
						step={0.01}
						value={zoom}
						onChange={(e) => {
							setZoom(Number(e.target.value))
							setOffset((o) => clamp(o))
						}}
						className="w-40 accent-amber-400"
					/>
				</label>
				{error && <p className="text-sm text-rose-300">{error}</p>}
				<div className="flex flex-wrap gap-2">
					<button
						type="button"
						onClick={crop}
						disabled={!img || busy}
						className={`${AMBER_BUTTON} disabled:opacity-50`}
					>
						{busy ? "Uploading…" : "Use this photo"}
					</button>
					<button type="button" onClick={onCancel} className={QUIET_BUTTON}>
						Cancel
					</button>
				</div>
			</div>
		</div>
	)
}
