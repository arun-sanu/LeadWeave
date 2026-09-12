import { supabase, isSupabaseConfigured } from './supabase.ts';

export interface SaaSCompany {
  id: string;
  name: string;
  loginId: string;
  address: string;
  phone: string;
  altPhone: string;
  maxUsers: number;
  maxSessions: number;
  maxAdmins: number;
  maxHr: number;
  monthlyPrice: number;
  activeUsersCount: number;
  activeSessionsCount: number;
  status: 'active' | 'trial' | 'suspended';
  adminEmail: string;
  adminUsername: string;
  createdAt: string;
  expiresAt: string;
  slug?: string;
  plan?: string;
  companyEmail?: string;
}

export interface SaaSUser {
  id: string;
  companyId: string;
  companyName: string;
  name: string;
  username: string;
  email: string;
  role: 'companyadmin' | 'user' | 'viewer';
  assignedSessions: string[];
  activeSessionsCount: number;
  messagesSentCount: number;
  messagesReceivedCount: number;
  responseCount: number;
  avgResponseTime: string;
  isActive: boolean;
  createdAt: string;
}

export interface SaaSPlan {
  id: string;
  name: string;
  priceMonth: number;
  maxUsers: number;
  maxSessions: number;
  features: string[];
  isPopular?: boolean;
}

const DEFAULT_PLANS: SaaSPlan[] = [
  {
    id: 'starter',
    name: 'Starter',
    priceMonth: 49,
    maxUsers: 3,
    maxSessions: 1,
    features: [
      '1 WhatsApp Number',
      'Up to 3 Team Agents',
      'Floating Bubbles & Quick Chat',
      'Local SQLite Storage',
      'Basic Templates',
    ],
  },
  {
    id: 'growth',
    name: 'Growth',
    priceMonth: 99,
    maxUsers: 5,
    maxSessions: 2,
    isPopular: true,
    features: [
      '2 WhatsApp Numbers',
      'Up to 5 Team Agents',
      'Floating Bubbles & Quick Chat',
      'Media Lightbox & Voice Notes',
      'Broadcasting Campaigns',
    ],
  },
  {
    id: 'pro',
    name: 'Pro Team',
    priceMonth: 199,
    maxUsers: 11,
    maxSessions: 5,
    features: [
      '5 WhatsApp Numbers',
      'Up to 11 Team Agents',
      'Multi-Session Routing',
      'Priority Rate Limit Shield',
      'Full Webhook & API Access',
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    priceMonth: 499,
    maxUsers: 50,
    maxSessions: 20,
    features: [
      '20 WhatsApp Numbers',
      'Up to 50 Team Agents',
      'Dedicated High-Speed Relay',
      'Custom Anti-Ban AI Delays',
      '24/7 SLA Support',
    ],
  },
];

const STORAGE_KEY_COMPANIES = 'leadweave_saas_companies_v2';
const STORAGE_KEY_USERS = 'leadweave_saas_users_v2';

function loadStored<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveStored<T>(key: string, data: T) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    // ignore
  }
}

let companiesState: SaaSCompany[] = loadStored(STORAGE_KEY_COMPANIES, []);
let usersState: SaaSUser[] = loadStored(STORAGE_KEY_USERS, []);
let isSyncing = false;
let lastSyncTime: number | null = null;
const listeners = new Set<() => void>();

const notify = () => {
  listeners.forEach(fn => fn());
};

/**
 * Fetch and sync companies and profiles directly from Supabase
 */
