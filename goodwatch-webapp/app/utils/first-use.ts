// For a dialog whose code loads with its first opening (the dialog library is 40 KB compressed, and most page views
// never open one).
import { useEffect, useState } from "react"

/** True from the first render with `open`. The dialog mounts then and stays, so closing can still animate. */
export function useOpenedOnce(open: boolean): boolean {
	const [opened, setOpened] = useState(open)
	if (open && !opened) setOpened(true)
	return opened || open
}

/**
 * `open`, but false in the first render. A dialog that loads with its first opening mounts open, and a dialog only
 * plays its opening transition when it changes from closed to open.
 */
export function useOpenAfterMount(open: boolean): boolean {
	const [mounted, setMounted] = useState(false)
	useEffect(() => setMounted(true), [])
	return open && mounted
}
