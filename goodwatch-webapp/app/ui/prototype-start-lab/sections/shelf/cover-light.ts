// PROTOTYPE (start page lab): f "Printed covers" helper: reads the room's light around a slot from the painted scene
// itself (a small canvas copy of the room image) and the slot's size on screen.
import { type RefObject, useLayoutEffect, useState } from "react"
import type { SceneSlot } from "../../scene/types"

export type SlotLight = {
	/** The multiply tint: the room's color around the slot, dimmed by how dark that corner is. */
	tint: string
	/** The CSS angle the cover darkens toward (away from the light), and how dark its far edge gets (0..1). */
	shadeAngle: number
	shade: number
	/** The CSS angle of the case's sheen (from the light side). */
	sheenAngle: number
}

/** Before the room image is read: a warm lamp-lit default. */
export const DEFAULT_LIGHT: SlotLight = { tint: "rgb(214,184,150)", shadeAngle: 180, shade: 0.22, sheenAngle: 125 }

type Pixels = { data: Uint8ClampedArray; w: number; h: number }
const SAMPLE_W = 256
const cache = new Map<string, Pixels | Promise<Pixels | null>>()

function readPixels(img: HTMLImageElement): Promise<Pixels | null> {
	const src = img.currentSrc || img.src
	const hit = cache.get(src)
	if (hit) return Promise.resolve(hit)
	const p = new Promise<Pixels | null>((resolve) => {
		const go = () => {
			try {
				const w = SAMPLE_W
				const h = Math.max(1, Math.round((w * img.naturalHeight) / Math.max(1, img.naturalWidth)))
				const c = document.createElement("canvas")
				c.width = w
				c.height = h
				const ctx = c.getContext("2d", { willReadFrequently: true })
				if (!ctx) return resolve(null)
				ctx.drawImage(img, 0, 0, w, h)
				const px = { data: ctx.getImageData(0, 0, w, h).data, w, h }
				cache.set(src, px)
				resolve(px)
			} catch {
				resolve(null)
			}
		}
		if (img.complete && img.naturalWidth) go()
		else {
			img.addEventListener("load", go, { once: true })
			img.addEventListener("error", () => resolve(null), { once: true })
		}
	})
	cache.set(src, p)
	return p
}

/** The mean color (0..1) of a normalized box of the image, clipped to the image. */
function mean(px: Pixels, x0: number, y0: number, x1: number, y1: number) {
	const ax = Math.max(0, Math.floor(x0 * px.w))
	const bx = Math.min(px.w, Math.ceil(x1 * px.w))
	const ay = Math.max(0, Math.floor(y0 * px.h))
	const by = Math.min(px.h, Math.ceil(y1 * px.h))
	let r = 0
	let g = 0
	let b = 0
	let n = 0
	for (let y = ay; y < by; y++)
		for (let x = ax; x < bx; x++) {
			const i = (y * px.w + x) * 4
			r += px.data[i]
			g += px.data[i + 1]
			b += px.data[i + 2]
			n++
		}
	if (!n) return null
	return { r: r / n / 255, g: g / n / 255, b: b / n / 255, l: (0.2126 * r + 0.7152 * g + 0.0722 * b) / n / 255 }
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

export function lightAt(px: Pixels, slot: SceneSlot): SlotLight {
	const [x, y, w, h] = slot.box
	// Neighborhoods on each side of the slot (the case, the shelf, the wall), never the slot itself.
	const left = mean(px, x - w * 1.6, y - h * 0.2, x - w * 0.15, y + h * 1.2)
	const right = mean(px, x + w * 1.15, y - h * 0.2, x + w * 2.6, y + h * 1.2)
	const top = mean(px, x - w * 0.2, y - h * 0.8, x + w * 1.2, y - h * 0.08)
	const bottom = mean(px, x - w * 0.2, y + h * 1.08, x + w * 1.2, y + h * 1.8)
	const sides = [left, right, top, bottom].filter((s) => s != null)
	if (!sides.length) return DEFAULT_LIGHT
	const n = sides.length
	const avg = {
		r: sides.reduce((s, c) => s + c.r, 0) / n,
		g: sides.reduce((s, c) => s + c.g, 0) / n,
		b: sides.reduce((s, c) => s + c.b, 0) / n,
		l: sides.reduce((s, c) => s + c.l, 0) / n,
	}
	// The room's hue at full strength, mixed most of the way to white, then dimmed by the corner's brightness.
	const max = Math.max(avg.r, avg.g, avg.b, 0.01)
	const dim = clamp(0.6 + 0.75 * avg.l, 0.66, 0.95)
	const ch = (c: number) => Math.round(255 * dim * (1 - 0.42 * (1 - c / max)))
	const tint = `rgb(${ch(avg.r)},${ch(avg.g)},${ch(avg.b)})`
	// Toward the light: brighter right than left, brighter below than above (screen y is down).
	const gx = (right?.l ?? avg.l) - (left?.l ?? avg.l)
	const gy = (bottom?.l ?? avg.l) - (top?.l ?? avg.l)
	const mag = Math.hypot(gx, gy)
	// A CSS gradient angle points its end: 0deg up, 90deg right. The shade ends away from the light.
	const toLight = mag > 0.004 ? (Math.atan2(gx, -gy) * 180) / Math.PI : 0
	const shadeAngle = mag > 0.004 ? toLight + 180 : 180
	const shade = clamp(0.14 + (mag / Math.max(0.05, avg.l)) * 0.5, 0.14, 0.4)
	return { tint, shadeAngle, shade, sheenAngle: shadeAngle }
}

/** The light around `slot`, read from the room image around `ref`. */
export function useSlotLight(ref: RefObject<HTMLElement | null>, slot: SceneSlot): SlotLight {
	const [light, setLight] = useState<SlotLight>(DEFAULT_LIGHT)
	useLayoutEffect(() => {
		const img = ref.current?.closest("[data-lab-room]")?.querySelector<HTMLImageElement>("picture img")
		if (!img) return
		let dead = false
		const src = img.currentSrc || img.src
		const hit = cache.get(src)
		if (hit && !(hit instanceof Promise)) {
			setLight(lightAt(hit, slot))
			return
		}
		readPixels(img).then((px) => {
			if (!dead && px) setLight(lightAt(px, slot))
		})
		return () => {
			dead = true
		}
	}, [ref, slot])
	return light
}

/** The slot's on-screen width in px (its untransformed parent: the SceneStage slot box), kept up on resize. */
export function useSlotScreenWidth(ref: RefObject<HTMLElement | null>): number | null {
	const [w, setW] = useState<number | null>(null)
	useLayoutEffect(() => {
		let raf = 0
		const measure = () => {
			const el = ref.current?.parentElement
			if (el) setW(Math.round(el.getBoundingClientRect().width))
		}
		measure()
		const onResize = () => {
			cancelAnimationFrame(raf)
			raf = requestAnimationFrame(measure)
		}
		window.addEventListener("resize", onResize)
		return () => {
			cancelAnimationFrame(raf)
			window.removeEventListener("resize", onResize)
		}
	}, [ref])
	return w
}
