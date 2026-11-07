/** Approved shape and layout scale shared by every YepWatch screen. */
export const R = { stamp: 4, control: 10, card: 14 } as const;
/** Stamps on swipe cards: square-ish corners with a black outline so they read on any poster. */
export const stampStyle = { borderRadius: R.stamp, borderWidth: 2, borderColor: '#000' } as const;
/** Warm surfaces and lines of the YepWatch palette (direction D): no navy or cool grays. */
export const warm = {
  ink: '#201400',
  panel: '#141210',
  raised: '#1c1915',
  bar: 'rgba(10,9,8,0.86)',
  line: '#ffffff14',
  lineStrong: '#ffffff24',
  faint: '#ffffff08',
  amberSoft: '#fbbf241c',
  amberLine: '#fbbf245c',
  placeholder: '#6f675b',
  well: '#1a1610',
} as const;
