// PROTOTYPE - throwaway. Extra data for the "r5open" intro clips; lands in IntroData.extra["r5open"].
import type { LandingCard } from "~/server/prototype-landing.server"

export async function load(_request: Request, _landing: LandingCard[]): Promise<unknown> {
	return null
}
