// PROTOTYPE - throwaway. Extra data for the "r7track" intro clips; lands in IntroData.extra["r7track"].
import type { LandingCard } from "~/server/prototype-landing.server"

export async function load(_request: Request, _landing: LandingCard[]): Promise<unknown> {
	return null
}
