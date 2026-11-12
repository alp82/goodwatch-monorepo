// The web resolves `start` from react-native-web's locale context (its `dir`), not from I18nManager.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { useLocaleContext } = require('react-native-web') as { useLocaleContext: () => { direction?: 'ltr' | 'rtl' } };

/**
 * +1 when the layout runs left to right, -1 when it runs right to left. Rows placed with `start` and
 * translateX multiply their offsets by this, so they mirror together with the logical anchor.
 */
export function useInlineSign(): 1 | -1 {
  return useLocaleContext().direction === 'rtl' ? -1 : 1;
}
