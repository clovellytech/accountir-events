import { validateApiKey } from "./auth.js"
import type { AccountirEventStore } from "./store.js"
import type { EventsResponse } from "./types.js"

export interface HandlerRequest {
  query: Record<string, string | undefined>
  authHeader: string | null | undefined
}

export interface HandlerResponse {
  status: number
  body: EventsResponse | { error: string }
}

export interface AccountirEventsHandlerOptions {
  apiKey?: string
}

/**
 * Framework-agnostic handler for the accounting events endpoint.
 * Adapters (H3, Express, etc.) wrap this with framework-specific glue.
 */
export function createEventsHandler(
  store: AccountirEventStore,
  opts?: AccountirEventsHandlerOptions,
) {
  return async (req: HandlerRequest): Promise<HandlerResponse> => {
    const auth = validateApiKey(req.authHeader, opts?.apiKey)
    if (!auth.ok) {
      return { status: 401, body: { error: auth.error } }
    }

    const since = req.query.since
    const limitStr = req.query.limit
    const limit = limitStr
      ? Math.min(Math.max(parseInt(limitStr, 10) || 100, 1), 1000)
      : 100

    const result = await store.list({ since, limit })

    return { status: 200, body: result }
  }
}
