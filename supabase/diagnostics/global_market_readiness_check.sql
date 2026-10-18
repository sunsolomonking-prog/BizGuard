-- BizGuard Global Market: read-only database readiness check.
-- Safe to run in Supabase SQL Editor. This script does not modify any data or schema.
-- Run BEFORE applying the migration to see prerequisites, then AFTER applying it to verify objects.

WITH checks AS (
  SELECT
    'Prerequisite: public.businesses.currency' AS check_name,
    EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'businesses' AND column_name = 'currency'
    ) AS passed,
    'Existing business operating currency is required by the sale snapshot trigger.' AS details
  UNION ALL
  SELECT
    'Prerequisite: public.sales table',
    to_regclass('public.sales') IS NOT NULL,
    'The existing POS sales table must exist.'
  UNION ALL
  SELECT
    'Prerequisite: public.create_pos_sale(uuid,uuid,text,numeric,numeric,date,jsonb)',
    to_regprocedure('public.create_pos_sale(uuid,uuid,text,numeric,numeric,date,jsonb)') IS NOT NULL,
    'Confirms the expected POS RPC signature is present; it does not validate its behavior.'
  UNION ALL
  SELECT
    'Prerequisite: public.user_can_access_business(uuid)',
    to_regprocedure('public.user_can_access_business(uuid)') IS NOT NULL,
    'Required by the migration RLS policies.'
  UNION ALL
  SELECT
    'Global Market table: global_market_preferences',
    to_regclass('public.global_market_preferences') IS NOT NULL,
    'Expected after migration.'
  UNION ALL
  SELECT
    'Global Market table: global_fx_rates',
    to_regclass('public.global_fx_rates') IS NOT NULL,
    'Expected after migration.'
  UNION ALL
  SELECT
    'Global Market table: global_market_audit_events',
    to_regclass('public.global_market_audit_events') IS NOT NULL,
    'Expected after migration.'
  UNION ALL
  SELECT
    'Global Market table: global_market_transactions',
    to_regclass('public.global_market_transactions') IS NOT NULL,
    'Expected after migration.'
  UNION ALL
  SELECT
    'Sales currency column: transaction_currency',
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='sales' AND column_name='transaction_currency'),
    'Expected after migration.'
  UNION ALL
  SELECT
    'Sales currency column: settlement_currency',
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='sales' AND column_name='settlement_currency'),
    'Expected after migration.'
  UNION ALL
  SELECT
    'Sales currency column: settlement_amount',
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='sales' AND column_name='settlement_amount'),
    'Expected after migration.'
  UNION ALL
  SELECT
    'Sales currency column: fx_rate',
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='sales' AND column_name='fx_rate'),
    'Expected after migration.'
  UNION ALL
  SELECT
    'Sales currency column: fx_rate_source',
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='sales' AND column_name='fx_rate_source'),
    'Expected after migration.'
  UNION ALL
  SELECT
    'Sales currency column: fx_rate_timestamp',
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='sales' AND column_name='fx_rate_timestamp'),
    'Expected after migration.'
  UNION ALL
  SELECT
    'Sales currency column: reporting_currency',
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='sales' AND column_name='reporting_currency'),
    'Expected after migration.'
  UNION ALL
  SELECT
    'Sales currency column: reporting_amount',
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='sales' AND column_name='reporting_amount'),
    'Expected after migration.'
  UNION ALL
  SELECT
    'Sales currency column: fx_rate_id',
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='sales' AND column_name='fx_rate_id'),
    'Expected after migration.'
  UNION ALL
  SELECT
    'Trigger: sales_stamp_global_market_currency',
    EXISTS (
      SELECT 1 FROM information_schema.triggers
      WHERE event_object_schema='public' AND event_object_table='sales'
        AND trigger_name='sales_stamp_global_market_currency'
    ),
    'Expected after migration. This check does not prove POS behavior is correct.'
  UNION ALL
  SELECT
    'RLS enabled: global_market_preferences',
    COALESCE((SELECT relrowsecurity FROM pg_class WHERE oid=to_regclass('public.global_market_preferences')), false),
    'Expected true after migration.'
  UNION ALL
  SELECT
    'RLS enabled: global_fx_rates',
    COALESCE((SELECT relrowsecurity FROM pg_class WHERE oid=to_regclass('public.global_fx_rates')), false),
    'Expected true after migration.'
  UNION ALL
  SELECT
    'RLS enabled: global_market_audit_events',
    COALESCE((SELECT relrowsecurity FROM pg_class WHERE oid=to_regclass('public.global_market_audit_events')), false),
    'Expected true after migration.'
  UNION ALL
  SELECT
    'RLS enabled: global_market_transactions',
    COALESCE((SELECT relrowsecurity FROM pg_class WHERE oid=to_regclass('public.global_market_transactions')), false),
    'Expected true after migration.'
)
SELECT
  check_name,
  CASE WHEN passed THEN 'PASS' ELSE 'NOT READY / NOT APPLIED' END AS status,
  details
FROM checks
ORDER BY
  CASE WHEN passed THEN 1 ELSE 0 END,
  check_name;
