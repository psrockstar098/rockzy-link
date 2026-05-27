import { getCurrentOrigin } from "../environment.js";

export type HrefLike = string | URL;

export interface ClassifiedHref {
  href: string;
  safeHref: string;
  isExternal: boolean;
  isHash: boolean;
  isSpecialProtocol: boolean;
  isUnsafe: boolean;
  protocol?: string;
  url?: URL;
  reason?: string;
}

const UNSAFE_PROTOCOLS = new Set(["javascript:", "vbscript:", "data:"]);
const SPECIAL_PROTOCOLS = new Set(["mailto:", "tel:", "blob:"]);
const HTTP_PROTOCOLS = new Set(["http:", "https:"]);
const FALLBACK_ORIGIN = "https://production-link.invalid";

export function getHrefString(href: HrefLike): string {
  return href instanceof URL ? href.href : String(href);
}

export function isUnsafeHref(href: HrefLike): boolean {
  return classifyHref(href).isUnsafe;
}

export function sanitizeHref(href: HrefLike): string {
  return classifyHref(href).safeHref;
}

export function classifyHref(
  hrefLike: HrefLike,
  baseOrigin = getCurrentOrigin()
): ClassifiedHref {
  const rawHref = getHrefString(hrefLike);
  const href = rawHref.trim();

  if (href.length === 0) {
    return {
      href,
      safeHref: "#",
      isExternal: false,
      isHash: false,
      isSpecialProtocol: false,
      isUnsafe: true,
      reason: "empty href"
    };
  }

  if (href.startsWith("#")) {
    return {
      href,
      safeHref: href,
      isExternal: false,
      isHash: true,
      isSpecialProtocol: false,
      isUnsafe: false
    };
  }

  const protocol = fastProtocol(href);
  if (protocol && UNSAFE_PROTOCOLS.has(protocol)) {
    return {
      href,
      safeHref: "#",
      isExternal: true,
      isHash: false,
      isSpecialProtocol: true,
      isUnsafe: true,
      protocol,
      reason: `${protocol} URLs are blocked`
    };
  }

  if (protocol && SPECIAL_PROTOCOLS.has(protocol)) {
    return {
      href,
      safeHref: href,
      isExternal: true,
      isHash: false,
      isSpecialProtocol: true,
      isUnsafe: false,
      protocol
    };
  }

  if (isFastInternalRelative(href)) {
    return {
      href,
      safeHref: href,
      isExternal: false,
      isHash: false,
      isSpecialProtocol: false,
      isUnsafe: false
    };
  }

  if (href.startsWith("//")) {
    return classifyAbsoluteLike(href, baseOrigin);
  }

  if (protocol && !HTTP_PROTOCOLS.has(protocol)) {
    return {
      href,
      safeHref: href,
      isExternal: true,
      isHash: false,
      isSpecialProtocol: true,
      isUnsafe: false,
      protocol
    };
  }

  return classifyAbsoluteLike(href, baseOrigin);
}

function classifyAbsoluteLike(
  href: string,
  baseOrigin = getCurrentOrigin()
): ClassifiedHref {
  try {
    const base = baseOrigin ?? FALLBACK_ORIGIN;
    const url = new URL(href, base);
    const isFallback = base === FALLBACK_ORIGIN;
    const isExternal = isFallback
      ? url.origin !== FALLBACK_ORIGIN && isAbsoluteHttpUrl(href)
      : url.origin !== base;

    return {
      href,
      safeHref: href,
      isExternal,
      isHash: false,
      isSpecialProtocol: false,
      isUnsafe: false,
      protocol: url.protocol,
      url
    };
  } catch {
    return {
      href,
      safeHref: "#",
      isExternal: true,
      isHash: false,
      isSpecialProtocol: true,
      isUnsafe: true,
      reason: "invalid URL"
    };
  }
}

function isFastInternalRelative(href: string): boolean {
  const first = href[0];
  if (first === "/" && href[1] !== "/") return true;
  if (first === ".") return true;
  if (first === "?") return true;
  return !fastProtocol(href) && !href.startsWith("//");
}

function isAbsoluteHttpUrl(href: string): boolean {
  const lower = href.slice(0, 8).toLowerCase();
  return lower.startsWith("http://") || lower.startsWith("https://");
}

function fastProtocol(href: string): string | undefined {
  const max = Math.min(href.length, 32);
  for (let index = 0; index < max; index += 1) {
    const char = href.charCodeAt(index);
    if (char === 58) {
      return href.slice(0, index + 1).toLowerCase();
    }
    if (char === 47 || char === 63 || char === 35) {
      return undefined;
    }
  }
  return undefined;
}
