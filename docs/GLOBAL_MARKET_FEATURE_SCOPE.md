# BizGuard Global Market — Locked Feature Scope

**Status:** Draft / Preview-only  
**Branch:** `feature/global-market-readiness`  
**Production policy:** Do not merge or deploy this work to production until the acceptance checks below pass.

## Scope lock

Work in this initiative is restricted to smart, intelligent global-market capabilities and advanced multi-currency support. Do not expand into unrelated UI redesign, authentication changes, Admin Portal changes, payment/subscription rewrites, or unrelated bug fixes.

All changes must be additive and backward-compatible. Preserve existing BizGuard routes, screens, calculations, workflows, data, AI modules, Snap Count/Snap Sale entitlements, billing/payment approvals, Supabase authorization and RLS, and Admin Portal security.

## Target capabilities

### 1. Currency and regional preferences
- Allow users/businesses to select a supported reporting/display currency, country/market, language/locale, and time zone.
- Clearly distinguish display currency from the business's operating currency, transaction currency, payment/settlement currency, and reporting currency.
- Persist preferences to the authenticated profile/business only after schema and RLS compatibility are verified. Browser-local preferences are a temporary preview foundation, not account-wide persistence.

### 2. Multi-currency inventory
- Capture the original supplier/purchase currency and amount.
- Support separate purchase-cost and selling-price currency metadata where the existing data model can support it safely.
- Preserve quantity, SKU, stock movements, historical cost basis, and existing stock calculations.
- Never silently reinterpret an existing numeric price as a different currency.
- Any schema extension must be additive, nullable/default-safe for existing records, tenant-protected, and accompanied by a reviewed migration/rollback plan.

### 3. Multi-currency sales
- Record transaction currency and original amount explicitly.
- Distinguish transaction currency from payment/settlement currency and business reporting currency.
- Preserve existing sale totals, discounts, taxes, refunds, debtors, payment approvals, and historical records.
- Do not claim a payment was settled in a currency merely because the user selected that currency for display.

### 4. FX conversion and audit trail
- Use a clearly identified rate source, rate timestamp, base/quote currency, and conversion direction.
- Persist the rate used for a financial transaction/report snapshot so historical reports do not change when live rates move.
- Display estimated conversions as estimates; do not imply they are provider settlement quotes.
- Handle stale/missing rates, unsupported pairs, rounding precision, and conversion failures explicitly.
- Do not hard-code or invent exchange rates. Do not add external FX calls until provider selection, secret handling, rate limits, and failure behavior are reviewed.

### 5. Smart global-market intelligence
- Multi-currency revenue/cost/margin summaries with consistent base-currency conversion.
- Explainable FX exposure and margin-change alerts based on traceable inputs.
- Cross-market performance comparisons only when periods, currencies, rate sources, and assumptions are explicit.
- Supplier cost-change and pricing-impact insights that do not autonomously rewrite prices or transactions.
- Country/market-aware reporting and configurable tax metadata only after authoritative jurisdiction-specific rules are verified.
- AI-generated market insights must identify sources/assumptions, distinguish estimates from facts, and require user review before financial changes.

## Required implementation order

1. Audit current products, sales, sale items, stock movements, debtors, reports, AI financial calculations, database types, migrations, and RLS.
2. Document current money-field semantics and identify all calculations that assume one currency.
3. Propose an additive schema design and rollback plan; do not execute against production during the audit.
4. Implement currency/domain helpers with deterministic tests and explicit decimal/rounding rules.
5. Integrate inventory and sales capture without changing existing defaults or legacy transaction behavior.
6. Add FX source integration only after provider and operational behavior are reviewed.
7. Add reporting and explainable market intelligence.
8. Run typecheck, build, payment-flow tests, currency-focused tests, and regression tests for inventory, sales, tenant isolation, Snap Count/Snap Sale, subscriptions, and Admin Portal access.

## Acceptance criteria

- Existing records remain readable and retain their original meaning.
- Existing workflows work when no currency is explicitly selected; existing business-currency behavior remains the default.
- Every converted amount can be traced to its original amount, source/target currency, rate, and timestamp.
- Changing a display/reporting preference never mutates stored transaction values.
- Totals and margins never add unlike currencies without a documented conversion.
- RLS and business-tenant authorization remain enforced for every new record/read path.
- Failed analysis, payment, FX, or conversion operations do not silently consume entitlements or corrupt financial data.
- CI/runtime test evidence is recorded before the PR leaves Draft.

## Current limitations

The current PR contains locale/date/number/currency formatting helpers, browser-local regional preferences, a Global Market workspace, a manual FX reference desk, a currency conversion calculator, and an explainable margin check. FX references are saved in browser storage scoped by business ID and are not synchronized to Supabase or other devices. These rates are user-supplied references, not live provider quotes. This is a usable preview foundation, not yet a complete multi-currency transaction system. Transaction-level multi-currency inventory/sales, persistent account-level preferences, live FX provider integration, and market intelligence based on real recorded transactions must not be represented as completed until implemented and tested.

## Out of scope

- Rebuilding BizGuard or replacing its architecture.
- Changes to the Admin Portal login/placement work.
- Rewriting payment providers, subscriptions, billing, entitlements, or payment approval.
- Changing authentication, role checks, Supabase RLS, or existing security gates.
- Automatically changing prices, taxes, transaction amounts, or historical records.
- Claiming regulatory or tax compliance without authoritative country-specific validation.
