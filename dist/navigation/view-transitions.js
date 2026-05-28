import { isBrowser, prefersReducedMotion } from "../environment.js";
export function runWithViewTransition(callback, config = {}) {
    const enabled = config.enabled ?? true;
    const respectReducedMotion = config.respectReducedMotion ?? true;
    const startViewTransition = isBrowser()
        ? document.startViewTransition?.bind(document)
        : undefined;
    if (!enabled ||
        !startViewTransition ||
        (respectReducedMotion && prefersReducedMotion())) {
        return callback();
    }
    const transition = startViewTransition(callback);
    return transition.updateCallbackDone;
}
//# sourceMappingURL=view-transitions.js.map