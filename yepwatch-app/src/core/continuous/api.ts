import { nativeClient } from '../credentials';
import { ContinuousApi } from './api-client';
export { RoomFailure } from './api-client';
export const continuousApi = new ContinuousApi((url, init) => fetch(url, init), nativeClient);
