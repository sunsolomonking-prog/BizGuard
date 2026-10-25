# BizGuard Staging Database Provisioning — Global Market Gate

## Purpose

This runbook is required before applying `202610180001_global_market_persistence.sql` or promoting PR #3. It protects the production database and prevents applying additive migrations to an empty or incompatible staging project.

## Verified staging findings (2026-10-20)

The operator ran read-only queries against the Supabase project displayed as `BizGuard-Staging`. Results showed:

- `to_regclass('public.businesses')` = NULL
- `to_regclass('public.sales')` = NULL
- `to_regprocedure('public.user_can_access_business(uuid)')` = NULL
- `to_regprocedure('public.create_pos_sale(uuid,uuid,text,numeric,numeric,date,jsonb)')` = NULL
- The table listing returned Supabase `auth` tables and no `public` base tables.
- `supabase_migrations.schema_migrations` was not found at that location.

These results establish that this staging database does not currently contain the application objects expected by the Global Market migration. They do **not** prove that production is missing those objects, nor that the displayed project is definitely the intended staging target. Confirm the project reference and application environment configuration before any writes.

## Stop conditions

Do not run any of the following in staging or production until the gates below are met:

- `supabase/schema.sql` as-is
- `202610020001_bizguard_ecosystem_repair.sql`
- `202610100004_bizguard_runtime_repair.sql`
- `202610180001_global_market_persistence.sql`

The legacy `supabase/schema.sql` is not a verified production schema snapshot. It includes seed/demo inserts and broad `USING (true)` policies, and it does not provide the deployed `create_pos_sale` implementation. The runtime/ecosystem repairs reference existing `public.businesses` and `public.users`; they are not foundational schema migrations.

## Required provisioning procedure

### Gate 1 — Confirm project identity

1. In Supabase Dashboard, open the staging project and copy its project reference from Project Settings / General.
2. Confirm the staging project's API URL matches the staging environment's `VITE_SUPABASE_URL` in the relevant non-production deployment. Never paste service-role keys, database passwords, or access tokens into GitHub or chat.
3. Confirm production and staging are distinct projects. Stop if project identity is ambiguous.

### Gate 2 — Obtain the authoritative schema without customer data

The repository's legacy `supabase/schema.sql` is not sufficient to provision a compatible environment. Use the project's controlled database/backup process to obtain a **schema-only** export from the authoritative BizGuard database, including tables, constraints, indexes, triggers, RLS policies, functions, grants, and extensions. Do not export production row data or auth users for this task.

The export may contain environment-specific objects or sensitive literals. Keep it private until reviewed; do not commit a raw production export. Do not use or expose production credentials in a client-side app or GitHub file.

If a schema-only export cannot be obtained, stop and reconstruct the baseline from the actual maintained migrations and deployed function definitions with the database owner. Do not guess the POS RPC implementation.

### Gate 3 — Review and provision staging

Before applying a baseline to staging, review it for:

- Production data inserts, demo seeds, hard-coded user IDs, secrets, or environment-specific storage settings.
- RLS policies and grants. No blanket `USING (true)` policies on private business, sales, inventory, debtor, or payment records.
- Foreign keys and ownership paths tying each record to the correct business.
- Required RPCs, especially the exact deployed `create_pos_sale(uuid,uuid,text,numeric,numeric,date,jsonb)` implementation.
- Functions/triggers that affect stock, sales totals, payments, customer balances, invoices, or audit logs.
- Storage buckets and policies that must be configured separately.

Apply the reviewed baseline only to the confirmed staging project, through the controlled migration process. Do not restore production rows or production auth identities.

### Gate 4 — Verify the baseline before Global Market

Run the read-only checks in `supabase/diagnostics/global_market_readiness_check.sql` after the baseline is installed. Before applying Global Market, confirm:

- `public.businesses`, `public.users`, and `public.sales` exist with expected columns.
- `public.user_can_access_business(uuid)` exists and has correct tenant-isolation behaviour.
- The deployed POS RPC signature and definition are understood and tested.
- Two test businesses cannot read or mutate each other's private data.
- A test sale preserves stock, discount/tax calculation, payment/receipt, invoice/debtor, and audit behaviour.

A matching RPC signature alone does not validate function behaviour.

### Gate 5 — Apply Global Market in staging

Only after Gates 1–4 pass:

1. Review `supabase/migrations/202610180001_global_market_persistence.sql` against the exact staging schema and POS function.
2. Pay particular attention to `sales_stamp_global_market_currency`, which runs before every inserted `sales` row and requires a valid `businesses.currency`. Test its interaction with the actual POS RPC before enabling it.
3. Apply the migration to staging only.
4. Re-run the readiness diagnostic; expected Global Market tables, currency columns, trigger, and RLS checks should pass.
5. Test FX rate CRUD, historical report exclusions, cross-border register, tenant isolation, and unchanged POS stock/payment/debt behaviour.
6. Run `npm run typecheck` and `npm run build` (or `npm run validate`) in CI.

## Promotion gate

PR #3 must remain a Draft and must not be merged or deployed until all gates pass. Passing frontend typecheck/build is not evidence that database provisioning, RLS, the migration, or the live POS flow is safe.

Never rewrite historical sales amounts or infer historical currencies from today's business settings. Production remains untouched until staging acceptance and a separately reviewed deployment plan are complete.
