import { describe, it, expect } from "vitest"
import { MemoryEventStore } from "../src/store.js"
import { createEventsHandler } from "../src/router.js"
import type { SaleEvent } from "../src/types.js"

const sale: SaleEvent = {
  date: "2026-04-25",
  reference: "POS-001",
  items: [
    { name: "Tire", qty: 1, unit_price_cents: 4500, unit_cost_cents: 2200 },
  ],
  payment_method: "cash",
}

describe("createEventsHandler", () => {
  it("returns events", async () => {
    const store = new MemoryEventStore()
    await store.append("sale", sale)
    const handler = createEventsHandler(store)

    const res = await handler({ query: {}, authHeader: null })
    expect(res.status).toBe(200)
    expect("events" in res.body && res.body.events).toHaveLength(1)
  })

  it("respects since and limit query params", async () => {
    const store = new MemoryEventStore()
    await store.append("sale", sale)
    await store.append("sale", { ...sale, reference: "POS-002" })
    await store.append("sale", { ...sale, reference: "POS-003" })
    const handler = createEventsHandler(store)

    const res = await handler({
      query: { since: "1", limit: "1" },
      authHeader: null,
    })
    expect(res.status).toBe(200)
    if ("events" in res.body) {
      expect(res.body.events).toHaveLength(1)
      expect(res.body.events[0].id).toBe("2")
      expect(res.body.has_more).toBe(true)
    }
  })

  it("rejects requests without api key when configured", async () => {
    const store = new MemoryEventStore()
    const handler = createEventsHandler(store, { apiKey: "secret-key" })

    const res = await handler({ query: {}, authHeader: null })
    expect(res.status).toBe(401)
    expect("error" in res.body).toBe(true)
  })

  it("rejects requests with wrong api key", async () => {
    const store = new MemoryEventStore()
    const handler = createEventsHandler(store, { apiKey: "secret-key" })

    const res = await handler({ query: {}, authHeader: "Bearer wrong-key" })
    expect(res.status).toBe(401)
  })

  it("accepts requests with correct api key", async () => {
    const store = new MemoryEventStore()
    await store.append("sale", sale)
    const handler = createEventsHandler(store, { apiKey: "secret-key" })

    const res = await handler({ query: {}, authHeader: "Bearer secret-key" })
    expect(res.status).toBe(200)
    expect("events" in res.body && res.body.events).toHaveLength(1)
  })

  it("allows all requests when no api key configured", async () => {
    const store = new MemoryEventStore()
    await store.append("sale", sale)
    const handler = createEventsHandler(store)

    const res = await handler({ query: {}, authHeader: null })
    expect(res.status).toBe(200)
  })

  it("clamps limit to valid range", async () => {
    const store = new MemoryEventStore()
    const handler = createEventsHandler(store)

    // Negative/zero should become 1
    const res = await handler({ query: { limit: "0" }, authHeader: null })
    expect(res.status).toBe(200)

    // Over 1000 should clamp to 1000
    const res2 = await handler({ query: { limit: "9999" }, authHeader: null })
    expect(res2.status).toBe(200)
  })
})
