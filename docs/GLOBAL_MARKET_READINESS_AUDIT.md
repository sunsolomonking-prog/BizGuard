# BizGuard Global Market Readiness — Phase 0 Audit

**Audit target:** `admin-portal-repair` at `dcb6ca86dba87b3c87e5575dfa46185b3671e65b`  
**Work branch:** `feature/global-market-readiness`  
**Audit mode:** Read-only source inspection; no production deployment or database changes.

## Executive summary

BizGuard is an existing React 19 + TypeScript + Vite application with Supabase authentication/data access, a Vercel-style serverless Vision endpoint, existing billing/subscription and payment-proof flows, and a substantial set of business and AI modules. Global readiness should be implemented as additive foundations and then connected to the existing UI/data model only after the compatibility and schema implications are reviewed.

The repository inventory contains 145 paths at the audit ref, 12 SQL migration files, one top-level API endpoint (`api/bizguard-vision.js`), and established business pages including Sales, Inventory, Debtors, Customers-related intelligence, Reports, AI Assistant, AI CEO, AI Evolution, Market Intelligence, Subscription, Settings, and Admin Portal. These observations are repository inventory, not a claim that every workflow has passed runtime tests.

## Confirmed repository facts

- Frontend stack: React 19, TypeScript, Vite, React Router, Tailwind/Vite integration.
- Supabase client is centralized in `src/lib/supabase.ts`; it requires `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` and uses persisted Supabase Auth sessions.
- Existing domain modules include `src/lib/business.ts`, `billing.ts`, `paymentAccount.ts`, `subscriptions.ts`, `rbac.ts`, `adminAccess.ts`, `database.types.ts`, and multiple AI/observability modules.
- Existing server-side Vision fallback is `api/bizguard-vision.js`.
- Existing SQL migrations cover admin simplification, subscription foundation, runtime/ecosystem repairs, Snap Count entitlements, business-member role compatibility, targeted admin/Snap authorization, and payment receipt/proof/request flows.
- The `Business` TypeScript model already includes `currency` and `timezone`, but this alone does not establish transaction-level multi-currency correctness or persistent per-user locale preferences.
- Available validation commands are `npm run typecheck`, `npm run build`, `npm run validate`, `npm run audit:prod`, and `npm run test:payment-flow`. There is no dedicated test-runner script declared in the inspected package manifest.

## Global-readiness gaps to verify and address

1. **Localization:** No dedicated internationalization/localization module appeared in the repository path inventory. Existing UI copy should remain the fallback until translation coverage is introduced and reviewed.
2. **Currency correctness:** A currency field exists on the Business model. Before modifying financial records, inspect the actual Supabase schema and every money calculation to establish whether currency is stored per transaction, whether historical FX rates are recorded, and whether arithmetic currently relies on JavaScript numbers.
3. **Country and profile preferences:** No dedicated locale-preference module appeared in the path inventory. Existing user/business schemas and profile creation RPCs must be checked before adding persistent fields.
4. **Payments:** Existing billing/subscription and payment-proof workflows exist. Provider support, server-side verification, idempotency, refunds, settlement currency, and country availability must be audited before adding any provider or changing checkout behavior.
5. **Compliance:** The repository does not, by itself, prove country-by-country tax or legal compliance. These need jurisdiction-specific configuration and expert validation; no certification claim should be made.
6. **Security:** Preserve Supabase RLS, existing AdminRoute/Super Admin checks, and server-only secrets. Audit all API and RPC authorization before changing permissions. A frontend-only check is not authorization.
7. **Runtime readiness:** Repository inspection is not equivalent to executing tests. Build/typecheck/payment-flow validation must run in a real project runtime or CI; connector-based source inspection cannot certify those checks.

## Preservation map

The first implementation increment will add isolated, side-effect-free localization/formatting helpers and documentation only. It will not modify:

- existing routes or navigation;
- Sales, Inventory, Debtors, Customers, Reports, or dashboard behavior;
- AI, Snap Count, Vision endpoint, or observability logic;
- authentication, profile repair, role checks, Admin Portal/password gate, or RLS;
- payment providers, billing, subscriptions, entitlements, or database records;
- environment secrets, production configuration, or deployment domains.

## Risk-ranked roadmap

### P0 — Protect current behavior
- Establish branch-based preview workflow and record baseline validation results.
- Inspect and regression-test authentication, tenant isolation, Admin Portal authorization, payment entitlements, and Vision server endpoint.
- Do not deploy until the existing workflows and new functionality are verified together.

### P1 — Internationalization foundation
- Add locale-safe formatting helpers and a typed locale/country preference model with safe fallbacks.
- Integrate preference persistence only after reviewing current Settings/profile schema.
- Keep existing English UI unchanged until translation resources are ready.

### P1 — Currency and transaction audit
- Trace each existing sales, invoice, payment, inventory-cost, report, and AI financial calculation.
- Document current currency semantics and data types before proposing a schema migration.
- Add a versioned, additive migration only after schema compatibility and rollback are documented.

### P2 — Multi-country profile and organization settings
- Propose optional country, language, timezone, and reporting-currency preferences.
- Reuse current profile/business records and RPCs where possible; avoid duplicate identities and unsafe direct writes.

### P2 — International payment adapter readiness
- Map existing providers, checkout and proof flows, server-side verification, webhooks, reconciliation, refunds, and entitlement grants.
- Add providers only after confirming availability, credentials, compliance requirements, and test-mode verification.

### P3 — Localized intelligence and compliance configuration
- Make market assumptions, external sources, and AI estimates explicit.
- Add configurable tax/compliance frameworks only with authoritative country-specific inputs and review.

### P3 — Operations, accessibility, SEO, support
- Audit performance, accessibility, metadata, service status, error reporting, and support workflows; implement targeted changes only where evidence supports them.

## First additive implementation increment

This branch will contain:
1. This audit report.
2. A reusable locale/date/number/currency formatting module with explicit fallbacks.
3. Unit-testable behavior without changing existing transactions, data, routes, or UI.

These helpers are a foundation, not a claim that BizGuard is already fully internationalized or globally production-ready.

## Verification status

- Source inventory: completed at the referenced commit.
- Runtime tests/typecheck/build: **not run in this connector-based edit session**.
- Database schema and live RLS verification: **not performed against the live Supabase project**.
- Payment-provider live verification: **not performed**.
- Production deployment: **not performed**.
