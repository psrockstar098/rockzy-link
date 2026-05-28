import { isBrowser, prefersReducedMotion } from "../environment.js";

export interface ViewTransitionConfig {
  enabled?: boolean;
  respectReducedMotion?: boolean;
}

export function runWithViewTransition(
  callback: () => void | Promise<void>,
  config: ViewTransitionConfig = {}
): void | Promise<void> {
  const enabled = config.enabled ?? true;
  const respectReducedMotion = config.respectReducedMotion ?? true;
  const startViewTransition = isBrowser()
    ? document.startViewTransition?.bind(document)
    : undefined;

  if (
    !enabled ||
    !startViewTransition ||
    (respectReducedMotion && prefersReducedMotion())
  ) {
    return callback();
  }

  const transition = startViewTransition(callback);
  return transition.updateCallbackDone;
}
