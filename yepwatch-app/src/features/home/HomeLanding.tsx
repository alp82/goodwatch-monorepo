export interface HomeLandingProps {
  create: () => void;
  join: () => void;
  returnToRoom?: () => void;
  disabled: boolean;
}
// Native installs open the room entry directly; distribution is a web concern.
export function HomeLanding(_props: HomeLandingProps) {
  return null;
}
