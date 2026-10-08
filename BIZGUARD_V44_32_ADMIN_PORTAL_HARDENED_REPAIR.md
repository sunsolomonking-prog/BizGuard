# BizGuard V44.32 — Admin Portal Hardened Repair

## Target locked
Fix the missing Admin Portal for the authenticated Super Admin without rebuilding or altering unrelated BizGuard features.

## What changed
1. Added `src/lib/adminAccess.ts` with a server-authoritative Super Admin check.
   - Uses the existing `is_super_admin()` Supabase RPC first.
   - Falls back to the authenticated user's `public.users.role` when the RPC is unavailable.
   - Falls back to the existing client role only as a final UI fallback.
2. Header and Sidebar now use the authoritative check instead of depending only on the Zustand profile role.
3. `/admin` now has a dedicated `AdminRoute` that verifies Super Admin access before rendering the Admin Portal.
4. Login hydration also resolves the Super Admin role before storing the authenticated user in the app state.
5. Existing `/admin` page, Admin Portal functionality, business/payment/subscription logic, and unrelated routes were preserved.

## Database
No new migration is required. The repair uses the existing `is_super_admin()` RPC and existing `public.users.role` field.

## Important deployment note
This package must be deployed to the Vercel project currently serving `bizguard.fun` / `www.bizguard.fun`. The fix cannot appear on the live site until this build is deployed.

## Validation performed
- Source-level inspection of the changed files.
- Confirmed `/admin` remains protected by a Super Admin gate.
- Confirmed Header and Sidebar contain Admin Portal entry points.
- Attempted `npm install --ignore-scripts --no-audit --no-fund`; dependency installation timed out in the execution environment, so a full TypeScript/build validation was not completed here.
- Live website fetch was unavailable from the inspection environment; no claim of live DOM verification is made.
