// Role types for Multi-Tenant SaaS RBAC
export type UserRole =
  'developer' | 'superadmin' | 'support' | 'companyadmin' | 'hr' | 'user' | 'admin' | 'operator' | 'viewer';

export interface RoleContextType {
  role: UserRole | null;
  realRole: UserRole | null;
  simulatedRole: UserRole | null;
  setRole: (role: UserRole | null) => void;
  setSimulatedRole: (role: UserRole | null) => void;
  isDeveloper: boolean;
  isSuperAdmin: boolean;
  isSupport: boolean;
  isCompanyAdmin: boolean;
  isHr: boolean;
  isAdmin: boolean;
  isOperator: boolean;
  isViewer: boolean;
  isUser: boolean;
  canWrite: boolean;
}
