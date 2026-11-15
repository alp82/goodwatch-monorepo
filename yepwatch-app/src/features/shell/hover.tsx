/**
 * Desktop hover for controls (owner rules, YepWatch rethink): big tiles lift (2 px up and a deeper
 * shadow), short controls with a surface lighten (brighter surface and border, no lift, no shadow),
 * links, icons and flat rows take a light wash. Never an outline ring. Only pointers hover (RN Web
 * ignores touch for hover); a press still dims. CSS transitions on transform, box-shadow and opacity.
 */
import { createContext, useContext, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { glow, native, onePress, spaceToggles } from '../glow/theme';

/** Web only: style keys RN Web understands but React Native's types don't list. */
export const webOnly = (o: Record<string, unknown>) => (native ? {} : o) as ViewStyle;
const EASE = 'cubic-bezier(0.2, 0.7, 0.2, 1)';
export const hoverTransition = webOnly({ transitionProperty: 'transform, box-shadow, opacity', transitionDuration: '180ms', transitionTimingFunction: EASE });
const LIFT_SHADOW = '0 10px 24px rgba(0,0,0,0.38)';
const REST_SHADOW = '0 0 0 rgba(0,0,0,0)';

const Hovered = createContext(false);
/** True while the nearest HoverPress is hovered. */
export const useHovered = () => useContext(Hovered);

/** Moves its child forward (`dx`, `dy`) while the enclosing HoverPress is hovered. */
export function Nudge({ children, dx = 3, dy = 0, style }: { children: ReactNode; dx?: number; dy?: number; style?: StyleProp<ViewStyle> }) {
  const on = useHovered();
  return <View style={[style, hoverTransition, { transform: [{ translateX: on ? dx : 0 }, { translateY: on ? dy : 0 }] }]}>{children}</View>;
}

export type HoverLook = 'lift' | 'lighten' | 'tint' | 'none';

/** The theme's Press (same props) with a desktop hover look. */
export function HoverPress({ label, onPress, children, disabled = false, quiet = false, style, selected, hint, repeatable = false, hover = 'lighten', role = 'button', checked, testID }: {
  label: string;
  onPress: () => void;
  children: ReactNode;
  disabled?: boolean;
  quiet?: boolean;
  style?: StyleProp<ViewStyle>;
  selected?: boolean;
  hint?: string;
  repeatable?: boolean;
  /** `lift` for big tiles, `lighten` for short controls with a surface, `tint` for links, icons and flat rows. */
  hover?: HoverLook;
  role?: 'button' | 'radio' | 'switch';
  /** Radio and switch state. */
  checked?: boolean;
  testID?: string;
}) {
  const [on, setOn] = useState(false);
  const live = on && !disabled && !quiet;
  const flat = (StyleSheet.flatten(style) ?? {}) as ViewStyle;
  const bw = typeof flat.borderWidth === 'number' ? flat.borderWidth : 0;
  const amber = typeof flat.backgroundColor === 'string' && flat.backgroundColor.toLowerCase() === glow.amber.toLowerCase();
  const up = hover === 'lift' && live;
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
        base.press,
        style,
        hoverTransition,
        hover === 'lift' ? webOnly({ transform: [{ translateY: up && !pressed ? -2 : 0 }], boxShadow: up && !pressed ? LIFT_SHADOW : REST_SHADOW }) : null,
        disabled && { opacity: 0.42 },
        pressed && { opacity: 0.78 },
        !native && !disabled && !quiet ? webOnly({ cursor: 'pointer' }) : null,
      ]}
    >
      {hover === 'lighten' ? (
        <View pointerEvents="none" style={[{ position: 'absolute', top: -bw, left: -bw, right: -bw, bottom: -bw, borderRadius: flat.borderRadius ?? 10, borderWidth: bw, borderColor: amber ? '#ffffff59' : '#ffffff2e', backgroundColor: amber ? '#ffffff2b' : '#ffffff10' }, hoverTransition, { opacity: live ? 1 : 0 }]} />
      ) : null}
      {hover === 'tint' ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, hoverTransition, { borderRadius: flat.borderRadius ?? 10, backgroundColor: '#ffffff12', opacity: live ? 1 : 0 }]} /> : null}
      <Hovered.Provider value={live}>{children}</Hovered.Provider>
    </Pressable>
  );
}
const base = StyleSheet.create({ press: { alignItems: 'center', justifyContent: 'center', minWidth: 48, minHeight: 48 } });
