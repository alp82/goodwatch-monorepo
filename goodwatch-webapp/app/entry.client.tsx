import { RemixBrowser } from "@remix-run/react";
import { startTransition, StrictMode, useEffect } from "react";
import { hydrateRoot } from "react-dom/client";
import posthog from "posthog-js";

function PosthogInit() {
  useEffect(() => {
    posthog.init('phc_RM4XKAExwoQJUw6LoaNDUqCPLXuFLN6lPWybGsbJASq', {
      // api_host: 'https://eu.i.posthog.com',
      api_host: 'https://a.goodwatch.app',
      person_profiles: 'identified_only', // or 'always' to create profiles for anonymous users as well
    });
  }, []);

  return null;
}

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <RemixBrowser />
      <PosthogInit />
    </StrictMode>
  );
})
