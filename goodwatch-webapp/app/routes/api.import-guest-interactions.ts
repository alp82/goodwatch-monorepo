import { json } from "@remix-run/node"

// Recovery-only boundary: legacy onboarding must not replay browser progress
// while the selected-transfer consumer is unavailable. Keep browser snapshots
// and completed account writes intact for the corrected release to resume.
export const action = async () =>
	json(
		{ error: "Saving browser progress is temporarily unavailable. Your progress remains in this browser. Please retry later." },
		{ status: 503, headers: { "Retry-After": "3600", "Cache-Control": "no-store" } },
	)
