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

## Health Checks

Use these after the app is running:

```bash
# API/server liveness only (recommended for quick verification)
npm run health:demo

# Full verification (includes DB connectivity + migration status)
npm run health:full
```

Expected behavior:
- `health:demo` should pass when the server is up and API routes respond (protected routes typically return `401/403` without auth).
- `health:full` should pass only when database connectivity is available and Prisma migrations are fully applied.

Default demo credentials — password for all accounts is `password123`:

| Role               | Email                        |
|--------------------|------------------------------|
| Super Admin        | superadmin@eipl.com          |
| Terminal Admin     | admin@eipl.com               |
| Traffic Controller | controller@eipl.com          |
| Client             | client@tridentchemp.com      |
| Transporter        | dispatch@safehaul.com        |
| Transporter        | ops@speedtankers.com         |
| Security           | security@eipl.com            |
| HSE Officer        | hse@eipl.com                 |
| Surveyor           | surveyor@eipl.com            |
| Auditor            | auditor@eipl.com             |

---

## Arm-Level Contamination Control

Loading arms are the atomic unit of product assignment — not bays. Each bay has multiple arms, and each arm independently tracks its current product and changeover state.

### Contamination Rules (Non-Negotiable)

1. **Arm must be IDLE** — OCCUPIED, BLOCKED, or MAINTENANCE arms cannot be assigned.
2. **Empty arm** — If `currentProductId` is null, any product can be loaded.
3. **Same product** — If the arm's current product matches the booking product, assignment is allowed.
4. **Different product** — Both conditions must hold:
   - `changeoverState` must be `READY_FOR_CHANGEOVER`
   - A `ProductCompatibility` record must exist from the arm's current product to the requested product with `isCompatible = true`

These rules are enforced server-side in `POST /api/bookings/:id/assign-arm` and in `src/lib/arm-contamination.ts`.

### Changeover States

| State                  | Meaning |
|------------------------|---------|
| `NOT_ALLOWED`          | Arm is single-product, no changeover permitted |
| `NEEDS_CLEARANCE`      | Arm must be flushed/cleaned before switching products |
| `READY_FOR_CHANGEOVER` | Arm has been cleared and is ready for a new product |
| `IN_CHANGEOVER`        | Changeover is actively in progress |

### Gantry-1 Arm Assignments (Seed)

| Bay   | Arm 1    | Arm 2   | Arm 3    |
|-------|----------|---------|----------|
| G1B01 | LDO      | Acetone | N-Hexane |
| G1B02 | Methanol | MS      | N-Hexane |
| G1B03 | Empty    | MS      | Empty    |
| G1B04 | Methanol | Empty   | Methanol |
| G1B05 | Methanol | Empty   | Methanol |
| G1B06 | Methanol | LDO     | Methanol |
| G1B07 | Empty    | HSD     | ACN      |
| G1B08 | Empty    | HSD     | VAM      |

### Product Compatibility Highlights

- **Methanol ↔ HSD** — Incompatible (safety risk)
- **Methanol ↔ LDO** — Compatible, requires full clearance (45 min)
- **Acetone ↔ N-Hexane** — Compatible, requires clearance (30 min)
- **MS ↔ HSD** — Compatible (same product family, 15 min)
- **LPG** — Incompatible with all non-LPG products

Full compatibility matrix is in `prisma/seed.ts`.

---

## Compliance Gates & Custody Stages

### Custody Stage Flow

```
GATE_CHECKIN → SAFETY_APPROVED → DOCUMENTS_VERIFIED → WEIGH_IN
→ READY_FOR_BAY → LOADING_STARTED → LOADING_COMPLETED
→ WEIGH_OUT → SEALED → CUSTODY_TRANSFERRED → EXITED
```

Transitions are validated server-side in `POST /api/trips/:id/transition-stage`. Only allowed transitions are accepted (see `src/lib/custody-stages.ts`).

