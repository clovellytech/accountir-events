export type AccountirEventType =
  | "sale"
  | "refund"
  | "purchase_order"
  | "goods_received"
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

// -- Refund / Return (the reverse of a sale) --

/**
 * A refund or return. Books the returned revenue against the `refunds`
 * contra-revenue account (so it subtracts from income), returns the money via
 * the payment method, reverses sales tax, and — when `restock` is set and the
 * returned items carry a unit cost — puts the items back into inventory and
 * reverses COGS.
 */
export interface RefundEvent {
  date: string
  reference?: string
  memo?: string
  items: SaleItem[]
  payment_method: "cash" | "square"
  tax_refunded_cents?: number
  /** Whether returned items go back into inventory. Defaults to true. */
  restock?: boolean
}

// -- Purchase Order (commitment — no journal entry) --

export interface PurchaseItem {
  name: string
  qty: number
  unit_cost_cents: number
}

/**
 * A purchase order placed with a vendor. This is a commitment to buy —
 * no journal entry is created until goods are received.
 *
 * @deprecated If your old code sends `purchase_order` with a `payment` field,
 * accountir will treat it as a legacy goods-received event for backwards compatibility.
 * New integrations should emit `goods_received` when inventory arrives.
 */
export interface PurchaseOrderEvent {
  date: string
  reference?: string
  memo?: string
  supplier?: string
  items: PurchaseItem[]
  expected_delivery_date?: string
  /** @deprecated Use `goods_received` event type instead. Kept for backwards compatibility. */
  payment?: "cash" | "on_credit"
}

// -- Goods Received (inventory arrives — creates journal entry + AP bill) --

/**
 * Goods received from a vendor. Creates a journal entry (DR inventory / CR AP)
 * and an accounts payable bill that tracks payment status and due date.
 */
export interface GoodsReceivedEvent {
  date: string
  reference?: string
  memo?: string
  supplier?: string
  items: PurchaseItem[]
  /** Reference to the original purchase order, if any */
  purchase_order_reference?: string
  /** Payment terms: "net30", "net60", "net90", "due-on-receipt", or number of days */
  payment_terms?: string
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
  | RefundEvent
  | PurchaseOrderEvent
  | GoodsReceivedEvent
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
