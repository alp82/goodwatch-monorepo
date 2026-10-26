// PROTOTYPE (README still "discover"): the intro's Filters scene, final frame (all switches on, "277 worth watching
// tonight"), without the heading, both columns centred in the picture and top-aligned. Shoot with ?pause=20000.
import { Filters } from "~/ui/living-room/intro/scenes/filters"
import type { SceneProps } from "~/ui/living-room/intro/scene"

const css = `
.readme-discover .intro-switch { animation: none !important; transform: none !important; }
.readme-discover .intro-switch-h { display: none; }
.readme-discover .intro-switch-left { top: 15cqh; left: 5cqw; }
.readme-discover .intro-switch-right { top: 12.4cqh; left: 51cqw; right: auto; }
`

export function ReadmeDiscover({ data }: SceneProps) {
	return (
		<div className="readme-discover" style={{ position: "absolute", inset: 0 }}>
			<style>{css}</style>
			<Filters data={data} />
		</div>
	)
}
