// PROTOTYPE — throwaway. Floating bottom bar that cycles a `?variant=` search param.
// Hidden in production builds so a stray merge can't ship it.
import { useEffect } from "react";
import { useLocation, useNavigate } from "@remix-run/react";

export function useVariant<K extends string>(keys: readonly K[]): K {
	const location = useLocation();
	const value = new URLSearchParams(location.search).get("variant");
	return keys.includes(value as K) ? (value as K) : keys[0];
}

export function VariantSwitcher<K extends string>({
	variants,
	names,
}: {
	variants: readonly K[];
	names: Record<K, string>;
}) {
	const location = useLocation();
	const navigate = useNavigate();
	const current = useVariant(variants);
	const cycle = (step: number) => {
		const next =
			variants[(variants.indexOf(current) + step + variants.length) % variants.length];
		const params = new URLSearchParams(location.search);
		params.set("variant", next);
		navigate(`${location.pathname}?${params}`, { replace: true, preventScrollReset: true });
	};
	useEffect(() => {
		const listener = (e: KeyboardEvent) => {
			if ((e.target as HTMLElement).closest("input,textarea,select,[contenteditable]")) return;
			if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
				e.preventDefault();
				cycle(e.key === "ArrowLeft" ? -1 : 1);
			}
		};
		window.addEventListener("keydown", listener);
		return () => window.removeEventListener("keydown", listener);
	});
	if (process.env.NODE_ENV === "production") return null;
	return (
		<nav
			aria-label="Prototype variants"
			className="fixed bottom-20 lg:bottom-5 left-1/2 -translate-x-1/2 z-[1050] flex items-center gap-2 rounded-full border border-amber-400 bg-gray-950 px-3 py-1 text-sm text-white shadow-xl whitespace-nowrap"
		>
			<button className="p-2" aria-label="Previous variant" onClick={() => cycle(-1)}>
				←
			</button>
			<span>
				{current} · {names[current]}
			</span>
			<button className="p-2" aria-label="Next variant" onClick={() => cycle(1)}>
				→
			</button>
		</nav>
	);
}
