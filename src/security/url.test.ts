import { describe, expect, it } from "vitest";
import { classifyHref, sanitizeHref } from "./url.js";

describe("URL classification", () => {
  it("blocks javascript URLs", () => {
    const result = classifyHref(" javascript:alert(1)");
    expect(result.isUnsafe).toBe(true);
    expect(result.safeHref).toBe("#");
    expect(sanitizeHref("javascript:alert(1)")).toBe("#");
  });

  it("classifies root-relative links without needing a URL object", () => {
    const result = classifyHref("/dashboard");
    expect(result.isUnsafe).toBe(false);
    expect(result.isExternal).toBe(false);
    expect(result.safeHref).toBe("/dashboard");
  });

  it("supports URL objects", () => {
    const result = classifyHref(
      new URL("https://example.com/settings"),
      "https://example.com"
    );
    expect(result.isExternal).toBe(false);
    expect(result.href).toBe("https://example.com/settings");
  });
});
