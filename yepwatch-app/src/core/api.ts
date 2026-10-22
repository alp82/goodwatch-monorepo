import { YepApi } from './api-client';
import { nativeClient } from './credentials';
export { ApiFailure } from './errors';
export { YepApi } from './api-client';
export const api = new YepApi((input, init) => fetch(input, init), nativeClient);
