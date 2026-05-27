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
export declare function getHrefString(href: HrefLike): string;
export declare function isUnsafeHref(href: HrefLike): boolean;
export declare function sanitizeHref(href: HrefLike): string;
export declare function classifyHref(hrefLike: HrefLike, baseOrigin?: string | undefined): ClassifiedHref;
//# sourceMappingURL=url.d.ts.map