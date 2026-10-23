import { useRef, type ReactNode, type ElementRef } from 'react';
import { View, type GestureResponderEvent } from 'react-native';
import type { ActivityPointer } from '@goodwatch/yepwatch-contracts/proposal';
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
  const surface = useRef<ElementRef<typeof View>>(null),
    origin = useRef({ x: 0, y: 0 }),
    anchor = useRef(0);
  const move = (e: GestureResponderEvent) =>
    onPointer({
      x: anchor.current,
      y: Math.max(0, Math.min(1, (e.nativeEvent.pageY - origin.current.y) / height)),
      pressed: true,
      kind: 'touch',
    });
  return (
    <View
      ref={surface}
      testID="pointer-surface"
      style={{ width, height }}
      onLayout={() =>
        surface.current?.measureInWindow((x, y) => {
          origin.current = { x, y };
        })
      }
      onTouchStart={(e) => {
        anchor.current = Math.max(0, Math.min(1, (e.nativeEvent.pageX - origin.current.x) / width));
        move(e);
      }}
      onTouchMove={move}
      onTouchEnd={() => onPointer(null)}
      onTouchCancel={() => onPointer(null)}
    >
      {children}
    </View>
  );
}