async function syncFromSupabase() {
  if (!isSupabaseConfigured || !supabase) return;
  if (isSyncing) return;
  isSyncing = true;

  try {
    const [companiesRes, profilesRes] = await Promise.all([
      supabase.from('companies').select('*').order('created_at', { ascending: false }),
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
    ]);

    const supabaseCompanies = companiesRes.data || [];
    const supabaseProfiles = profilesRes.data || [];

    if (companiesRes.error) {
      console.warn('Failed to fetch companies from Supabase:', companiesRes.error.message);
    }

    if (profilesRes.error) {
      console.warn('Failed to fetch profiles from Supabase:', profilesRes.error.message);
    }

    // Map Supabase profiles to SaaSUsers
    const mappedUsers: SaaSUser[] = supabaseProfiles.map(p => {
      const parentCompany = supabaseCompanies.find(c => c.id === p.company_id);
      const name = p.full_name || p.email?.split('@')[0] || 'User';
      const userRole = p.role === 'superadmin' || p.role === 'companyadmin' ? 'companyadmin' : 'user';
      const assigned = Array.isArray(p.assigned_sessions) ? p.assigned_sessions : [];

      return {
        id: p.id,
        companyId: p.company_id || (supabaseCompanies[0]?.id ?? 'default'),
        companyName: parentCompany?.name || 'ModBit',
        name,
        username: name.toLowerCase().replace(/[^a-z0-9]/g, ''),
        email: p.email || '',
        role: userRole,
        assignedSessions: assigned,
        activeSessionsCount: assigned.length,
        messagesSentCount: 0,
        messagesReceivedCount: 0,
        responseCount: 0,
        avgResponseTime: '0s',
        isActive: true,
        createdAt: p.created_at ? p.created_at.split('T')[0] : new Date().toISOString().split('T')[0],
      };
    });

    // Map Supabase companies to SaaSCompany
    const mappedCompanies: SaaSCompany[] = supabaseCompanies.map(c => {
      const compUsers = mappedUsers.filter(u => u.companyId === c.id);
      const adminUser = compUsers.find(u => u.role === 'companyadmin') || compUsers[0];

      return {
        id: c.id,
        name: c.name,
        loginId: c.login_id || c.name.toLowerCase().replace(/[^a-z0-9]/g, ''),
        address: c.address || '',
        phone: c.phone || '',
        altPhone: c.alt_phone || '',
        maxUsers: c.max_users ?? 1,
        maxSessions: c.max_sessions ?? 1,
        maxAdmins: c.max_admins ?? 1,
        maxHr: c.max_hr ?? 0,
        monthlyPrice: Number(c.monthly_price) || 0,
        activeUsersCount: compUsers.length,
        activeSessionsCount: 0,
        status: 'active',
        adminEmail: adminUser?.email || 'admin@' + c.name.toLowerCase() + '.com',
        adminUsername: adminUser?.name || 'Admin',
        createdAt: c.created_at ? c.created_at.split('T')[0] : new Date().toISOString().split('T')[0],
        expiresAt: new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0],
        companyEmail: c.company_email || '',
      };
    });

    // Merge Supabase entries with existing local state (Supabase takes precedence)
    const existingCompMap = new Map(companiesState.map(c => [c.id, c]));
    mappedCompanies.forEach(c => existingCompMap.set(c.id, c));
    companiesState = Array.from(existingCompMap.values());

    const existingUserMap = new Map(usersState.map(u => [u.id, u]));
    mappedUsers.forEach(u => existingUserMap.set(u.id, u));
    usersState = Array.from(existingUserMap.values());

    // Update activeUsersCount on companies
    companiesState = companiesState.map(c => ({
      ...c,
      activeUsersCount: usersState.filter(u => u.companyId === c.id).length,
    }));

    saveStored(STORAGE_KEY_COMPANIES, companiesState);
    saveStored(STORAGE_KEY_USERS, usersState);
    lastSyncTime = Date.now();
    notify();
  } catch (err) {
    console.error('Error synchronizing with Supabase:', err);
  } finally {
    isSyncing = false;
  }
}

// Initial sync execution
if (typeof window !== 'undefined') {
  syncFromSupabase();
}

