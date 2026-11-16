import { createAnalytics, analyticsCommand } from './analytics-policy';
import { analyticsAllowed, sendAnalytics } from './analytics-transport';

export const analytics = createAnalytics(analyticsAllowed, sendAnalytics);
export function trackRoomCommand(type: string) {
  const name = analyticsCommand(type);
  if (name) analytics.event(name);
}
