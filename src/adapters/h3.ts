import { defineEventHandler, getHeader, getQuery, setResponseStatus } from "h3"
import type { AccountirEventStore } from "../store.js"
import {
  createEventsHandler,
  type AccountirEventsHandlerOptions,
} from "../router.js"

/**
 * Create an H3 event handler for serving accounting events.
 *
 * Usage in SolidStart (src/routes/api/accounting/events.ts):
 *
 *   import { createAccountirH3Handler } from "accountir-events/h3"
 *   import { myStore } from "~/lib/accountir"
 *
 *   export default createAccountirH3Handler(myStore, {
 *     apiKey: process.env.ACCOUNTIR_API_KEY,
 *   })
 */
export function createAccountirH3Handler(
  store: AccountirEventStore,
  opts?: AccountirEventsHandlerOptions,
) {
  const handler = createEventsHandler(store, opts)

  return defineEventHandler(async (event) => {
    const query = getQuery(event) as Record<string, string | undefined>
    const authHeader = getHeader(event, "authorization")

    const result = await handler({ query, authHeader })

    setResponseStatus(event, result.status)
    return result.body
  })
}

export type { AccountirEventStore } from "../store.js"
export type { AccountirEventsHandlerOptions } from "../router.js"
