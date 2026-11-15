import { useLayoutEffect, type ComponentRef, type RefObject } from 'react';
import type { View } from 'react-native';

/**
 * Mobile web keyboard (rethink.md item 8): an on-screen keyboard shrinks the visual viewport, not the window, so a
 * pinned action (Continue, Join, Save) would sit under it. The app's root follows the visual viewport: its height and
 * top offset, written straight to the element (no React render per keyboard frame). Pinch zoom (scale above 1) keeps
 * the full window, so zooming in never re-lays the page out. Everything inside (frames, sheets, Taste mode) sizes from
 * the root with flex, so the primary action of every input screen stays right above the keyboard.
 */
export function useVisualViewportFrame(root: RefObject<ComponentRef<typeof View> | null>) {
  useLayoutEffect(() => {
    const vv = typeof window === 'undefined' ? null : window.visualViewport;
    const node = root.current as unknown as HTMLElement | null;
    if (!vv || !node) return;
    let applied = '';
    // The root's own inline styles (react-native-web writes its flex there): put back as they were at full height.
    const names = ['position', 'left', 'right', 'top', 'height', 'flex'];
    const original = names.map((name) => node.style.getPropertyValue(name));
    const apply = () => {
      const zoomed = vv.scale > 1.01;
      const height = zoomed ? window.innerHeight : Math.round(vv.height);
      const top = zoomed ? 0 : Math.max(0, Math.round(vv.offsetTop));
      const key = `${height}:${top}`;
      if (key === applied) return;
      applied = key;
      // Full height: the root's own styles, so it keeps filling the window as before.
      const full = height >= window.innerHeight - 1 && top === 0;
      const style = node.style;
      const values = full ? original : ['fixed', '0', '0', `${top}px`, `${height}px`, 'none'];
      names.forEach((name, i) => {
        if (values[i]) style.setProperty(name, values[i]);
        else style.removeProperty(name);
      });
    };
    apply();
    vv.addEventListener('resize', apply);
    vv.addEventListener('scroll', apply);
    window.addEventListener('resize', apply);
    return () => {
      vv.removeEventListener('resize', apply);
      vv.removeEventListener('scroll', apply);
      window.removeEventListener('resize', apply);
    };
  }, [root]);
}
