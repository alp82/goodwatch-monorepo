import { assetUrl } from "~/utils/asset-url"
import hookAvif from "~/img/sign-up-hook.avif"
import hookWebp from "~/img/sign-up-hook.webp"

// The picture beside the sign-up, sign-in, and password forms. Its column shows from the lg breakpoint up.
// The image is lazy, so a browser requests it only where the column is displayed: a phone downloads nothing.
export function AuthHookImage() {
	return (
		<picture>
			<source type="image/avif" srcSet={assetUrl(hookAvif)} />
			<img
				loading="lazy"
				decoding="async"
				src={assetUrl(hookWebp)}
				alt="Movies and Shows"
				className="absolute inset-0 w-full h-full object-cover opacity-25"
			/>
		</picture>
	)
}
