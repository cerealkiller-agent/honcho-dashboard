"use client";

import { createContext, useContext, useSyncExternalStore } from "react";
import type { RouteKey } from "@/types/honcho";

export interface NavContextValue {
  navigate: (key: RouteKey) => void;
  current: RouteKey;
}

const noop = () => undefined;

export const NavContext = createContext<NavContextValue>({
  navigate: noop,
  current: "fleet",
});

export function useNav() {
  return useContext(NavContext);
}

function subscribeHash(notify: () => void) {
  window.addEventListener("hashchange", notify);
  return () => window.removeEventListener("hashchange", notify);
}

export function useHash() {
  return useSyncExternalStore(subscribeHash, () => window.location.hash, () => "");
}
