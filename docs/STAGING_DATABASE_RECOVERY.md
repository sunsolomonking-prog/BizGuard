# BizGuard staging database recovery — Global Market prerequisite

## Current verified finding

The staging project's read-only checks returned NULL for `public.businesses`, `public.sales`, `public.user_can_access_business(uuid)`, and `public.create_pos_sale(uuid,uuid,text,numeric,numeric,date,jsonb)`. The public/auth table inventory returned only the Supabase `auth` tables, with no BizGuard application tables in `public`.

This is a staging foundation issue, not a Global Market migration failure. Do not apply `202610180001_global_market_persistence.sql` or the runtime repair migrations until the core schema is correctly provisioned.

## Critical warning about `supabase/schema.sql`

The current `main` branch's `supabase/schema.sql` is a legacy/demo setup script. It contains permissive `USING (true)` RLS policies and hard-coded demo business/user seed rows. Do not execute it as-is against any shared or production-like environment. It also does not define the currently expected `create_pos_sale` RPC or `user_can_access_business(uuid)` helper.

## Safe recovery sequence

1. Confirm the Supabase project reference in the dashboard matches the staging URL/configuration used by the intended staging deployment. Do not copy production secrets into staging.
2. Run `supabase/diagnostics/staging_foundation_check.sql` in the staging SQL Editor. It is read-only.
3. Identify the authoritative current schema from the actual BizGuard staging/production deployment and the application code. Do not infer the full schema from the legacy demo schema.
4. Provision a clean staging database from a reviewed, version-controlled baseline that includes the required core tables, foreign keys, indexes, auth/profile linkage, secure business-scoped RLS, `user_can_access_business(uuid)`, and the actual atomic POS RPC. Do not use a simplified POS replacement.
5. Validate two separate test businesses and users. Verify that one business cannot read or mutate the other business's products, customers, sales, invoices, payments, stock movements, subscriptions, or Global Market records.
6. Verify the POS RPC in staging: stock decrement, sale and line-item creation, payment handling, discounts/tax, customer debt, and rollback on failure.
7. Only after steps 1–6 pass, apply `supabase/migrations/202610180001_global_market_persistence.sql` to staging using the controlled migration process.
8. Re-run `supabase/diagnostics/global_market_readiness_check.sql`; then test FX rates, preference isolation, audit events, transaction ledger, reporting exclusions for unknown historical currencies, and unchanged POS semantics.
9. Promote only after staging and Preview validation pass. Production migration remains a separate, explicitly approved step with a backup/rollback plan.

## Current blocker / operator action

The repository does not contain the authoritative SQL definition for the deployed `create_pos_sale` RPC, and the observed staging database lacks the expected core schema. The repository changes alone cannot safely provision the correct production-equivalent schema. Obtain the authoritative schema/migration export from the existing BizGuard deployment or its original provisioning source before creating the staging baseline.
