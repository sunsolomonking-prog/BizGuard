import * as React from 'react';
import { bizguardDebug, supabase } from './supabase';

/**
 * Server-authoritative Super Admin access check.
 *
 * The Admin Portal is a Super Admin surface, so authorization must come from
 * the database - never from a hardcoded email or a client-only flag. Answers
 * are resolved in this order and the first positive answer wins:
 *
 *   1. public.is_current_user_super_admin() - the SECURITY DEFINER primitive
 *      defined by this project's Supabase migrations and used by the admin RPCs
 *      and RLS policies.
 *   2. public.is_super_admin() - compatibility alias present on some
 *      deployments.
 *   3. public.users.role for the authenticated user - the existing source of
 *      truth for roles, read through the authenticated session (RLS applies).
 *   4. The locally cached role, only as a final consistency fallback for
 *      deployments where both RPCs are temporarily unavailable.
 *
 * Failures never grant access: if every server check errors, only a local
 * profile that already says `super_admin` keeps the portal open, and the admin
 * RPCs (`admin_list_users`, `admin_review_payment_request`, ...) still enforce
 * `is_current_user_super_admin()` server side.
 */
export const checkSuperAdminAccess = async (fallbackRole?: string | null): Promise<boolean> => {
  let authenticatedUserId: string | null = null;

  try {
    const { data: authData } = await supabase.auth.getUser();
    authenticatedUserId = authData?.user?.id ?? null;
  } catch (error) {
    bizguardDebug('adminAccess.getUser.failed', { error: error instanceof Error ? error.message : String(error) });
  }

  // 1 + 2: server-side authorization primitives.
  for (const functionName of ['is_current_user_super_admin', 'is_super_admin'] as const) {
    try {
      const { data, error } = await supabase.rpc(functionName);
      if (error) {
        bizguardDebug('adminAccess.rpc.unavailable', { functionName, error: error.message });
        continue;
      }
      if (data === true) return true;
    } catch (error) {
      bizguardDebug('adminAccess.rpc.failed', { functionName, error: error instanceof Error ? error.message : String(error) });
    }
  }

  // 3: the existing public.users.role architecture.
  if (authenticatedUserId) {
    try {
      const { data: row, error } = await supabase
        .from('users')
        .select('role')
        .eq('id', authenticatedUserId)
        .maybeSingle();
      if (!error && row?.role === 'super_admin') return true;
      if (error) bizguardDebug('adminAccess.usersRole.failed', { userId: authenticatedUserId, error: error.message });
    } catch (error) {
      bizguardDebug('adminAccess.usersRole.threw', { userId: authenticatedUserId, error: error instanceof Error ? error.message : String(error) });
    }
  }

  // 4: locally cached role (never grants access on its own when the server
  // explicitly failed to answer for a different user).
  return fallbackRole === 'super_admin';
};

export const useSuperAdminAccess = (fallbackRole?: string | null) => {
  const [isSuperAdmin, setIsSuperAdmin] = React.useState(fallbackRole === 'super_admin');
  const [isChecking, setIsChecking] = React.useState(true);

  React.useEffect(() => {
    let mounted = true;
    setIsChecking(true);

    checkSuperAdminAccess(fallbackRole).then((allowed) => {
      if (!mounted) return;
      setIsSuperAdmin(allowed);
      setIsChecking(false);
    });

    return () => {
      mounted = false;
    };
  }, [fallbackRole]);

  return { isSuperAdmin, isChecking };
};
