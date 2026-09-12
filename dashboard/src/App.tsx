import { useState, useEffect, useCallback, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { lazyWithRetry as lazy } from './utils/lazyWithRetry';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { Layout } from './components/Layout';
import { ToastProvider } from './components/Toast';
import { useRole } from './hooks/useRole';
import { RoleProvider } from './components/RoleProvider';
import { ErrorBoundary } from './components/ErrorBoundary';
import { API_BASE_URL } from './services/api';
import { clearActorState, isUserRole, resolveStartupValidation } from './utils/authLifecycle';
import './App.css';
import { CampaignProvider } from './contexts/CampaignContext';

const Login = lazy(() => import('./pages/Login').then(m => ({ default: m.Login })));
const Dashboard = lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));
const Chats = lazy(() => import('./pages/Chats').then(m => ({ default: m.Chats })));
const Logs = lazy(() => import('./pages/Logs').then(m => ({ default: m.Logs })));
const ApiKeys = lazy(() => import('./pages/ApiKeys').then(m => ({ default: m.ApiKeys })));
const MessageTester = lazy(() => import('./pages/MessageTester').then(m => ({ default: m.MessageTester })));
const CreateCampaignWizard = lazy(() => import('./pages/CreateCampaignWizard').then(m => ({ default: m.CreateCampaignWizard })));
const AudienceDataSelection = lazy(() => import('./pages/AudienceDataSelection').then(m => ({ default: m.AudienceDataSelection })));
const BroadcastTemplates = lazy(() => import('./pages/BroadcastTemplates').then(m => ({ default: m.BroadcastTemplates })));
const BroadcastSettings = lazy(() => import('./pages/BroadcastSettings').then(m => ({ default: m.BroadcastSettings })));
const CampaignAnalytics = lazy(() => import('./pages/CampaignAnalytics').then(m => ({ default: m.CampaignAnalytics })));
const Infrastructure = lazy(() => import('./pages/Infrastructure').then(m => ({ default: m.Infrastructure })));
const Plugins = lazy(() => import('./pages/Plugins'));
const Profile = lazy(() => import('./pages/Profile').then(m => ({ default: m.Profile })));
const Companies = lazy(() => import('./pages/Companies').then(m => ({ default: m.Companies })));
const Subscriptions = lazy(() => import('./pages/Subscriptions').then(m => ({ default: m.Subscriptions })));
const DatabaseUsage = lazy(() => import('./pages/DatabaseUsage').then(m => ({ default: m.DatabaseUsage })));
const ManagementDashboard = lazy(() => import('./pages/ManagementDashboard').then(m => ({ default: m.ManagementDashboard })));
const NoticeBoard = lazy(() => import('./pages/NoticeBoard').then(m => ({ default: m.NoticeBoard })));
const Storage = lazy(() => import('./pages/Storage').then(m => ({ default: m.Storage })));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60 * 1000, // 5 minutes garbage collection to prevent memory leaks in long-lived tabs
      retry: 1,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
  },
});

function AppContent() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    // Initial check: if there's any active session flag
    return sessionStorage.getItem('leadweave_logged_in') === 'true';
  });
  const [isInitializing, setIsInitializing] = useState(true);
  const { setRole, role } = useRole();

  const handleLogin = (validatedRole?: string) => {
    sessionStorage.setItem('leadweave_logged_in', 'true');
    setRole(isUserRole(validatedRole) ? validatedRole : 'viewer');
    setIsAuthenticated(true);
  };

  const handleLogout = useCallback(() => {
    // Tell server to clear HTTP-only cookies
    fetch(`${API_BASE_URL}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    }).catch(() => {});

    setIsAuthenticated(false);
    setRole(null);
    sessionStorage.removeItem('leadweave_logged_in');
    sessionStorage.removeItem('leadweave_api_key');
    sessionStorage.removeItem('leadweave_supabase_token');
    sessionStorage.removeItem('leadweave_user_name');
    sessionStorage.removeItem('leadweave_user_email');
    sessionStorage.removeItem('leadweave_company_name');
    clearActorState(queryClient);
  }, [setRole]);

  // Validate active cookie session on mount
  useEffect(() => {
    const isLoggedIn = sessionStorage.getItem('leadweave_logged_in') === 'true';

    if (!isLoggedIn) {
      setIsInitializing(false);
      setIsAuthenticated(false);
      return;
    }

    fetch(`${API_BASE_URL}/auth/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    })
      .then(async res => {
        const decision = resolveStartupValidation(res.status, await res.json().catch(() => null));
        if (decision.action === 'logout') {
          handleLogout();
        } else if (decision.action === 'role') {
          setRole(decision.role);
          setIsAuthenticated(true);
          sessionStorage.setItem('leadweave_logged_in', 'true');
        }
      })
      .catch(() => {
        // Network failure: keep existing state
      })
      .finally(() => {
        setIsInitializing(false);
      });
  }, [setRole, handleLogout]);

  const loadingFallback = (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <Loader2 className="animate-spin" size={32} />
    </div>
  );

  if (isInitializing && isAuthenticated) {
    return loadingFallback;
  }

  if (!isAuthenticated) {
    return (
      <Suspense fallback={loadingFallback}>
        <Login onLogin={handleLogin} />
      </Suspense>
    );
  }

  return (
    <ToastProvider>
      <BrowserRouter>
        <Suspense fallback={loadingFallback}>
          <Routes>
            <Route path="/" element={<Layout onLogout={handleLogout} userRole={role} />}>
              <Route index element={<Dashboard />} />
              <Route path="sessions" element={<Navigate to="/chats?tab=sessions" replace />} />
              <Route path="chats" element={<Chats />} />
              <Route path="webhooks" element={<Navigate to="/profile?tab=webhooks" replace />} />
              <Route path="campaigns">
                <Route index element={<Navigate to="analytics" replace />} />
                <Route path="analytics" element={<CampaignAnalytics />} />
                <Route
                  path="new"
                  element={
                    <CampaignProvider>
                      <CreateCampaignWizard />
                    </CampaignProvider>
                  }
                >
                  <Route index element={<Navigate to="data" replace />} />
                  <Route path="data" element={<AudienceDataSelection />} />
                  <Route path="templates" element={<BroadcastTemplates />} />
                  <Route path="dispatch" element={<BroadcastSettings />} />
                </Route>
              </Route>
              <Route path="notice-board" element={<NoticeBoard />} />
              <Route path="profile" element={<Profile />} />
              <Route path="management" element={<ManagementDashboard />} />
              <Route path="companies" element={<Companies />} />
              <Route path="subscriptions" element={<Subscriptions />} />
              <Route path="database-usage" element={<DatabaseUsage />} />
              <Route path="team" element={<Navigate to="/profile?tab=team" replace />} />
              <Route path="api-keys" element={<ApiKeys />} />
              <Route path="logs" element={<Logs />} />
              <Route path="message-tester" element={<MessageTester />} />
              <Route path="infrastructure" element={<Infrastructure />} />
              <Route path="storage" element={<Storage />} />
              <Route path="plugins" element={<Plugins />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ToastProvider>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <RoleProvider>
          <AppContent />
        </RoleProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
