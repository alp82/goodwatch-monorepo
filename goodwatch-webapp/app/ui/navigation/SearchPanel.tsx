// The search dialog's panel. Its code loads with the dialog's first opening (see LazyDialogs.tsx), and the command
// palette's code next to it.
import { Dialog, DialogBackdrop, DialogPanel } from "@headlessui/react"
import { Suspense, lazy } from "react"
import { useOpenAfterMount } from "~/utils/first-use"
import { reloadOnStaleChunk } from "~/utils/stale-chunk"
import { useNavigation } from "./NavigationContext"

const loadCommandPalette = () => import("./CommandPalette")
const CommandPalette = lazy(
	reloadOnStaleChunk(() =>
		loadCommandPalette().then((module) => ({
			default: module.CommandPalette,
		})),
	),
)
export const preloadCommandPalette = () => {
	void loadCommandPalette().catch(() => {})
}

export function SearchPanel() {
	const navigation = useNavigation()
	const open = useOpenAfterMount(Boolean(navigation?.searchOpen))
	if (!navigation) return null
	const close = () => navigation.setSearchOpen(false)
	return (
		<Dialog
			open={open}
			onClose={close}
			className="relative z-[1100]"
			aria-label="Search or go to"
		>
			<DialogBackdrop
				transition
				className="fixed inset-0 bg-black/55 transition-opacity duration-200 data-closed:opacity-0"
			/>
			<div className="fixed inset-0 flex flex-col justify-end lg:items-center lg:justify-start lg:pt-[12vh]">
				<DialogPanel
					transition
					className="h-[92%] overflow-y-auto rounded-t-3xl bg-[#0b1120] px-4 pt-4 pb-[calc(22px+env(safe-area-inset-bottom))] shadow-[0_-20px_60px_rgba(0,0,0,0.8),0_0_0_1px_rgba(255,255,255,0.09)] transition duration-200 ease-out data-closed:translate-y-9 data-closed:opacity-0 motion-reduce:transition-opacity motion-reduce:data-closed:translate-y-0 lg:h-auto lg:max-h-[70vh] lg:w-[640px] lg:rounded-[18px] lg:p-3.5 lg:data-closed:-translate-y-3"
				>
					<Suspense fallback={<div className="h-64" aria-busy="true" />}>
						<CommandPalette onDone={close} />
					</Suspense>
				</DialogPanel>
			</div>
		</Dialog>
	)
}
