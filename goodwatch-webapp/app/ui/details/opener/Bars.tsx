/** Three bars that move while a video plays and rest while it's paused (transform only). */
export function Bars({
	on,
	className = "",
}: { on: boolean; className?: string }) {
	return (
		<span
			aria-hidden="true"
			className={`inline-flex h-3 shrink-0 items-end gap-[2px] ${className}`}
		>
			{[0, 1, 2].map((i) => (
				<span
					key={i}
					className={`block h-full w-[3px] origin-bottom rounded-[1px] bg-current ${on ? "motion-safe:animate-[playing-bars_.9s_ease-in-out_infinite]" : ""}`}
					style={{
						animationDelay: `${i * -0.3}s`,
						transform: on ? undefined : `scaleY(${[0.45, 0.8, 0.6][i]})`,
					}}
				/>
			))}
			<style>
				{
					"@keyframes playing-bars{0%,100%{transform:scaleY(.35)}50%{transform:scaleY(1)}}"
				}
			</style>
		</span>
	)
}
