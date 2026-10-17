// PROTOTYPE - throwaway. Extra data for the "r6filter" intro clips; lands in IntroData.extra["r6filter"].
import type { LandingCard } from "~/server/prototype-landing.server"

export async function load(_request: Request, _landing: LandingCard[]): Promise<unknown> {
	return null
}
