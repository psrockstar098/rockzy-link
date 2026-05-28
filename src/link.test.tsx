import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Link, LinkRuntimeProvider } from "./link.js";
import { createLinkRuntime } from "./runtime/link-runtime.js";

describe("Link", () => {
  it("sanitizes unsafe hrefs before render", () => {
    render(<Link href="javascript:alert(1)">Unsafe</Link>);
    expect(screen.getByRole("link", { name: "Unsafe" }).getAttribute("href")).toBe(
      "#"
    );
  });

  it("prevents async onBeforeNavigate from leaking to native navigation", async () => {
    const router = { push: vi.fn() };
    const runtime = createLinkRuntime({ offline: { enabled: false } });
    render(
      <LinkRuntimeProvider runtime={runtime}>
        <Link href="/blocked" router={router} onBeforeNavigate={() => false}>
          Blocked
        </Link>
      </LinkRuntimeProvider>
    );

    const link = screen.getByRole("link", { name: "Blocked" });
    link.dispatchEvent(
      new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        button: 0
      })
    );

    await Promise.resolve();
    expect(router.push).not.toHaveBeenCalled();
    runtime.destroy();
  });

  it("starts a high-priority prefetch on pointerdown", () => {
    const runtime = createLinkRuntime({ offline: { enabled: false } });
    const prefetch = vi
      .spyOn(runtime, "prefetch")
      .mockReturnValue(new AbortController());
    render(
      <LinkRuntimeProvider runtime={runtime}>
        <Link href="/pressed" prefetch="viewport">
          Pressed
        </Link>
      </LinkRuntimeProvider>
    );

    screen.getByRole("link", { name: "Pressed" }).dispatchEvent(
      new MouseEvent("pointerdown", {
        bubbles: true,
        cancelable: true,
        button: 0
      })
    );

    expect(prefetch).toHaveBeenCalledWith(
      "/pressed",
      expect.objectContaining({ priority: "high" })
    );
    runtime.destroy();
  });

  it("accepts React Router style to and preventScrollReset props", async () => {
    const runtime = createLinkRuntime({ offline: { enabled: false } });
    const navigate = vi.spyOn(runtime, "navigate");
    const router = { push: vi.fn() };

    render(
      <LinkRuntimeProvider runtime={runtime}>
        <Link to="/router-style" router={router} preventScrollReset>
          Router style
        </Link>
      </LinkRuntimeProvider>
    );

    screen.getByRole("link", { name: "Router style" }).dispatchEvent(
      new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        button: 0
      })
    );

    await Promise.resolve();
    expect(navigate).toHaveBeenCalledWith(
      "/router-style",
      expect.objectContaining({ scroll: false })
    );
    runtime.destroy();
  });

  it("accepts Next style boolean prefetch", () => {
    const runtime = createLinkRuntime({ offline: { enabled: false } });
    const prefetch = vi
      .spyOn(runtime, "prefetch")
      .mockReturnValue(new AbortController());

    render(
      <LinkRuntimeProvider runtime={runtime}>
        <Link href="/next-style" prefetch>
          Next style
        </Link>
      </LinkRuntimeProvider>
    );

    screen.getByRole("link", { name: "Next style" }).dispatchEvent(
      new MouseEvent("pointerdown", {
        bubbles: true,
        cancelable: true,
        button: 0
      })
    );

    expect(prefetch).toHaveBeenCalledWith(
      "/next-style",
      expect.objectContaining({ priority: "high" })
    );
    runtime.destroy();
  });

  it("runs runtime beforeNavigate guards as an async pipeline", async () => {
    const order: string[] = [];
    const router = { push: vi.fn() };
    const runtime = createLinkRuntime({ offline: { enabled: false } });

    runtime.beforeNavigate([
      async () => {
        order.push("auth");
      },
      () => {
        order.push("dirty-form");
        return false;
      }
    ]);

    await runtime.navigate("/guarded", { router });

    expect(order).toEqual(["auth", "dirty-form"]);
    expect(router.push).not.toHaveBeenCalled();
    runtime.destroy();
  });
});
