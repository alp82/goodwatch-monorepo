import {
	type ReactNode,
	type Dispatch,
	type SetStateAction,
	createContext,
	useContext,
	useEffect,
	useState,
} from "react"

type ComboboxGrid = { id: string; activeId: string | undefined }

/**
 * Connects a field to the list it drives while focus stays in the field: the mounted list registers its id and its
 * highlighted row, and the field reads them for `aria-controls` and `aria-activedescendant`.
 */
function createCombobox() {
	const Context = createContext<{
		grid: ComboboxGrid | null
		setGrid: Dispatch<SetStateAction<ComboboxGrid | null>>
	}>({ grid: null, setGrid: () => {} })

	function Provider({ children }: { children: ReactNode }) {
		const [grid, setGrid] = useState<ComboboxGrid | null>(null)
		return (
			<Context.Provider value={{ grid, setGrid }}>{children}</Context.Provider>
		)
	}

	const useCombobox = () => useContext(Context).grid

	function useGrid(id: string, activeId: string | undefined) {
		const { setGrid } = useContext(Context)
		useEffect(() => {
			setGrid({ id, activeId })
		}, [id, activeId, setGrid])
		useEffect(
			() => () => setGrid((current) => (current?.id === id ? null : current)),
			[id, setGrid],
		)
	}

	return { Provider, useCombobox, useGrid }
}

const search = createCombobox()

/** Connects the field in the bar (or phone sheet) to the mounted suggestions. */
export const SearchComboboxProvider = search.Provider
export const useSearchCombobox = search.useCombobox
export const useSearchGrid = search.useGrid

const find = createCombobox()

/** Connects the Find field to Find's results. */
export const FindComboboxProvider = find.Provider
export const useFindCombobox = find.useCombobox
export const useFindGrid = find.useGrid
