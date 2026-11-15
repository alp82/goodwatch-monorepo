/**
 * Desktop hover for Tonight and Matches controls (owner rule): short controls (buttons, rows, chips)
 * lighten (a brighter surface or border, an icon nudge; no lift, no shadow); big tiles (`lift`) rise
 * 2 px with a stronger shadow. No outline rings. Eased over 180 ms on the web; touch keeps the pressed
 * dim. Children can be a function of `hovered` so an arrow can nudge.
 */
import type { ReactNode } from 'react';
import { Platform, Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { native, onePress, s } from '../glow/theme';

const web = Platform.OS === 'web';
/** The web eases transform, shadow and surface; native has no CSS transitions (and no hover). */
const EASE = (web ? { transitionProperty: 'transform, box-shadow, background-color, border-color', transitionDuration: '180ms', transitionTimingFunction: 'cubic-bezier(0.2, 0, 0, 1)' } : {}) as ViewStyle;
const REST = (web ? { transform: [{ translateY: 0 }], boxShadow: '0 0 0 0 rgba(0,0,0,0)' } : {}) as ViewStyle;
const LIFT = { transform: [{ translateY: -2 }], boxShadow: '0 10px 24px -6px rgba(0,0,0,0.6)' } as ViewStyle;

export function HoverPress({ label, onPress, children, disabled = false, style, visual, hover, lift = false, repeatable = false, hint, testID, dim = true }: {
  label: string;
  onPress: () => void;
  children: ReactNode | ((hovered: boolean) => ReactNode);
  disabled?: boolean;
  /** The press area (at least 48 × 48). Without `visual` it also carries the look and the hover. */
  style?: StyleProp<ViewStyle>;
  /** The look inside a larger press area (as Press `visual`): this box takes the hover. */
  visual?: StyleProp<ViewStyle>;
  /** Extra look while hovered (a lighter surface or border). */
  hover?: ViewStyle;
  /** A big tile: it also lifts on hover. Short controls don't. */
  lift?: boolean;
  /** Each tap of a quick double tap counts on its own. */
  repeatable?: boolean;
  hint?: string;
  testID?: string;
  /** Dim while disabled (off where the disabled state has a look of its own). */
  dim?: boolean;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={repeatable ? onPress : onePress(onPress)}
      {...(native ? null : { delayPressIn: 0 })}
      style={(st) => {
        const on = !disabled && !st.pressed && Boolean((st as { hovered?: boolean }).hovered);
        return [
          s.press,
          style,
          visual ? null : [EASE, on ? [lift ? LIFT : null, hover] : REST],
          disabled && dim && { opacity: 0.42 },
          st.pressed && { opacity: 0.78 },
        ];
      }}
    >
      {(st) => {
        const on = !disabled && !st.pressed && Boolean((st as { hovered?: boolean }).hovered);
        const inner = typeof children === 'function' ? children(on) : children;
        return visual ? <View style={[visual, EASE, on ? [lift ? LIFT : null, hover] : REST]}>{inner}</View> : inner;
      }}
    </Pressable>
  );
}

/** An icon that nudges forward on hover (`dx` px; negative for up or back). */
export function Nudge({ on, children, dx = 3, dy = 0 }: { on: boolean; children: ReactNode; dx?: number; dy?: number }) {
  return <View style={[EASE, { transform: [{ translateX: on ? dx : 0 }, { translateY: on ? dy : 0 }] }]}>{children}</View>;
}
