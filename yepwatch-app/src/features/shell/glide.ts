import { useRef } from 'react';
/** Web only (glide.web.ts): native layout has no layout-shift metric and keeps its instant layout. */
export function useGlide(_options: { axis?: 'x' | 'y'; enabled?: boolean } = {}) {
  return useRef<never>(null);
}
