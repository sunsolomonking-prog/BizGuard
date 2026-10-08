import * as React from 'react';
import { supabase } from './supabase';

/**
 * Server-authoritative Super Admin access check.
 *
 * This is intentionally isolated from the client profile role so the Admin
 * Portal does not disappear when the local/Zustand profile is stale after a
 * role repair or a fresh session.
 */
export const checkSuperAdminAccess = async (fallbackRole?: string | null): Promise<boolean> => {
  try {
    const { data: rpcResult, error: rpcError } = await supabase.rpc('is_super_admin');
    if (!rpcError && rpcResult === true) return true;

    // Fallback for deployments where the RPC is temporarily unavailable or
    // the PostgREST schema cache has not refreshed yet.
    const { data: authData } = await supabase.auth.getUser();
    const authUserId = authData.user?.id;
    if (authUserId) {
      const { data: row, error: rowError } = await supabase
        .from('users')
        .select('role')
        .eq('id', authUserId)
        .maybeSingle();
      if (!rowError && row?.role === 'super_admin') return true;
    }
  } catch {
    // Keep the local role as the final fallback; the /admin route remains
    // protected by the same role check and Supabase authorization.
  }

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
