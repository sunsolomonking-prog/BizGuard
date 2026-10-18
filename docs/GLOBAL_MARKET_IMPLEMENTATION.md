# BizGuard Global Market implementation

## Current implementation (feature branch)

The Global Market workspace is additive and is registered at `/global-market`, linked from the existing sidebar.

### Included
- Business-scoped, RLS-protected FX reference storage in `global_fx_rates`; rates retain source, effective time, kind, and recording user.
- Account-and-business-scoped reporting currency, locale, country code, and IANA timezone preferences in `global_market_preferences`.
- Public indicative FX retrieval from open.er-api.com. The UI shows the provider update timestamp, requires the user to review and save the rate, and labels it as a reference rather than a guaranteed settlement quote.
- Manual FX references, dated conversion calculator, currency-aware formatting/rounding, and stale-rate warnings.
- POS sales currency snapshot for newly inserted sales via a database trigger. Existing sales are intentionally not backfilled because their historical currency cannot safely be inferred from current settings.
- Separate cross-border transaction register in `global_market_transactions` with original amount/currency, settlement amount/currency, rate/source/timestamp, counterparty/reference, and RLS policies. It does not mutate POS stock, debtor balances, subscriptions, or payment flows.
- Explainable margin check and a POS sales reporting view that excludes records without currency metadata or without a suitable dated FX rate rather than guessing.
- Audit events for preference changes, FX rate creation/deletion, and global transaction creation.

## Required deployment sequence

1. Review the draft PR and inspect the migration file `supabase/migrations/202610180001_global_market_persistence.sql`.
2. Run the read-only preflight script `supabase/diagnostics/global_market_readiness_check.sql` in Supabase SQL Editor. It makes no changes and reports prerequisites and whether the migration objects exist.
3. Do not apply the migration to production until it has been validated against a compatible test database/schema and the POS insert-trigger behavior has been tested. Do not paste any service-role key into the browser or commit secrets.
4. Verify the `public.user_can_access_business(uuid)` helper exists and behaves correctly for every supported business role; this migration relies on it for tenant isolation.
4. Deploy the feature branch as a Vercel Preview, not Production.
5. Run the validation commands from the project root:
   - `npm run typecheck`
   - `npm run build`
6. In Preview, test with at least two business accounts: preferences and rates must not cross business boundaries; a non-owner must not delete another user's FX reference; missing FX references must exclude rather than guess report totals; global ledger writes must not change POS inventory or sales.
7. Test the existing POS create-sale RPC with the new insert trigger before promoting. Existing POS inserts should snapshot the current business currency and preserve the existing total, stock, customer, and payment behavior.
8. Only promote after the migration and Preview checks pass.

## Explicit boundary — multi-currency checkout

The existing POS writes through `create_pos_sale`, whose deployed SQL function definition is not maintained in this repository. This feature does **not** replace that function or silently change its price calculation. The database trigger snapshots the business operating currency on newly inserted POS sales and rejects a foreign-currency POS sale unless rate evidence and settlement metadata are supplied.

Consequently, the separate cross-border register can record foreign-currency deals now, but selecting a foreign currency in reporting preferences does not change checkout, inventory selling-price semantics, tax, stock movement, debtor balance, or payment settlement. Enabling per-product foreign selling currencies and foreign-currency POS checkout requires inspecting and extending the deployed `create_pos_sale` function in a separate reviewed migration, preserving its existing transactional stock/debt/payment behavior. Do not represent that part as enabled until that RPC has been safely upgraded and tested.

## Historical records

No historical sales are assigned a currency by this migration. The report excludes rows whose currency snapshot is null, avoiding the false assumption that today's business currency was also used for an old transaction. No historical amounts are recalculated.
