/**
 * Who may read /ratings. Kept apart from the page so the rule is a plain
 * predicate that can be tested, rather than something only observable as a
 * 404 in a browser.
 *
 * The rule: with TRIVEAL_ADMIN_TOKEN set, the request needs a matching `key`.
 * With it unset the page is open in development and absent in production —
 * an unconfigured deploy must never expose answers.
 */

import { timingSafeEqual } from "node:crypto";

/**
 * Constant-time token compare, whitespace-insensitive at the edges.
 *
 * Both sides are trimmed because a token pasted into a hosting dashboard
 * routinely picks up a trailing newline, and an exact byte compare would then
 * 404 with no hint as to why — the failure looks identical to "wrong key" and
 * to "page doesn't exist". Whitespace is never meaningful in a token, so
 * ignoring it at the edges costs nothing and removes a genuinely baffling
 * failure mode. Everything inside the token still has to match exactly.
 */
export function tokenMatches(provided: string | undefined, expected: string): boolean {
  const a = Buffer.from(provided?.trim() ?? "");
  const b = Buffer.from(expected.trim());
  if (a.length === 0 || b.length === 0) return false;
  // timingSafeEqual throws on a length mismatch, so that case is its own check.
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Whether this request may see the review page.
 *
 * A token of only whitespace counts as unset — it can't be matched by any
 * URL, so treating it as configured would lock the page away silently instead
 * of falling back to the documented dev-open / prod-absent behaviour.
 */
export function adminAccessAllowed(
  providedKey: string | undefined,
  configuredToken: string | undefined,
  isProduction: boolean,
): boolean {
  const token = configuredToken?.trim();
  if (token) return tokenMatches(providedKey, token);
  return !isProduction;
}
