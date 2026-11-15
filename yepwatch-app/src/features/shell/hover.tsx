/**
 * Desktop hover for YepWatch controls (owner rule, rethink.md): big tiles lift (2 px up, a deeper shadow, the arrow
 * nudges forward); short controls lighten (a brighter surface and border, the icon nudges, no lift, no shadow); flat
 * links, icons and rows get a light wash. No outline rings. Web pointers only (react-native-web ignores touch for
 * hover); a press still dims or settles. Transitions run on transform and opacity only: the lift's shadow sits on a
 * layer of its own (LiftShadow) that fades in.
 */
import { createContext, useContext, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { glow, native, onePress, s, spaceToggles } from '../glow/theme';

/** Style keys react-native-web understands but React Native's types don't list. */
export const webOnly = (o: Record<string, unknown>) => (native ? {} : o) as ViewStyle;
const EASE = 'cubic-bezier(0.2, 0.7, 0.2, 1)';
export const hoverTransition = webOnly({ transitionProperty: 'transform, opacity', transitionDuration: '180ms', transitionTimingFunction: EASE });
/** The shadow a lifted dark surface casts. */
export const LIFT_SHADOW = '0 10px 24px rgba(0,0,0,0.38)';
/** An amber surface's lift: a warm glow under the dark drop. */
export const AMBER_LIFT = '0 12px 30px rgba(251,191,36,0.16), 0 6px 16px rgba(0,0,0,0.34)';

/** A big tile's lift: 2 px up while hovered, settles while pressed. Its shadow is a LiftShadow inside the tile. */
export function liftStyle(hovered: boolean, pressed: boolean): ViewStyle {
  const up = hovered && !pressed;
  return { ...hoverTransition, transform: [{ translateY: up ? -2 : 0 }, { scale: pressed ? 0.985 : 1 }] } as ViewStyle;
}

/**
 * The lifted shadow, on a transparent layer over the tile's border box (`inset`: minus its border width) that fades
 * in, so the hover animates opacity and never repaints a shadow. The tile's first child: drawn under its content.
 */
export function LiftShadow({ on, shadow = LIFT_SHADOW, radius = 10, inset = 0 }: { on: boolean; shadow?: string; radius?: number; inset?: number }) {
  if (native) return null;
  return <View pointerEvents="none" aria-hidden style={[{ position: 'absolute', top: inset, left: inset, right: inset, bottom: inset, borderRadius: radius, opacity: on ? 1 : 0 }, hoverTransition, webOnly({ boxShadow: shadow })]} />;
}

const Hovered = createContext(false);
/** True while the nearest HoverPress is hovered. */
export const useHovered = () => useContext(Hovered);
export const HoverProvider = Hovered.Provider;

/** Moves its child forward (`dx`, `dy`) while the enclosing HoverPress is hovered. */
export function Nudge({ children, dx = 3, dy = 0, style }: { children: ReactNode; dx?: number; dy?: number; style?: StyleProp<ViewStyle> }) {
  const on = useHovered();
  return <View style={[style, hoverTransition, { transform: [{ translateX: on ? dx : 0 }, { translateY: on ? dy : 0 }] }]}>{children}</View>;
}

export type HoverLook = 'lift' | 'lighten' | 'tint' | 'none';

/** The theme's Press (same props) with a desktop hover look. */
export function HoverPress({ label, onPress, children, disabled = false, quiet = false, style, selected, hint, repeatable = false, visual, hover = 'lighten', shadow, role = 'button', checked, dim = true, testID }: {
  label: string;
  onPress: () => void;
  children: ReactNode;
  disabled?: boolean;
  quiet?: boolean;
  style?: StyleProp<ViewStyle>;
  selected?: boolean;
  hint?: string;
  repeatable?: boolean;
  /** The control's look inside a bigger press area (as theme Press `visual`); the hover paints on it. */
  visual?: StyleProp<ViewStyle>;
  /** `lift` for big tiles, `lighten` for short controls with a surface, `tint` for links, icons and flat rows. */
  hover?: HoverLook;
  /** The lifted shadow (`lift` only). */
  shadow?: string;
  role?: 'button' | 'radio' | 'switch';
  /** Radio and switch state. */
  checked?: boolean;
  /** Dim while disabled (off where the disabled state has a look of its own). */
  dim?: boolean;
  testID?: string;
}) {
  const [on, setOn] = useState(false);
  const live = on && !disabled && !quiet;
  const skin = (StyleSheet.flatten(visual ?? style) ?? {}) as ViewStyle;
  const bw = typeof skin.borderWidth === 'number' ? skin.borderWidth : 0;
  const amber = typeof skin.backgroundColor === 'string' && skin.backgroundColor.toLowerCase() === glow.amber.toLowerCase();
  const wash = hover === 'lighten'
    ? <View pointerEvents="none" style={[{ position: 'absolute', top: -bw, left: -bw, right: -bw, bottom: -bw, borderRadius: skin.borderRadius ?? 10, borderWidth: bw, borderColor: amber ? '#ffffff59' : '#ffffff2e', backgroundColor: amber ? '#ffffff2b' : '#ffffff10' }, hoverTransition, { opacity: live ? 1 : 0 }]} />
    : hover === 'tint' ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, hoverTransition, { borderRadius: skin.borderRadius ?? 10, backgroundColor: '#ffffff12', opacity: live ? 1 : 0 }]} />
    : null;
  const lift = (pressed: boolean) => hover === 'lift'
    // Shows while hovered, goes while pressed (the tile settles).
    ? <LiftShadow on={live && !pressed} shadow={shadow} radius={typeof skin.borderRadius === 'number' ? skin.borderRadius : 10} inset={-bw} />
    : null;
  const inner = <Hovered.Provider value={live}>{children}</Hovered.Provider>;
  return (
    <Pressable
      testID={testID}
      {...(!native && selected !== undefined && role === 'button' ? { 'aria-pressed': selected } : {})}
      {...(!native && checked !== undefined ? { 'aria-checked': checked } : {})}
      accessibilityRole={role}
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled: disabled || quiet, selected, ...(checked !== undefined ? { checked } : null) }}
      disabled={disabled || quiet}
      onPress={repeatable ? onPress : onePress(onPress)}
      {...(role !== 'button' ? spaceToggles(onPress, disabled || quiet) : null)}
      onHoverIn={() => setOn(true)}
      onHoverOut={() => setOn(false)}
      {...(native ? null : { delayPressIn: 0 })}
      style={({ pressed }) => [
        s.press,
        style,
        hover === 'lift' ? liftStyle(live, pressed) : hoverTransition,
        disabled && dim && { opacity: 0.42 },
        pressed && hover !== 'lift' && { opacity: 0.78 },
        !native && !disabled && !quiet ? webOnly({ cursor: 'pointer' }) : null,
      ]}
    >
      {({ pressed }) => (visual ? <View style={visual}>{lift(pressed)}{wash}{inner}</View> : <>{lift(pressed)}{wash}{inner}</>)}
    </Pressable>
  );
}
