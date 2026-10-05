// PROTOTYPE - throwaway. Every share-list card design, in picker order.
import { cover, podium, receipt } from "./cards"
import { bento } from "./designs/bento"
import { checkout } from "./designs/checkout"
import { filmstrip } from "./designs/filmstrip"
import { letterboard } from "./designs/letterboard"
import { marquee } from "./designs/marquee"
import { newsprint } from "./designs/newsprint"
import { olympic } from "./designs/olympic"
import { swiss } from "./designs/swiss"
import { teletext } from "./designs/teletext"
import { tickets } from "./designs/tickets"
import { trading } from "./designs/trading"
import { vhs } from "./designs/vhs"
import type { Design } from "./model"

export const DESIGNS: Design[] = [
	podium,
	tickets,
	filmstrip,
	marquee,
	cover,
	newsprint,
	bento,
	vhs,
	trading,
	letterboard,
	swiss,
	olympic,
	checkout,
	teletext,
	receipt,
]
export const designByKey = (key: string | null) => DESIGNS.find((d) => d.key === key) ?? DESIGNS[0]
