import { Platform, useWindowDimensions } from 'react-native';
import { layoutFor, type Layout } from './scale';

export { PHONE_MAX, WIDE_MIN, layoutFor, type Layout } from './scale';

/** The shared layout for the current window size. */
export function useLayout(): Layout {
  const { width, height } = useWindowDimensions();
  return layoutFor(width, height);
}

/**
 * Scrolling the page lets go of the keyboard on phones (native). Not on web: react-native-web lets go
 * on every scroll event, including the scroll that brings a focused field into view or above the
 * on-screen keyboard, so a field below the fold lost focus the moment it was tapped.
 */
export const keyboardDismissMode = Platform.OS === 'web' ? 'none' : 'on-drag';
