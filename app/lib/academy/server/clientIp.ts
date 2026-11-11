import { isIP } from "node:net";

/**
 * Trusted client IP for auth rate buckets.
 *
 * Caddy overwrites `X-SFA-Client-IP` with `{http.request.remote.host}` before
 * the request reaches Next (see install.sh). sslip.io is not a public suffix,
 * and SameSite does not replace this check.
 *
 * `X-Forwarded-For` is ignored: a browser can prepend spoofed hops, and Caddy
 * appends rather than replaces that header by default.
 * If the trusted header is missing or not a single IP, every such request
 * shares the bucket "unobserved" instead of trusting a client-supplied chain.
 */
export const UNOBSERVED_CLIENT_IP = "unobserved";
export const TRUSTED_CLIENT_IP_HEADER = "x-sfa-client-ip";

export function trustedClientIp(req: Pick<Request, "headers">): string {
  const raw = req.headers.get(TRUSTED_CLIENT_IP_HEADER);
  if (raw == null) return UNOBSERVED_CLIENT_IP;
  if (raw !== raw.trim()) return UNOBSERVED_CLIENT_IP;
  if (raw.length === 0 || raw.length > 64) return UNOBSERVED_CLIENT_IP;
  if (/[\s,]/.test(raw)) return UNOBSERVED_CLIENT_IP;
  if (isIP(raw) === 0) return UNOBSERVED_CLIENT_IP;
  return raw;
}
