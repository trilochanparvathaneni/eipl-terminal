# TerminalFlow (EIPL Terminal)

Multi-tenant SaaS platform for LPG / bulk-liquid terminal operations — appointments, gate management, safety, and turnaround tracking.

## Quick Start

```bash
# 1. Start PostgreSQL
docker compose up -d db

# 2. Install dependencies
npm install

# 3. Run migrations & seed
npx prisma migrate dev
npm run seed

# 4. Start dev server
npm run dev          # → http://localhost:3000
```

Default demo credentials — password for all accounts is `password123`:

| Role            | Email                     |
|-----------------|---------------------------|
| Super Admin     | superadmin@eipl.com       |
| Terminal Admin  | admin@eipl.com            |
| Client (IOC)    | client@ioc.com            |
| Transporter     | dispatch@safehaul.com     |
| Security        | security@eipl.com         |
| Surveyor        | surveyor@eipl.com         |
| HSE Officer     | hse@eipl.com              |
| Auditor         | auditor@eipl.com          |

---

## Multi-Tenancy

Tenants are resolved in this order:

1. **Subdomain** — `{tenant}.app.terminalflow.io` → slug = first subdomain segment (requires ≥ 4 hostname parts)
2. **`x-tenant` header** — set explicitly by API clients or during local dev
3. **Default** — falls back to `eipl`

The middleware (`src/middleware.ts`) extracts the slug and injects it as the `x-tenant` request header so every route handler can read it.

### Local development with tenants

Since `localhost` has no subdomain, use the header approach:

```bash
# Default tenant (eipl)
curl http://localhost:3000/api/v1/tenants/me \
  -H "Cookie: <session-cookie>"

# Explicit tenant via header
curl http://localhost:3000/api/v1/tenants/me \
  -H "x-tenant: acme" \
  -H "Cookie: <session-cookie>"
```

---

## Server-Side RBAC

All API authorization is enforced server-side via `authorize()` in `src/lib/auth/authorize.ts`.

```typescript
import { authorize } from "@/lib/auth/authorize"
import { P } from "@/lib/auth/permissions"

export async function GET(request: NextRequest) {
  const { ctx, error } = await authorize({
    permission: P.APPOINTMENTS_READ,
    headers: request.headers,
  })
  if (error) return error  // 401 or 403

  // ctx.user, ctx.tenantSlug, ctx.requestId are available
}
```

Permission constants live in `src/lib/auth/permissions.ts`. Role → permission mappings are in `src/lib/rbac.ts` (legacy keys) and `src/lib/auth/authorize.ts` (v1 keys).

### Example API calls

```bash
# Get current tenant + user context
curl http://localhost:3000/api/v1/tenants/me \
  -H "Cookie: <session-cookie>"

# List appointments (tenant-scoped)
curl http://localhost:3000/api/v1/appointments \
  -H "Cookie: <session-cookie>"

# Create appointment (requires appointments.write permission)
curl -X POST http://localhost:3000/api/v1/appointments \
  -H "Content-Type: application/json" \
  -H "Cookie: <session-cookie>" \
  -d '{
    "terminalId": "<terminal-id>",
    "clientId": "<client-id>",
    "productId": "<product-id>",
    "quantityRequested": 20,
    "date": "2025-01-15"
  }'
```

Error responses follow a consistent shape:

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "Missing permission: appointments.write",
    "requestId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
  }
}
```

---

## Integrations Framework

### Connectors

A connector adapts an external system (ERP, TMS, WMS) to a standard interface:

```
src/integrations/
  index.ts              ← registry (getConnector, listConnectors)
  types.ts              ← Connector, ConnectorConfig interfaces
  connectors/
    sample-erp/index.ts ← example connector
```

To add a new connector:

1. Create `src/integrations/connectors/<name>/index.ts`
2. Implement the `Connector` interface (`healthCheck`, `pushEvent`)
3. Register it in `src/integrations/index.ts`

### Webhooks (Inbound)

```bash
# Send a webhook with HMAC signature
BODY='{"eventType":"order.shipped","aggregateId":"ord-123","payload":{"trackingNo":"TN001"}}'
SIG="sha256=$(echo -n $BODY | openssl dgst -sha256 -hmac 'whsec_dev_secret' | awk '{print $2}')"

curl -X POST http://localhost:3000/api/v1/webhooks \
  -H "Content-Type: application/json" \
  -H "x-webhook-signature: $SIG" \
  -d "$BODY"
```

Signature verification uses HMAC-SHA256 with timing-safe comparison (`src/integrations/webhooks/verify.ts`).

### Transactional Outbox

Domain events (e.g. `appointment.created`) are written to an in-memory outbox before being pushed to connectors. This guarantees at-least-once delivery even if the connector is down.

```
src/lib/outbox/
  types.ts       ← OutboxEvent, EnqueueParams
  outboxRepo.ts  ← in-memory store (replace with DB table)
  publisher.ts   ← enqueueEvent(), flushPendingEvents()
```

---

## Branding / White-Label

Branding is driven by `src/lib/brand/theme.ts`. Each tenant can override:

- `productName` — app title
- `tagline` — subtitle
- `logoSrc` — path to logo image
- `primaryHsl` / `primaryHslDark` — theme colour

To add a new tenant's branding:

1. Add logo to `public/images/tenants/<slug>/logo.png`
2. Add an entry to `TENANT_THEMES` in `src/lib/brand/theme.ts`
3. The `<BrandLockup>` and `<BrandMark>` components will pick it up automatically

---

## Project Structure

```
src/
  app/
    api/
      v1/
        tenants/me/route.ts    ← tenant context endpoint
        appointments/route.ts  ← tenant-scoped CRUD
        webhooks/route.ts      ← inbound webhook receiver
      auth/                    ← NextAuth routes
      bookings/                ← legacy booking routes
      ...
    dashboard/                 ← main dashboard page
    login/                     ← login page (uses BrandLockup)
  components/
    brand/
      BrandMark.tsx            ← icon-only component
      BrandLockup.tsx          ← icon + name + tagline
    layout/
      sidebar.tsx              ← uses BrandLockup
      app-layout.tsx
      notification-bell.tsx
  integrations/
    index.ts                   ← connector registry
    types.ts
    connectors/sample-erp/
    webhooks/
  lib/
    auth/
      authorize.ts             ← server-side RBAC gate
      permissions.ts           ← permission constants
    brand/theme.ts             ← theme tokens + per-tenant overrides
    outbox/                    ← transactional outbox
    tenant/
      types.ts
      resolveTenant.ts
      tenantRepo.ts
    rbac.ts                    ← role → permission mapping
    auth.ts                    ← NextAuth config
    auth-utils.ts              ← session helpers
    prisma.ts
  middleware.ts                ← tenant resolution middleware
```
