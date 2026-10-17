// PROTOTYPE - throwaway. Extra data for the "r7open" intro clips; lands in IntroData.extra["r7open"].
import type { LandingCard } from "~/server/prototype-landing.server"

export async function load(_request: Request, _landing: LandingCard[]): Promise<unknown> {
	return null
}
