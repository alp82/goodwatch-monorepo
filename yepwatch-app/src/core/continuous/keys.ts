/** The authoritative room snapshot, shared by admission and the live room observer. */
export const continuousKey = (id: string) => ['proposal-room', id] as const;
