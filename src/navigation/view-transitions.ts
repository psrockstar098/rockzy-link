import { isBrowser, prefersReducedMotion } from "../environment.js";

export interface ViewTransitionConfig {
  enabled?: boolean;
  respectReducedMotion?: boolean;
}

export async function runWithViewTransition(
  callback: () => void | Promise<void>,
  config: ViewTransitionConfig = {}
): Promise<void> {
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
    await callback();
    return;
  }

  const transition = startViewTransition(callback);
  await transition.updateCallbackDone;
}
