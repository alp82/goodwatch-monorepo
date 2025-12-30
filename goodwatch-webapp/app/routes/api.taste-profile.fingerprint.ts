import type { LoaderFunctionArgs } from "@remix-run/node"
import { useQuery } from "@tanstack/react-query"
import { getTasteFingerprintStats, type TasteFingerprintStats } from "~/server/taste-profile.server"
import { getUserIdFromRequest } from "~/utils/auth"

export async function loader({ request }: LoaderFunctionArgs) {
	const userId = await getUserIdFromRequest({ request })

	if (!userId) {
		return { topKeys: [], allKeys: [] }
	}

	const stats = await getTasteFingerprintStats({ userId })
	return stats
}

export const queryKeyTasteFingerprint = ["taste-profile-fingerprint"]

export const useTasteFingerprint = (enabled = true) => {
	return useQuery<TasteFingerprintStats>({
		queryKey: queryKeyTasteFingerprint,
		queryFn: async () => await (await fetch("/api/taste-profile/fingerprint")).json(),
		enabled,
	})
}
