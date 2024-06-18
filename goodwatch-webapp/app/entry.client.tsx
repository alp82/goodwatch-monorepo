import { RemixBrowser } from "@remix-run/react"
import { startTransition, StrictMode, useEffect } from "react"
import { hydrateRoot } from "react-dom/client"

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <RemixBrowser />
    </StrictMode>
  );
})