export const saasStore = {
  getCompanies: () => companiesState,
  getUsers: () => usersState,
  getPlans: () => DEFAULT_PLANS,
  getLastSyncTime: () => lastSyncTime,
  syncWithSupabase: syncFromSupabase,

  subscribe: (fn: () => void) => {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },

  addCompany: async (payload: {
    name: string;
    loginId: string;
    address: string;
    phone: string;
    altPhone: string;
    maxUsers: number;
    maxSessions: number;
    maxAdmins: number;
    maxHr: number;
    monthlyPrice: number;
    adminEmail: string;
    adminUsername: string;
    slug?: string;
    plan?: string;
    companyEmail?: string;
  }) => {
    let newId = `cmp-${Date.now()}`;

    // Write to Supabase if client available
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('companies')
          .insert([
            {
              name: payload.name,
              login_id: payload.loginId,
              address: payload.address || null,
              phone: payload.phone || null,
              alt_phone: payload.altPhone || null,
              max_users: payload.maxUsers,
              max_sessions: payload.maxSessions,
              max_admins: payload.maxAdmins,
              max_hr: payload.maxHr,
              monthly_price: payload.monthlyPrice,
              company_email: payload.companyEmail || null,
            },
          ])
          .select('id, name, created_at')
          .maybeSingle();

        if (data && !error) {
          newId = data.id;

          // Create the admin user for this company in Supabase Auth & profiles
          await supabase.rpc('create_user_in_auth', {
            email: payload.adminEmail,
            password: 'Welcome123!',
            full_name: payload.adminUsername,
            company_id: newId,
            role: 'companyadmin',
          });
        } else if (error) {
          console.warn('Could not insert company into Supabase:', error.message);
        }
      } catch (e) {
        console.warn('Could not insert company into Supabase:', e);
      }
    }

    const newCompany: SaaSCompany = {
      id: newId,
      name: payload.name,
      loginId: payload.loginId,
      slug: payload.slug || payload.loginId,
      plan: payload.plan || 'Starter',
      address: payload.address,
      phone: payload.phone,
      altPhone: payload.altPhone,
      maxUsers: payload.maxUsers,
      maxSessions: payload.maxSessions,
      maxAdmins: payload.maxAdmins,
      maxHr: payload.maxHr,
      monthlyPrice: payload.monthlyPrice,
      activeUsersCount: 1,
      activeSessionsCount: 0,
      status: 'active',
      adminEmail: payload.adminEmail,
      adminUsername: payload.adminUsername,
      createdAt: new Date().toISOString().split('T')[0],
      expiresAt: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      companyEmail: payload.companyEmail || '',
    };

    const newAdminUser: SaaSUser = {
      id: `usr-${Date.now()}`,
      companyId: newCompany.id,
      companyName: newCompany.name,
      name: payload.adminUsername,
      username: payload.adminUsername,
      email: payload.adminEmail,
      role: 'companyadmin',
      assignedSessions: [],
      activeSessionsCount: 0,
      messagesSentCount: 0,
      messagesReceivedCount: 0,
      responseCount: 0,
      avgResponseTime: '0s',
      isActive: true,
      createdAt: new Date().toISOString().split('T')[0],
    };

    companiesState = [newCompany, ...companiesState.filter(c => c.id !== newCompany.id)];
    usersState = [newAdminUser, ...usersState];
    saveStored(STORAGE_KEY_COMPANIES, companiesState);
    saveStored(STORAGE_KEY_USERS, usersState);

    // Refresh to reload state from Supabase
    await syncFromSupabase();
    return newCompany;
  },

  toggleCompanyStatus: (companyId: string) => {
    companiesState = companiesState.map(c => {
      if (c.id !== companyId) return c;
      const nextStatus = c.status === 'active' ? 'suspended' : 'active';
      return { ...c, status: nextStatus };
    });
    saveStored(STORAGE_KEY_COMPANIES, companiesState);
    notify();
  },

  deleteCompany: async (companyId: string) => {
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('companies').delete().eq('id', companyId);
      } catch (e) {
        console.warn('Could not delete company from Supabase:', e);
      }
    }
    companiesState = companiesState.filter(c => c.id !== companyId);
    usersState = usersState.filter(u => u.companyId !== companyId);
    saveStored(STORAGE_KEY_COMPANIES, companiesState);
    saveStored(STORAGE_KEY_USERS, usersState);

    // Refresh to reload state from Supabase
    await syncFromSupabase();
  },

  addUser: async (payload: {
    companyId: string;
    name: string;
    username: string;
    email: string;
    role: 'companyadmin' | 'user' | 'viewer';
  }) => {
    const comp = companiesState.find(c => c.id === payload.companyId);
    if (!comp) return;

    let newUserId = `usr-${Date.now()}`;

    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase.rpc('create_user_in_auth', {
          email: payload.email,
          password: 'Welcome123!',
          full_name: payload.name,
          company_id: payload.companyId,
          role: payload.role,
        });

        if (data && !error) {
          newUserId = data;
        } else if (error) {
          console.warn('Could not insert profile into Supabase via RPC:', error.message);
        }
      } catch (e) {
        console.warn('Could not insert profile into Supabase:', e);
      }
    }

    const newUser: SaaSUser = {
      id: newUserId,
      companyId: payload.companyId,
      companyName: comp.name,
      name: payload.name,
      username: payload.username,
      email: payload.email,
      role: payload.role,
      assignedSessions: [],
      activeSessionsCount: 0,
      messagesSentCount: 0,
      messagesReceivedCount: 0,
      responseCount: 0,
      avgResponseTime: '0s',
      isActive: true,
      createdAt: new Date().toISOString().split('T')[0],
    };

    usersState = [newUser, ...usersState.filter(u => u.id !== newUser.id)];
    companiesState = companiesState.map(c =>
      c.id === payload.companyId ? { ...c, activeUsersCount: c.activeUsersCount + 1 } : c,
    );

    saveStored(STORAGE_KEY_COMPANIES, companiesState);
    saveStored(STORAGE_KEY_USERS, usersState);

    // Refresh to reload state from Supabase
    await syncFromSupabase();
    return newUser;
  },

  deleteUser: async (userId: string) => {
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.rpc('delete_user_by_id', { user_id: userId });
      } catch (e) {
        console.warn('Could not delete user from Supabase:', e);
      }
    }
    const target = usersState.find(u => u.id === userId);
    if (target) {
      companiesState = companiesState.map(c =>
        c.id === target.companyId ? { ...c, activeUsersCount: Math.max(0, c.activeUsersCount - 1) } : c,
      );
      saveStored(STORAGE_KEY_COMPANIES, companiesState);
    }
    usersState = usersState.filter(u => u.id !== userId);
    saveStored(STORAGE_KEY_USERS, usersState);

    // Refresh to reload state from Supabase
    await syncFromSupabase();
  },

  assignSessionToUser: async (userId: string, sessionId: string) => {
    const user = usersState.find(u => u.id === userId);
    if (!user) return;
    const current = user.assignedSessions || [];
    if (current.includes(sessionId)) return;
    const updated = [...current, sessionId];

    usersState = usersState.map(u =>
      u.id === userId ? { ...u, assignedSessions: updated, activeSessionsCount: updated.length } : u,
    );
    saveStored(STORAGE_KEY_USERS, usersState);
    notify();

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('profiles').update({ assigned_sessions: updated }).eq('id', userId);
      } catch (err) {
        console.warn('Could not update assigned_sessions in Supabase:', err);
      }
    }
  },

  unassignSessionFromUser: async (userId: string, sessionId: string) => {
    const user = usersState.find(u => u.id === userId);
    if (!user) return;
    const current = user.assignedSessions || [];
    const updated = current.filter(s => s !== sessionId);

    usersState = usersState.map(u =>
      u.id === userId ? { ...u, assignedSessions: updated, activeSessionsCount: updated.length } : u,
    );
    saveStored(STORAGE_KEY_USERS, usersState);
    notify();

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('profiles').update({ assigned_sessions: updated }).eq('id', userId);
      } catch (err) {
        console.warn('Could not update assigned_sessions in Supabase:', err);
      }
    }
  },
};