### Compliance Gates

Before a trip can reach `READY_FOR_BAY`, three gates must pass:

| Gate       | Check |
|------------|-------|
| SAFETY     | Latest `SafetyChecklist` for the booking must have `status = PASSED` |
| DOCUMENTS  | All mandatory `DocumentType` records with `allowedLinkTypes` containing `BOOKING` must have a `VERIFIED` `DocumentRecord` |
| STOP_WORK  | No active `StopWorkOrder` may exist for the booking |

Evaluated via `POST /api/trips/:id/evaluate-gates`. If all pass, trip moves to `READY_FOR_BAY`. If any fail, `priorityClass` is set to `BLOCKED`.

### Document Governance

- Clients upload documents via `/client/documents`
- Terminal Admins / Surveyors review and verify/reject via `/admin/documents-review`
- Each document is linked to a booking and a `DocumentType` (MSDS, COA, Ex-Bond, etc.)
- Mandatory document types must be verified before the DOCUMENTS gate passes

### Evidence Pack

`POST /api/trips/:id/generate-evidence-pack` generates a JSON bundle containing:
- Trip details, booking, truck, gate events
- All compliance gate results
- All verified documents
- Trip event ledger
- SHA-256 integrity hash

### Yard Console

Traffic Controllers access the Yard Console at `/controller/yard-console`. Three-column layout:
- **LEFT**: Gantry → Bay → Arm grid showing current product, status, and changeover state
- **CENTER**: Ready queue (trips at `READY_FOR_BAY`) with suggested compatible arms
- **RIGHT**: Compliance blocks (trips with `priorityClass = BLOCKED`)

### Testing the Compliance Flow

1. Log in as **controller@eipl.com** → navigate to Yard Console
2. The seed creates 5 demo bookings (BK26DEMO01–05) with various compliance states
3. BK26DEMO01 has all gates passed and is in the ready queue — assign it to a compatible arm
4. BK26DEMO02 is blocked (missing documents) — log in as **client@tridentchemp.com** to upload docs, then as **admin@eipl.com** to verify them
5. Re-evaluate gates to unblock the trip

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
      bookings/[id]/
        assign-arm/route.ts      ← arm assignment with contamination validation
      documents/route.ts         ← document upload + listing
      documents/[id]/
        verify/route.ts          ← document verification
        reject/route.ts          ← document rejection
      loading-arms/route.ts      ← loading arms listing (gantry filter)
      trips/[id]/
        evaluate-gates/route.ts  ← compliance gate evaluation
        transition-stage/route.ts ← custody stage transitions
        generate-evidence-pack/route.ts ← evidence pack generation
      truck-trips/route.ts       ← trip CRUD (custodyStage/priorityClass filters)
      v1/
        tenants/me/route.ts      ← tenant context endpoint
        appointments/route.ts    ← tenant-scoped CRUD
        webhooks/route.ts        ← inbound webhook receiver
      auth/                      ← NextAuth routes
    admin/
      documents-review/page.tsx  ← admin document verification queue
    client/
      documents/page.tsx         ← client document vault
    controller/
      yard-console/page.tsx      ← traffic controller yard console
    dashboard/                   ← main dashboard page
    login/                       ← login page
  components/
    brand/
      BrandMark.tsx              ← icon-only component
      BrandLockup.tsx            ← icon + name + tagline
    layout/
      sidebar.tsx                ← uses BrandLockup, dynamic nav
  lib/
    arm-contamination.ts         ← arm validation + matching logic
    custody-stages.ts            ← custody stage transition rules
    auth/
      authorize.ts               ← server-side RBAC gate
      permissions.ts             ← permission constants (P object)
    brand/theme.ts               ← theme tokens + per-tenant overrides
    rbac.ts                      ← role → permission mapping + nav items
    auth.ts                      ← NextAuth config
    prisma.ts
  middleware.ts                  ← tenant resolution middleware
```
