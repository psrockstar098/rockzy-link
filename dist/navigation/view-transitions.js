import { isBrowser, prefersReducedMotion } from "../environment.js";
export async function runWithViewTransition(callback, config = {}) {
    const enabled = config.enabled ?? true;
    const respectReducedMotion = config.respectReducedMotion ?? true;
    const startViewTransition = isBrowser()
        ? document.startViewTransition?.bind(document)
        : undefined;
    if (!enabled ||
        !startViewTransition ||
        (respectReducedMotion && prefersReducedMotion())) {
        await callback();
        return;
    }
    const transition = startViewTransition(callback);
    await transition.updateCallbackDone;
}
//# sourceMappingURL=view-transitions.js.map