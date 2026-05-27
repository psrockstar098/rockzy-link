import { isBrowser } from "../environment.js";

interface PointerSample {
  x: number;
  y: number;
  time: number;
}

export interface PointerIntentOptions {
  hoverDelayMs?: number;
  fastPointerDelayMs?: number;
  fastPointerVelocity?: number;
}

export class PointerIntentTracker {
  private last: PointerSample | undefined;
  private previous: PointerSample | undefined;
  private cleanups = new Map<Element, () => void>();
  private readonly hoverDelayMs: number;
  private readonly fastPointerDelayMs: number;
  private readonly fastPointerVelocity: number;

  constructor(options: PointerIntentOptions = {}) {
    this.hoverDelayMs = options.hoverDelayMs ?? 65;
    this.fastPointerDelayMs = options.fastPointerDelayMs ?? 140;
    this.fastPointerVelocity = options.fastPointerVelocity ?? 1.1;

    if (isBrowser()) {
      window.addEventListener("pointermove", this.track, {
        capture: true,
        passive: true
      });
    }
  }

  schedule(element: Element, callback: () => void): void {
    this.cancel(element);

    const delay = this.currentVelocity() > this.fastPointerVelocity
      ? this.fastPointerDelayMs
      : this.hoverDelayMs;

    const timeout = window.setTimeout(() => {
      this.cleanups.delete(element);
      callback();
    }, delay);

    const cleanup = () => {
      window.clearTimeout(timeout);
      this.cleanups.delete(element);
    };

    this.cleanups.set(element, cleanup);
  }

  cancel(element: Element): void {
    this.cleanups.get(element)?.();
  }

  destroy(): void {
    if (isBrowser()) {
      window.removeEventListener("pointermove", this.track, {
        capture: true
      } as AddEventListenerOptions);
    }
    for (const cleanup of Array.from(this.cleanups.values())) cleanup();
  }

  private readonly track = (event: PointerEvent): void => {
    this.previous = this.last;
    this.last = {
      x: event.clientX,
      y: event.clientY,
      time: performance.now()
    };
  };

  private currentVelocity(): number {
    if (!this.last || !this.previous) return 0;
    const distance = Math.hypot(
      this.last.x - this.previous.x,
      this.last.y - this.previous.y
    );
    const elapsed = Math.max(1, this.last.time - this.previous.time);
    return distance / elapsed;
  }
}
