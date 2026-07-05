# accountir-events

TypeScript SDK for producing accounting events that [accountir](https://github.com/user/accountir) can sync. Any app that records sales, refunds, purchase orders, goods receipts, or inventory adjustments can use this library to make those events available to accountir's pull-based sync.

## How it works

1. Your app records business events using the `AccountirEventStore` interface
2. You mount the included HTTP handler, which serves a cursor-paginated events API
3. accountir periodically pulls new events from that API and translates them into double-entry journal entries

## Install

```sh
pnpm add accountir-events
```

If you're using the H3 adapter (SolidStart, Nitro, Nuxt):

```sh
pnpm add accountir-events h3
```

## Usage

### 1. Implement the event store

The `AccountirEventStore` interface has two methods: `append` and `list`. Back it with whatever database you use.

```ts
import type { AccountirEventStore } from "accountir-events"

export const accountirStore: AccountirEventStore = {
  async append(type, data) {
    // Insert into your accountir_events table
    // Return: { id, type, data, timestamp }
  },
  async list({ since, limit } = {}) {
    // Query events after the cursor, up to limit
    // Return: { events, cursor, has_more }
  },
}
```

A `MemoryEventStore` is included for testing:

```ts
import { MemoryEventStore } from "accountir-events"

const store = new MemoryEventStore()
```

### 2. Record events from your business logic

```ts
// Record a POS sale
await store.append("sale", {
  date: "2026-04-25",
  reference: "POS-20260425-001",
  items: [
    {
      name: "Continental GP5000 700c",
      qty: 2,
      unit_price_cents: 6999,
      unit_cost_cents: 3500,
    },
  ],
  payment_method: "square",
  tax_collected_cents: 1120,
})

// Record a refund / return (reverse of a sale)
await store.append("refund", {
  date: "2026-04-26",
  reference: "REFUND-20260426-001",
  items: [
    {
      name: "Continental GP5000 700c",
      qty: 1,
      unit_price_cents: 6999,
      unit_cost_cents: 3500,
    },
  ],
  payment_method: "square",
  tax_refunded_cents: 560,
  restock: true,
})

// Place a purchase order (commitment — no journal entry yet)
await store.append("purchase_order", {
  date: "2026-04-20",
  reference: "PO-2026-042",
  supplier: "Shimano",
  items: [
    { name: "CN-HG701 Chain", qty: 20, unit_cost_cents: 2499 },
  ],
  expected_delivery_date: "2026-05-01",
})

// Goods received from vendor (creates inventory entry + AP bill)
await store.append("goods_received", {
  date: "2026-05-01",
  reference: "GR-2026-042",
  supplier: "Shimano",
  items: [
    { name: "CN-HG701 Chain", qty: 20, unit_cost_cents: 2499 },
  ],
  purchase_order_reference: "PO-2026-042",
  payment_terms: "net30",
})

// Record an inventory adjustment
await store.append("inventory_adjustment", {
  date: "2026-04-24",
  items: [
    { name: "Tube 700x25c", qty_delta: -3, unit_cost_cents: 350, reason: "damaged" },
  ],
})
```

### 3. Serve the events API

#### SolidStart / Nitro / H3

Create an API route at `src/routes/api/accounting/events.ts`:

```ts
import { createAccountirH3Handler } from "accountir-events/h3"
import { accountirStore } from "~/lib/accountir"

export default createAccountirH3Handler(accountirStore, {
  apiKey: process.env.ACCOUNTIR_API_KEY,
})
```

#### Other frameworks

Use `createEventsHandler` directly and adapt to your framework:

```ts
import { createEventsHandler } from "accountir-events"

const handler = createEventsHandler(store, { apiKey: "secret" })

// handler takes { query, authHeader } and returns { status, body }
const result = await handler({
  query: { since: "evt_42", limit: "100" },
  authHeader: "Bearer secret",
})
// result.status === 200
// result.body === { events: [...], cursor: "evt_50", has_more: false }
```

## Event types

### Sale

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `date` | string | yes | `YYYY-MM-DD` |
| `reference` | string | no | Unique ID for idempotency |
| `memo` | string | no | Description |
| `items` | SaleItem[] | yes | At least one item |
| `items[].name` | string | yes | Product name |
| `items[].qty` | number | yes | Quantity sold |
| `items[].unit_price_cents` | number | yes | Retail price per unit |
| `items[].unit_cost_cents` | number | yes | Cost per unit (for COGS) |
| `payment_method` | string | yes | `"cash"` or `"square"` |
| `tax_collected_cents` | number | no | Sales tax in cents |

Posts: **DR** payment (revenue + tax) / **CR** sales revenue / **CR** sales tax payable (if any); **DR** COGS / **CR** inventory when items carry a cost.

### Refund

A refund or return — the reverse of a sale. The returned revenue is booked against a contra-revenue account (map it to e.g. `Income:refunds`) so it subtracts from income.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `date` | string | yes | `YYYY-MM-DD` |
| `reference` | string | no | Unique ID for idempotency |
| `memo` | string | no | Description |
| `items` | SaleItem[] | yes | Returned items (same shape as a sale's) |
| `items[].name` | string | yes | Product name |
| `items[].qty` | number | yes | Quantity returned |
| `items[].unit_price_cents` | number | yes | Refunded price per unit (drives the contra-revenue) |
| `items[].unit_cost_cents` | number | yes | Cost per unit (drives restock / COGS reversal) |
| `payment_method` | string | yes | `"cash"` or `"square"` — how the money is returned |
| `tax_refunded_cents` | number | no | Sales tax refunded, in cents |
| `restock` | boolean | no | Put items back in inventory. Defaults to `true` |

Posts: **DR** refunds (returned revenue) / **CR** payment (revenue + tax) / **DR** sales tax payable (if any); **DR** inventory / **CR** COGS when `restock` and items carry a cost. Restock lines only post when items have a non-zero `unit_cost_cents`, so a goodwill refund just reverses revenue and tax.

### Purchase Order

A commitment to buy from a vendor. No journal entry is created — this is an off-ledger record. Use `goods_received` when inventory actually arrives.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `date` | string | yes | `YYYY-MM-DD` |
| `reference` | string | no | Unique ID for idempotency |
| `memo` | string | no | Description |
| `supplier` | string | no | Supplier name |
| `items` | PurchaseItem[] | yes | At least one item |
| `items[].name` | string | yes | Product name |
| `items[].qty` | number | yes | Quantity ordered |
| `items[].unit_cost_cents` | number | yes | Cost per unit |
| `expected_delivery_date` | string | no | `YYYY-MM-DD` |

### Goods Received

Inventory arrives from a vendor. Creates a journal entry (DR inventory / CR accounts payable) and an AP bill with due date tracking.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `date` | string | yes | `YYYY-MM-DD` |
| `reference` | string | no | Unique ID for idempotency |
| `memo` | string | no | Description |
| `supplier` | string | no | Supplier name |
| `items` | PurchaseItem[] | yes | At least one item |
| `items[].name` | string | yes | Product name |
| `items[].qty` | number | yes | Quantity received |
| `items[].unit_cost_cents` | number | yes | Cost per unit |
| `purchase_order_reference` | string | no | Links to the original PO |
| `payment_terms` | string | no | `"net30"`, `"net60"`, `"due-on-receipt"`, etc. Defaults to net30 |

### Inventory Adjustment

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `date` | string | yes | `YYYY-MM-DD` |
| `reference` | string | no | Unique ID for idempotency |
| `memo` | string | no | Description |
| `items` | AdjustmentItem[] | yes | At least one item |
| `items[].name` | string | yes | Product name |
| `items[].qty_delta` | number | yes | Negative = loss, positive = found |
| `items[].unit_cost_cents` | number | yes | Cost per unit for valuation |
| `items[].reason` | string | no | e.g. `"shrinkage"`, `"damaged"` |

## API endpoint

The served endpoint responds to:

```
GET /api/accounting/events?since=<cursor>&limit=100
Authorization: Bearer <api-key>
```

Response:

```json
{
  "events": [
    {
      "id": "evt_1",
      "type": "sale",
      "data": { ... },
      "timestamp": "2026-04-25T14:30:00.000Z"
    }
  ],
  "cursor": "evt_1",
  "has_more": false
}
```

- `since` — return events after this cursor (omit for all events)
- `limit` — max events per page (default 100, max 1000)
- `cursor` — pass as `since` in the next request to paginate
- `has_more` — whether more events exist beyond this page

## Authentication

Pass `apiKey` when creating the handler to require `Authorization: Bearer <key>` on all requests. Omit it to disable auth (only appropriate for local development).

## Development

```sh
pnpm install
pnpm build
pnpm test
pnpm format:check
```

## Publishing

CI runs on every push to `main` and on pull requests. Publishing to npm happens automatically when a version tag is pushed.

To release a new version:

```sh
# Update version in package.json
pnpm version patch   # or minor, major

# Push the commit and tag
git push && git push --tags
```

The `publish` GitHub Action will run tests, build, and publish to npm.

### Setup (one-time)

This repo uses [npm trusted publishing](https://docs.npmjs.com/generating-provenance-statements#publishing-packages-with-provenance-via-github-actions) via GitHub Actions OIDC — no npm token needed.

1. On npmjs.com, go to the package **Settings > Publishing access > Configure trusted publishing**
2. Add a trusted publisher with your GitHub username, repo name `accountir-events`, and workflow filename `publish.yml`

## License

MIT
