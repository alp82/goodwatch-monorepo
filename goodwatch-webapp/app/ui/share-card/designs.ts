// Every card design, in the order the design picker shows them. The keys are stored in
// user_list.design and are part of card image cache keys: never rename one after it ships.
import { bento } from "./designs/bento"
import { ceremony } from "./designs/ceremony"
import { cover } from "./designs/cover"
import { filmstrip } from "./designs/filmstrip"
import { letterboard } from "./designs/letterboard"
import { manifesto } from "./designs/manifesto"
import { marquee } from "./designs/marquee"
import { newsprint } from "./designs/newsprint"
import { podium } from "./designs/podium"
import { receipt } from "./designs/receipt"
import { rental } from "./designs/rental"
import { teletext } from "./designs/teletext"
import { tickets } from "./designs/tickets"
import { trading } from "./designs/trading"
import { vhs } from "./designs/vhs"
import type { CardDesign } from "./model"

export const DESIGNS: CardDesign[] = [
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
	manifesto,
	ceremony,
	rental,
	teletext,
	receipt,
]

export const DEFAULT_DESIGN = podium.key

export const isDesignKey = (key: unknown): key is string => typeof key === "string" && DESIGNS.some((d) => d.key === key)

export const designByKey = (key: string | null | undefined): CardDesign => DESIGNS.find((d) => d.key === key) ?? DESIGNS[0]
