// PROTOTYPE - throwaway (#617). In-memory state shared by the variants: which source is open, where its flow is, and
// the long waits a member has started. Nothing persists; a reload starts over.
import { type ReactNode, createContext, useContext, useState } from "react"
import type { SourceId } from "./sources"

export type Stage =
	| { step: "guide" }
	| { step: "connecting" }
	| { step: "preview"; fileName: string; recognized?: string }

interface Store {
	open: SourceId | null
	stage: Stage
	/** Exports the member asked for that arrive later, by source, with the day they asked. */
	waiting: Partial<Record<SourceId, string>>
	notify: SourceId[]
	choose: (id: SourceId | null) => void
	setStage: (stage: Stage) => void
	startWait: (id: SourceId) => void
	stopWait: (id: SourceId) => void
	toggleNotify: (id: SourceId) => void
}

const Context = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
	const [open, setOpen] = useState<SourceId | null>(null)
	const [stage, setStage] = useState<Stage>({ step: "guide" })
	const [waiting, setWaiting] = useState<Store["waiting"]>({})
	const [notify, setNotify] = useState<SourceId[]>([])
	const store: Store = {
		open,
		stage,
		waiting,
		notify,
		choose: (id) => {
			setOpen(id)
			setStage({ step: "guide" })
		},
		setStage,
		startWait: (id) =>
			setWaiting((current) => ({ ...current, [id]: new Date().toISOString() })),
		stopWait: (id) =>
			setWaiting((current) => {
				const next = { ...current }
				delete next[id]
				return next
			}),
		toggleNotify: (id) =>
			setNotify((current) =>
				current.includes(id)
					? current.filter((item) => item !== id)
					: [...current, id],
			),
	}
	return <Context.Provider value={store}>{children}</Context.Provider>
}

export function useStore() {
	const store = useContext(Context)
	if (!store) throw new Error("useStore outside StoreProvider")
	return store
}
