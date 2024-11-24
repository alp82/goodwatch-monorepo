import { useLocation, useNavigate } from "@remix-run/react";
import type { NavigateOptions } from "react-router/dist/lib/context";

export const SEPARATOR_PRIMARY = ",";
export const SEPARATOR_SECONDARY = "_";
export const SEPARATOR_TERTIARY = "|";

export const useNav = <T extends {}>() => {
	const location = useLocation();
	const navigate = useNavigate();

	const updateQueryParams = (
		paramsToUpdate: Partial<T>,
		options?: NavigateOptions,
	) => {
		const newParams = new URLSearchParams(location.search);

		for (const [key, value] of Object.entries(paramsToUpdate)) {
			if (value !== undefined && value !== null && value !== "") {
				newParams.set(key, String(value));
			} else {
				newParams.delete(key);
			}
		}

		const safeQueryString = newParams
			.toString()
			.replace(/%2C/g, ",")
			.replace(/%7C/g, "|");
		// .replace(/%3A/g, ":")
		// .replace(/%3B/g, ";")
		navigate(`${location.pathname}?${safeQueryString}`, options);
	};

	const currentParams = Object.fromEntries(
		new URLSearchParams(location.search).entries(),
	) as T;
	return { currentParams, updateQueryParams };
};
