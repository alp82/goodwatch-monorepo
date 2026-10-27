// PROTOTYPE (start page lab): stands in for a section until its variants exist.
import type { BlockVariant } from "./types"

export const placeholder = (section: string): BlockVariant => ({
	key: "a",
	name: "Placeholder",
	C: () => (
		<div className="mx-auto my-6 max-w-3xl rounded-xl border border-dashed border-white/20 p-6 text-center text-sm text-white/50">
			The “{section}” variants are being built.
		</div>
	),
})
