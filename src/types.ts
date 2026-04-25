export type AccountirEventType =
  | "sale"
  | "purchase_order"
  | "inventory_adjustment"

// -- Sale --

export interface SaleItem {
  name: string
  qty: number
  unit_price_cents: number
  unit_cost_cents: number
}

export interface SaleEvent {
  date: string
  reference?: string
  memo?: string
  items: SaleItem[]
  payment_method: "cash" | "square"
  tax_collected_cents?: number
}

// -- Purchase Order --

export interface PurchaseItem {
  name: string
  qty: number
  unit_cost_cents: number
}

export interface PurchaseOrderEvent {
  date: string
  reference?: string
  memo?: string
  supplier?: string
  items: PurchaseItem[]
  payment: "cash" | "on_credit"
}

// -- Inventory Adjustment --

export interface AdjustmentItem {
  name: string
  qty_delta: number
  unit_cost_cents: number
  reason?: string
}

export interface InventoryAdjustmentEvent {
  date: string
  reference?: string
  memo?: string
  items: AdjustmentItem[]
}

// -- Event data union --

export type AccountirEventData =
  | SaleEvent
  | PurchaseOrderEvent
  | InventoryAdjustmentEvent

// -- Stored event envelope --

export interface AccountirEvent<
  T extends AccountirEventData = AccountirEventData,
> {
  id: string
  type: AccountirEventType
  data: T
  timestamp: string
}

// -- API response --

export interface EventsResponse {
  events: AccountirEvent[]
  cursor: string | null
  has_more: boolean
}
