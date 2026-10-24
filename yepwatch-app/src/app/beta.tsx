import { Redirect } from 'expo-router';
/** Preserve already-shared installation links; the home page now owns distribution. */
export default function Beta() { return <Redirect href="/" />; }
