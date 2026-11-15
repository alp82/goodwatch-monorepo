import type { ComponentRef, RefObject } from 'react';
import type { View } from 'react-native';

/** Native: the keyboard is handled per view (keyboard-inset.tsx: Android inset, iOS KeyboardAvoidingView). */
export function useVisualViewportFrame(_root: RefObject<ComponentRef<typeof View> | null>) {}
