import { createContext } from "react";
export const BootPhase = createContext<"boot" | "enter" | "ready">("ready");
export type BrandTarget = {
  x: number;
  y: number;
  width: number;
  height: number;
};
export const BootTarget = createContext<{
  target: BrandTarget | null;
  setTarget: (target: BrandTarget) => void;
}>({ target: null, setTarget: () => undefined });
