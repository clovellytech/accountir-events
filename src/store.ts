import type {
  AccountirEvent,
  AccountirEventData,
  AccountirEventType,
  EventsResponse,
} from "./types.js"

export interface AccountirEventStore {
  append(
    type: AccountirEventType,
    data: AccountirEventData,
  ): Promise<AccountirEvent>
  list(opts?: { since?: string; limit?: number }): Promise<EventsResponse>
}

/**
 * In-memory event store for testing and development.
 * Not suitable for production — use your own database-backed implementation.
 */
export class MemoryEventStore implements AccountirEventStore {
  private events: AccountirEvent[] = []
  private nextId = 1

  async append(
    type: AccountirEventType,
    data: AccountirEventData,
  ): Promise<AccountirEvent> {
    const event: AccountirEvent = {
      id: String(this.nextId++),
      type,
      data,
      timestamp: new Date().toISOString(),
    }
    this.events.push(event)
    return event
  }

  async list(opts?: {
    since?: string
    limit?: number
  }): Promise<EventsResponse> {
    const limit = opts?.limit ?? 100
    const since = opts?.since

    let startIndex = 0
    if (since) {
      const idx = this.events.findIndex((e) => e.id === since)
      if (idx !== -1) {
        startIndex = idx + 1
      }
    }

    const slice = this.events.slice(startIndex, startIndex + limit)
    const hasMore = startIndex + limit < this.events.length

    return {
      events: slice,
      cursor: slice.length > 0 ? slice[slice.length - 1].id : null,
      has_more: hasMore,
    }
  }
}
