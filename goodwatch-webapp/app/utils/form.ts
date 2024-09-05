import { useCallback, useEffect, useRef } from "react";

export const useAutoFocus = <T extends HTMLElement>(): React.RefCallback<T> => {
	const elementRef = useRef<T | null>(null);

	return useCallback((element: T | null) => {
		if (elementRef.current !== element) {
			elementRef.current = element;
			if (element) {
				element.focus();
			}
		}
	}, []);
};
