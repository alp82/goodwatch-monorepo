import { useWindowDimensions } from 'react-native';
import { layoutFor, type Layout } from './scale';

export { PHONE_MAX, WIDE_MIN, layoutFor, type Layout } from './scale';

/** The shared layout for the current window size. */
export function useLayout(): Layout {
  const { width, height } = useWindowDimensions();
  return layoutFor(width, height);
}
