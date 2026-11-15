// Reads the cinema's numbers from the server, through TanStack Query (the projector prefetches them, the show reads them).
import type { CinemaNumbers } from "~/domain/cinema-numbers"

export const CINEMA_NUMBERS_KEY = ["cinema-numbers"] as const

export async function fetchCinemaNumbers(): Promise<CinemaNumbers> {
	const response = await fetch("/api/cinema-numbers")
	if (!response.ok)
		throw new Error(`The cinema's numbers answered ${response.status}`)
	return (await response.json()) as CinemaNumbers
}
