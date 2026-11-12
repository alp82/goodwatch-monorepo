import { I18nManager } from 'react-native';

/**
 * +1 when the layout runs left to right, -1 when it runs right to left. Rows placed with `start` and
 * translateX multiply their offsets by this, so they mirror together with the logical anchor.
 */
export function useInlineSign(): 1 | -1 {
  return I18nManager.isRTL ? -1 : 1;
}
