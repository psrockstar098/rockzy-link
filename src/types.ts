export type Href = string | URL;
export type PrefetchBehavior = "hover" | "viewport" | "idle" | "none";
export type PrefetchPriority = "high" | "medium" | "low";
export type ScrollBehavior = "auto" | "smooth" | "instant";

export interface LinkRouter {
  push: (
    href: string,
    opts?: { replace?: boolean; state?: unknown }
  ) => void | Promise<void>;
  prefetch?: (href: string) => void | Promise<void>;
}
