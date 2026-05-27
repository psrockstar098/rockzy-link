import { isBrowser, prefersReducedMotion, queueMicrotaskSafe } from "../environment.js";

export interface AnnounceOptions {
  label?: string | undefined;
  polite?: boolean | undefined;
}

export interface FocusRestoreOptions {
  selector?: string | undefined;
  preventScroll?: boolean | undefined;
}

export class AccessibilityManager {
  private liveRegion?: HTMLElement;
  private readonly defaultFocusSelector =
    "[data-route-focus], main h1, h1, main, [role='main']";

  announceRouteChange(href: string, options: AnnounceOptions = {}): void {
    if (!isBrowser()) return;

    const region = this.ensureLiveRegion(options.polite ?? true);
    const label = options.label ?? document.title ?? href;
    region.textContent = "";
    queueMicrotaskSafe(() => {
      region.textContent = `Navigated to ${label}`;
    });
  }

  restoreFocus(options: FocusRestoreOptions = {}): boolean {
    if (!isBrowser()) return false;

    const selector = options.selector ?? this.defaultFocusSelector;
    const target = document.querySelector<HTMLElement>(selector);
    if (!target) return false;

    const hadTabIndex = target.hasAttribute("tabindex");
    if (!hadTabIndex) target.setAttribute("tabindex", "-1");
    target.focus({ preventScroll: options.preventScroll ?? true });
    if (!hadTabIndex) {
      target.addEventListener(
        "blur",
        () => target.removeAttribute("tabindex"),
        { once: true }
      );
    }
    return true;
  }

  shouldReduceMotion(): boolean {
    return prefersReducedMotion();
  }

  private ensureLiveRegion(polite: boolean): HTMLElement {
    if (this.liveRegion?.isConnected) return this.liveRegion;

    const region = document.createElement("div");
    region.setAttribute("role", "status");
    region.setAttribute("aria-live", polite ? "polite" : "assertive");
    region.setAttribute("aria-atomic", "true");
    region.dataset.productionLinkAnnouncer = "true";
    Object.assign(region.style, {
      position: "absolute",
      width: "1px",
      height: "1px",
      padding: "0",
      margin: "-1px",
      overflow: "hidden",
      clip: "rect(0, 0, 0, 0)",
      whiteSpace: "nowrap",
      border: "0"
    });
    document.body.appendChild(region);
    this.liveRegion = region;
    return region;
  }
}
