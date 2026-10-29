import {
	createContext,
	useContext,
	useEffect,
	useState,
	type ReactNode,
} from "react"

type SearchGrid = { id: string; activeId: string | undefined }
const SearchCombobox = createContext<{
	grid: SearchGrid | null
	setGrid: (grid: SearchGrid | null) => void
}>({ grid: null, setGrid: () => {} })

/** Connects the field in the bar (or phone sheet) to the mounted suggestions. */
export function SearchComboboxProvider({ children }: { children: ReactNode }) {
	const [grid, setGrid] = useState<SearchGrid | null>(null)
	return (
		<SearchCombobox.Provider value={{ grid, setGrid }}>
			{children}
		</SearchCombobox.Provider>
	)
}

export const useSearchCombobox = () => useContext(SearchCombobox).grid

export function useSearchGrid(id: string, activeId: string | undefined) {
	const { setGrid } = useContext(SearchCombobox)
	useEffect(() => {
		setGrid({ id, activeId })
	}, [id, activeId, setGrid])
	useEffect(() => () => setGrid(null), [setGrid])
}
