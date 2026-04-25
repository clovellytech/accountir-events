/**
 * Validate an API key from an Authorization header value.
 * Returns true if no apiKey is configured (auth disabled) or if the key matches.
 */
export function validateApiKey(
  authHeader: string | null | undefined,
  apiKey: string | undefined,
): { ok: true } | { ok: false; error: string } {
  if (!apiKey) {
    return { ok: true }
  }

  if (!authHeader) {
    return { ok: false, error: "Missing Authorization header" }
  }

  const parts = authHeader.split(" ")
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    return {
      ok: false,
      error: "Invalid Authorization header format, expected: Bearer <key>",
    }
  }

  if (parts[1] !== apiKey) {
    return { ok: false, error: "Invalid API key" }
  }

  return { ok: true }
}
