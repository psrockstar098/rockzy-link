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
});
