-- BizGuard staging foundation check (READ ONLY)
-- Run this before applying any BizGuard or Global Market migration.
-- It inspects metadata only; it does not read business records or change schema/data.
-- If core objects are missing, STOP: do not run runtime/global-market migrations yet.

WITH objects AS (
  SELECT 'public.businesses table' AS check_name,
         to_regclass('public.businesses') IS NOT NULL AS present,
         'Required by business-scoped features and multiple runtime migrations.' AS notes
  UNION ALL SELECT 'public.users table',
         to_regclass('public.users') IS NOT NULL,
         'Required by current Super Admin helper and user/business membership logic.'
  UNION ALL SELECT 'public.products table',
         to_regclass('public.products') IS NOT NULL,
         'Core inventory table expected by BizGuard.'
  UNION ALL SELECT 'public.customers table',
         to_regclass('public.customers') IS NOT NULL,
         'Core customer/debtor table expected by BizGuard.'
  UNION ALL SELECT 'public.sales table',
         to_regclass('public.sales') IS NOT NULL,
         'Core POS/sales table expected by Global Market migration.'
  UNION ALL SELECT 'public.sale_items table',
         to_regclass('public.sale_items') IS NOT NULL,
         'Core POS line-item table expected by base schema.'
  UNION ALL SELECT 'public.user_can_access_business(uuid)',
         to_regprocedure('public.user_can_access_business(uuid)') IS NOT NULL,
         'Required by Global Market RLS policies.'
  UNION ALL SELECT 'public.create_pos_sale(uuid,uuid,text,numeric,numeric,date,jsonb)',
         to_regprocedure('public.create_pos_sale(uuid,uuid,text,numeric,numeric,date,jsonb)') IS NOT NULL,
         'Expected POS RPC signature; existence alone does not prove correctness.'
  UNION ALL SELECT 'businesses.currency column',
         EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='businesses' AND column_name='currency'),
         'Required by the current Global Market sale-currency trigger.'
  UNION ALL SELECT 'Supabase migration history table',
         to_regclass('supabase_migrations.schema_migrations') IS NOT NULL
         OR to_regclass('supabase_migrations.schema_migrations') IS NOT NULL,
         'Absence is not proof that no migrations ran; Supabase CLI history can be managed outside this table.'
)
SELECT check_name,
       CASE WHEN present THEN 'FOUND' ELSE 'MISSING — STOP AND INVESTIGATE' END AS status,
       notes
FROM objects
ORDER BY present, check_name;

-- Also list public base tables so unexpected schemas are visible.
SELECT table_schema, table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;
