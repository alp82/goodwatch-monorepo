import { useEffect, useState } from "react";
import { useRevalidator } from "@remix-run/react";

const loadingProps = {
	pointerEvents: "none",
	opacity: 0.7,
};

interface UseSubmitProps<Params> {
	url: `/api/${string}`;
	params: Params;
	onClick?: () => void;
}

export const useAPIAction = <Params extends {}, Result extends {}>({
	url,
	params,
	onClick,
}: UseSubmitProps<Params>) => {
	const revalidator = useRevalidator();

	const [submitting, setSubmitting] = useState(false);
	const [result, setResult] = useState<Result | null>(null);

	const handleSubmit = async () => {
		if (onClick) {
			onClick();
		}
		setResult(null);
		setSubmitting(true);
		const response = await fetch(url, {
			method: "POST",
			body: JSON.stringify(params),
		});
		const result: Result = await response.json();
		setResult(result);
		revalidator.revalidate();
	};

	useEffect(() => {
		if (revalidator.state === "idle") {
			setSubmitting(false);
		}
	}, [revalidator.state]);

	const isLoading = submitting; /* || revalidator.state === "loading"*/
	const submitProps = {
		onClick: handleSubmit,
		disabled: isLoading || null,
		style: isLoading ? loadingProps : {},
	};

	return {
		result,
		isLoading,
		submitProps,
	};
};
