import { describe, it, expect } from "vitest"
import { MemoryEventStore } from "../src/store.js"
import type {
  SaleEvent,
  PurchaseOrderEvent,
  GoodsReceivedEvent,
  InventoryAdjustmentEvent,
} from "../src/types.js"

const sale: SaleEvent = {
  date: "2026-04-25",
  reference: "POS-001",
  items: [
    {
      name: "Tire 700c",
      qty: 2,
      unit_price_cents: 4500,
      unit_cost_cents: 2200,
    },
  ],
  payment_method: "square",
  tax_collected_cents: 720,
}

const po: PurchaseOrderEvent = {
  date: "2026-04-20",
  reference: "PO-042",
  supplier: "Shimano",
  items: [{ name: "Chain", qty: 10, unit_cost_cents: 1500 }],
  expected_delivery_date: "2026-05-01",
}

const goodsReceived: GoodsReceivedEvent = {
  date: "2026-05-01",
  reference: "GR-042",
  supplier: "Shimano",
  items: [{ name: "Chain", qty: 10, unit_cost_cents: 1500 }],
  purchase_order_reference: "PO-042",
  payment_terms: "net30",
}

const adj: InventoryAdjustmentEvent = {
  date: "2026-04-24",
  items: [
    { name: "Tube", qty_delta: -3, unit_cost_cents: 350, reason: "shrinkage" },
  ],
}

describe("MemoryEventStore", () => {
  it("appends and lists events", async () => {
    const store = new MemoryEventStore()

    const e1 = await store.append("sale", sale)
    expect(e1.id).toBe("1")
    expect(e1.type).toBe("sale")
    expect(e1.data).toEqual(sale)
    expect(e1.timestamp).toBeTruthy()

    const e2 = await store.append("purchase_order", po)
    expect(e2.id).toBe("2")
    expect(e2.type).toBe("purchase_order")

    const result = await store.list()
    expect(result.events).toHaveLength(2)
    expect(result.cursor).toBe("2")
    expect(result.has_more).toBe(false)
  })

  it("handles goods_received events", async () => {
    const store = new MemoryEventStore()

    const e1 = await store.append("goods_received", goodsReceived)
    expect(e1.id).toBe("1")
    expect(e1.type).toBe("goods_received")
    expect(e1.data).toEqual(goodsReceived)

    const result = await store.list()
    expect(result.events).toHaveLength(1)
    expect(result.events[0].type).toBe("goods_received")
  })

  it("supports full procurement flow", async () => {
    const store = new MemoryEventStore()

    // 1. PO placed (commitment)
    await store.append("purchase_order", po)

    // 2. Goods arrive (inventory + AP bill)
    await store.append("goods_received", goodsReceived)

    const result = await store.list()
    expect(result.events).toHaveLength(2)
    expect(result.events[0].type).toBe("purchase_order")
    expect(result.events[1].type).toBe("goods_received")
  })

  it("paginates with cursor", async () => {
    const store = new MemoryEventStore()

    await store.append("sale", sale)
    await store.append("goods_received", goodsReceived)
    await store.append("inventory_adjustment", adj)

    const page1 = await store.list({ limit: 2 })
    expect(page1.events).toHaveLength(2)
    expect(page1.has_more).toBe(true)
    expect(page1.cursor).toBe("2")

    const page2 = await store.list({ since: page1.cursor!, limit: 2 })
    expect(page2.events).toHaveLength(1)
    expect(page2.has_more).toBe(false)
    expect(page2.events[0].type).toBe("inventory_adjustment")
  })

  it("returns empty list when no events", async () => {
    const store = new MemoryEventStore()
    const result = await store.list()
    expect(result.events).toHaveLength(0)
    expect(result.cursor).toBeNull()
    expect(result.has_more).toBe(false)
  })

  it("returns empty when cursor is past all events", async () => {
    const store = new MemoryEventStore()
    await store.append("sale", sale)

    const result = await store.list({ since: "1" })
    expect(result.events).toHaveLength(0)
    expect(result.cursor).toBeNull()
    expect(result.has_more).toBe(false)
  })

  it("returns all events when cursor is unknown", async () => {
    const store = new MemoryEventStore()
    await store.append("sale", sale)
    await store.append("goods_received", goodsReceived)

    const result = await store.list({ since: "nonexistent" })
    expect(result.events).toHaveLength(2)
  })
})
