import { useRef, type ReactNode } from 'react';
import type { ActivityPointer } from '@goodwatch/yepwatch-contracts/proposal';
/** Pressed x stays at contact: broadcasting the voting swipe direction would disclose Yep/Nope.
 * Stable surface: never measure against the translating poster or a nested trailer button. */
export function PointerSurface({
  width,
  height,
  onPointer,
  children,
}: {
  width: number;
  height: number;
  onPointer: (p: ActivityPointer | null) => void;
  children: ReactNode;
}) {
  const pressed = useRef(false),
    anchor = useRef(0);
  return (
    <div
      data-testid="pointer-surface"
      style={{ width, height, position: 'relative', touchAction: 'none' }}
      onPointerMove={(e) => {
        const bounds = e.currentTarget.getBoundingClientRect();
        onPointer({
          x: pressed.current
            ? anchor.current
            : Math.max(0, Math.min(1, (e.clientX - bounds.left) / bounds.width)),
          y: Math.max(0, Math.min(1, (e.clientY - bounds.top) / bounds.height)),
          pressed: pressed.current,
          kind: e.pointerType === 'mouse' ? 'mouse' : 'touch',
        });
      }}
      onPointerDownCapture={(e) => {
        pressed.current = true;
        const b = e.currentTarget.getBoundingClientRect();
        anchor.current = Math.max(0, Math.min(1, (e.clientX - b.left) / b.width));
        onPointer({
          x: Math.max(0, Math.min(1, (e.clientX - b.left) / b.width)),
          y: Math.max(0, Math.min(1, (e.clientY - b.top) / b.height)),
          pressed: true,
          kind: e.pointerType === 'mouse' ? 'mouse' : 'touch',
        });
      }}
      onPointerUpCapture={() => {
        pressed.current = false;
        onPointer(null);
      }}
      onPointerCancel={() => {
        pressed.current = false;
        onPointer(null);
      }}
      onPointerLeave={() => onPointer(null)}
    >
      {children}
    </div>
  );
}
