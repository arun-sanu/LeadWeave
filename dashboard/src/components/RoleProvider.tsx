import { useState, useCallback, type ReactNode } from 'react';
import type { UserRole, RoleContextType } from '../types/role';
import { RoleContext } from '../hooks/useRole';

export interface RoleProviderProps {
  children?: ReactNode;
  initialRole?: UserRole | null;
}

export function RoleProvider({ children, initialRole = null }: RoleProviderProps) {
  const [realRole, setRealRoleState] = useState<UserRole | null>(initialRole);
  const [simulatedRole, setSimulatedRoleState] = useState<UserRole | null>(null);

  const setRole = useCallback((newRole: UserRole | null) => {
    setRealRoleState(newRole);
    if (!newRole || newRole !== 'developer') {
      setSimulatedRoleState(null);
    }
  }, []);

  const setSimulatedRole = useCallback((newSimRole: UserRole | null) => {
    setSimulatedRoleState(newSimRole);
  }, []);

  const isRealDev = realRole === 'developer';
  const effectiveRole = isRealDev && simulatedRole ? simulatedRole : realRole;

  const isDeveloper = effectiveRole === 'developer';
  const isSuperAdmin = effectiveRole === 'superadmin' || isDeveloper;
  const isSupport = effectiveRole === 'support' || isSuperAdmin;
  const isCompanyAdmin = effectiveRole === 'companyadmin' || isSuperAdmin;
  const isHr = effectiveRole === 'hr' || isCompanyAdmin;
  const isUser = effectiveRole === 'user';
  const isAdmin = effectiveRole === 'admin' || isSuperAdmin || isCompanyAdmin;
  const isOperator = effectiveRole === 'operator' || isCompanyAdmin || isUser || isDeveloper;
  const isViewer = effectiveRole === 'viewer';

  const value: RoleContextType = {
    role: effectiveRole,
    realRole,
    simulatedRole,
    setRole,
    setSimulatedRole,
    isDeveloper: isRealDev, // True identity capability flag
    isSuperAdmin,
    isSupport,
    isCompanyAdmin,
    isHr,
    isAdmin,
    isOperator,
    isViewer,
    isUser,
    canWrite: effectiveRole !== 'viewer',
  };

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}
