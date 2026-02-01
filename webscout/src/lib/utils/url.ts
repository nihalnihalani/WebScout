export function extractUrlPattern(url: string): string {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.replace(/^www\./, "");
    const pathSegments = parsed.pathname
      .split("/")
      .filter(Boolean)
      .map((segment) => {
        if (/^[a-f0-9-]{8,}$/i.test(segment)) return "*";
        if (/^\d{4,}$/.test(segment)) return "*";
        if (/^B[A-Z0-9]{9}$/.test(segment)) return "*";
        if (/^[a-z0-9_-]+_\d+$/i.test(segment)) return "*";
        return segment;
      });
    return `${hostname}/${pathSegments.join("/")}`;
  } catch {
    return url;
  }
}

export function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const trackingParams = [
      "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
      "ref", "ref_", "tag", "source", "fbclid", "gclid", "mc_cid", "mc_eid",
    ];
    trackingParams.forEach((p) => parsed.searchParams.delete(p));
    return parsed.toString();
  } catch {
    return url;
  }
}
