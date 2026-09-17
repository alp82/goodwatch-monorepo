import { useLocation, useNavigate } from "@remix-run/react";
import { useEffect, useState } from "react";

// TODO delete this file

interface UseUpdateUrlParams<T> {
	params: T;
}

export const useUpdateUrlParams = <T extends {}>({
	params,
}: UseUpdateUrlParams<T>) => {
	const [currentParams, setCurrentParams] = useState(params);
	const { pathname, search } = useLocation();
	const navigate = useNavigate();

	useEffect(() => {
		setCurrentParams(params);
	}, [params]);

	const getNonEmptyParams = (newParams: T) => {
		return Object.keys(newParams)
			.sort()
			.reduce<T>((result, key) => {
				const value = newParams[key as keyof T];
				if (!value) return result;
				return {
					...result,
					[key]: value,
				};
			}, {} as T);
	};

	const constructUrl = (newParams: T) => {
		const nonEmptyNewParams = getNonEmptyParams(newParams);
		const query = new URLSearchParams(nonEmptyNewParams as unknown as Record<string, string>);
		if (process.env.NODE_ENV !== "production" && new URLSearchParams(search).get("prototype") === "journey") query.set("prototype", "journey");
		return `${pathname}?${query.toString()}`;
	};

	const updateParams = (newParams: T, replace = false) => {
		const nonEmptyNewParams = getNonEmptyParams(newParams);
		setCurrentParams(nonEmptyNewParams);
		// Locale initialization must not insert an extra history step into the preview journey.
		const inJourney = process.env.NODE_ENV !== "production" && new URLSearchParams(search).get("prototype") === "journey";
		navigate(constructUrl(newParams), { replace: replace || inJourney });
	};

	return {
		currentParams,
		constructUrl,
		updateParams,
	};
};
