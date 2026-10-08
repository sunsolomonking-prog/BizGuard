export type EnterpriseRole = 'super_admin' | 'business_owner' | 'owner' | 'manager' | 'staff' | 'viewer';

export type Permission =
  | 'dashboard:view'
  | 'inventory:view'
  | 'inventory:write'
  | 'sales:view'
  | 'sales:write'
  | 'customers:view'
  | 'customers:write'
  | 'reports:view'
  | 'settings:manage'
  | 'admin:access';

const permissionMatrix: Record<EnterpriseRole, Permission[]> = {
  super_admin: [
    'dashboard:view',
    'inventory:view',
    'inventory:write',
    'sales:view',
    'sales:write',
    'customers:view',
    'customers:write',
    'reports:view',
    'settings:manage',
    'admin:access',
  ],
  business_owner: [
    'dashboard:view',
    'inventory:view',
    'inventory:write',
    'sales:view',
    'sales:write',
    'customers:view',
    'customers:write',
    'reports:view',
    'settings:manage',
  ],
  owner: [
    'dashboard:view',
    'inventory:view',
    'inventory:write',
    'sales:view',
    'sales:write',
    'customers:view',
    'customers:write',
    'reports:view',
    'settings:manage',
  ],
  manager: [
    'dashboard:view',
    'inventory:view',
    'inventory:write',
    'sales:view',
    'sales:write',
    'customers:view',
    'customers:write',
    'reports:view',
  ],
  staff: [
    'dashboard:view',
    'inventory:view',
    'sales:view',
    'sales:write',
    'customers:view',
  ],
  viewer: ['dashboard:view', 'inventory:view', 'sales:view', 'customers:view', 'reports:view'],
};

export const normalizeRole = (role?: string | null): EnterpriseRole => {
  if (role === 'super_admin' || role === 'business_owner' || role === 'owner' || role === 'manager' || role === 'staff' || role === 'viewer') {
    return role;
  }
  return 'viewer';
};

export const hasPermission = (role: string | null | undefined, permission: Permission) => {
  return permissionMatrix[normalizeRole(role)].includes(permission);
};

export const canAccessRole = (role: string | null | undefined, allowedRoles?: EnterpriseRole[]) => {
  if (!allowedRoles || allowedRoles.length === 0) return true;
  return allowedRoles.includes(normalizeRole(role));
};

export const roleLabel = (role?: string | null) => {
  const normalized = normalizeRole(role);
  return normalized
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

export const permissionsForRole = (role?: string | null) => permissionMatrix[normalizeRole(role)];
