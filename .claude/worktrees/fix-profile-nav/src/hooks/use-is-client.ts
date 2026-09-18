import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * `false` during SSR and the hydration pass, `true` afterwards. Use it to gate
 * anything that only the browser knows — e.g. the resolved colour theme — so
 * the server and client render the same markup.
 */
export function useIsClient() {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  );
}
