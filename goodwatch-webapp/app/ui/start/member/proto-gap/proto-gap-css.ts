// PROTOTYPE: the `?gap=` variants' CSS, inlined by MemberStart on the prototype branch. Big screens only (1024 px
// and up); smaller screens keep today's layout in every variant.
export const PROTO_GAP_CSS = `
@media (min-width: 1024px) {
	/* b: the stage ends at the card, so Go deeper follows right under it. */
	.start-member[data-gap="b"] .start-content { min-height: 0; }
	.start-member[data-gap="b"] .proto-doors-wrap > section { padding-top: 8px; }

	/* c: "this or that" takes the spare height (gap still up to 300 px), as tall as the card's width lets the two
	   backdrops grow; the card may get wider than today. Whatever is still spare goes: Go deeper follows the card. */
	.start-member[data-gap="c"] .start-content { min-height: 0; }
	.start-member[data-gap="c"] .start-card-wrap { max-width: none; }
	.start-member[data-gap="c"] .proto-doors-wrap > section { padding-top: 8px; }
	.start-member[data-gap="c"] .start-stage {
		--proto-chrome: 215px;
		--proto-box-w: min(100cqw - 136px, 1960px);
		--start-card: max(
			540px,
			min(
				calc((var(--proto-box-w) - 24px) * 0.28125 + var(--proto-chrome)),
				calc(100svh - 4rem - var(--start-pad) - var(--start-block) - 300px - var(--start-card-bottom))
			)
		);
	}
	.start-member[data-gap="c"] .start-card { max-width: min(100cqw - 96px, 2000px); }
	.start-member[data-gap="c"] .start-member-box {
		max-width: calc((var(--start-card) - var(--proto-chrome)) * 3.5556 + 24px);
	}

	/* d: the gap takes all the spare height, the sofa stays centered in it, and the painting zooms in up to 1.3x to
	   cover more of the screen (beyond that the bookcase with the covers would leave the screen). */
	.start-member[data-gap="d"] .start-stage {
		--start-gap: max(
			var(--start-band-need),
			calc(100svh - 4rem - var(--start-pad) - var(--start-block) - var(--start-card) - var(--start-card-bottom))
		);
		--proto-h: calc(var(--start-gap-top) + var(--start-gap) + var(--start-card) + var(--start-card-bottom));
		--proto-c: calc(var(--start-fy) + var(--start-band) / 2);
		--proto-cy: calc(var(--start-gap-top) + var(--start-air-above) + var(--start-room) / 2);
		--start-img-w: min(max(100cqw, calc(var(--proto-h) / var(--start-hw))), 130cqw);
		--start-img-top: min(0px, calc(var(--proto-cy) - var(--start-img-w) * var(--proto-c)));
		/* Right-aligned: the bookcase with the covers stays on screen. */
		--start-img-left: calc(100cqw - var(--start-img-w));
	}

	/* e: Go deeper moves into the stage under the card, and the rug continues under the painting (a soft mirror). */
	.start-member[data-gap="e"] .start-veil,
	.start-member[data-gap="d"] .start-veil {
		--start-b0: calc(var(--start-img-top) + var(--start-img-h) + 40px);
		--start-b1: calc(var(--start-img-top) + var(--start-img-h) * 1.45);
	}
	.start-member[data-gap="e"] .start-card-wrap { padding-bottom: 0; }
	.start-member[data-gap="e"] .proto-doors-wrap { pointer-events: auto; }
	.start-member[data-gap="e"] .proto-doors-wrap > section { padding-top: 40px; }
	.start-member[data-gap="e"] .proto-floor,
	.start-member[data-gap="d"] .proto-floor { display: block; }
}

.proto-floor {
	display: none;
	position: absolute;
	left: var(--start-img-left);
	top: calc(var(--start-img-top) + var(--start-img-h) - 2px);
	width: var(--start-img-w);
	height: calc(var(--start-img-h) * 0.6);
	background-size: 100% calc(100% / 0.6);
	background-position: bottom;
	transform: scaleY(-1);
	filter: blur(8px) brightness(0.6) saturate(0.9);
	mask-image: linear-gradient(to top, black 0%, rgb(0 0 0 / 0.6) 30%, transparent 85%);
	pointer-events: none;
}
`
