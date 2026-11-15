import { nativeClient } from '../credentials';
import { peekSession, readSession, saveSession } from './member';
import { readCreator } from './creator';
import { peekProfileSecret, readProfileSecret } from './profile-secret';
import { ContinuousApi } from './api-client';
export { RoomFailure } from './api-client';
export const continuousApi = new ContinuousApi((url, init) => fetch(url, init), nativeClient, { read: readSession, save: saveSession, peek: peekSession }, { read: readCreator }, { read: readProfileSecret, peek: peekProfileSecret });
