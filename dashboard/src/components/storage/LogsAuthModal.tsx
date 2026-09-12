import { useState, useEffect } from 'react';
import { ShieldAlert, KeyRound, Loader2, X, AlertCircle, Mail, UserCheck } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../../services/supabase';
import { useRole } from '../../hooks/useRole';
import { useToast } from '../../hooks/useToast';
import { LeadWeaveLogo } from '../LeadWeaveLogo';

interface LogsAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthenticated: () => void;
}

export function LogsAuthModal({ isOpen, onClose, onAuthenticated }: LogsAuthModalProps) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { role, isDeveloper, isSuperAdmin, isSupport, setRole } = useRole();
  const toast = useToast();

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim() || !password.trim()) {
      setError('Please enter your administrator/developer credentials');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let isAuthorized = false;
      let authenticatedRole = '';

      // 1. If Supabase is configured, authenticate against Supabase Auth
      if (isSupabaseConfigured && supabase) {
        let authEmail = identifier.trim();

        // If not a full email, try finding user's email from profiles or constructing domain email
        if (!authEmail.includes('@')) {
          const { data: profileMatch } = await supabase
            .from('profiles')
            .select('email, role')
            .or(`full_name.ilike.%${authEmail}%,email.ilike.%${authEmail}%`)
            .limit(1)
            .maybeSingle();

          if (profileMatch?.email) {
            authEmail = profileMatch.email;
          } else {
            authEmail = `${authEmail.toLowerCase()}@leadweave.local`;
          }
        }

        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email: authEmail,
          password: password.trim(),
        });

        if (signInError) {
          throw new Error(signInError.message || 'Invalid Supabase credentials');
        }

        const user = data.user;
        let userRole = (user?.user_metadata?.role || user?.app_metadata?.role || '').toLowerCase();

        // Also query profile from Supabase profiles table to check persistent role
        if (user?.id) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('role, is_superadmin')
            .eq('id', user.id)
            .maybeSingle();

          if (profile) {
            if (profile.role) userRole = profile.role.toLowerCase();
            if (profile.is_superadmin) userRole = 'superadmin';
          }
        }

        const emailLower = (user?.email || authEmail).toLowerCase();

        // Check if user has permission (superadmin, developer, support, admin)
        if (
          userRole === 'superadmin' ||
          userRole === 'developer' ||
          userRole === 'support' ||
          userRole === 'admin' ||
          emailLower.includes('superadmin') ||
          emailLower.includes('super') ||
          emailLower.includes('dev') ||
          emailLower.includes('support') ||
          emailLower.includes('admin')
        ) {
          isAuthorized = true;
          authenticatedRole = userRole || (emailLower.includes('super') ? 'superadmin' : 'developer');
          setRole(authenticatedRole as import('../../types/role').UserRole);
        } else {
          throw new Error('Access Denied: Your Supabase account does not have Superadmin, Developer or Support privileges.');
        }
      } else {
        // 2. Standalone / Local Auth fallback verification
        const idLower = identifier.trim().toLowerCase();
        const validRoles = ['superadmin', 'developer', 'support', 'admin'];

        const isValidRoleIdentifier =
          validRoles.includes(idLower) ||
          idLower.includes('superadmin') ||
          idLower.includes('developer') ||
          idLower.includes('support') ||
          idLower.includes('admin');

        const currentHasAccess = isDeveloper || isSuperAdmin || isSupport;

        if (isValidRoleIdentifier && (password.length >= 4 || currentHasAccess)) {
          isAuthorized = true;
          authenticatedRole = idLower.includes('dev')
            ? 'developer'
            : idLower.includes('support')
            ? 'support'
            : 'superadmin';
          setRole(authenticatedRole as import('../../types/role').UserRole);
        } else if (currentHasAccess && password.length >= 4) {
          isAuthorized = true;
          authenticatedRole = role || 'superadmin';
        } else {
          throw new Error('Invalid credentials or unauthorized role. Access restricted to Superadmins, Developers & Support.');
        }
      }

      if (isAuthorized) {
        toast.success(
          'Diagnostic Console Unlocked',
          `Authenticated as ${authenticatedRole.toUpperCase()}. Access granted.`
        );
        onAuthenticated();
        onClose();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Authentication failed. Please verify your credentials.';
      setError(msg);
      toast.error('Authentication Failed', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-modal-backdrop" onClick={onClose}>
      <div className="glass-auth-modal" onClick={e => e.stopPropagation()}>
        <button
          type="button"
          className="glass-modal-close-btn"
          onClick={onClose}
          aria-label="Close modal"
        >
          <X size={15} />
        </button>

        <div className="glass-auth-header">
          <div className="glass-auth-icon-box" style={{ display: 'flex', gap: '10px', alignItems: 'center', background: 'transparent' }}>
            <LeadWeaveLogo size={32} />
          </div>
          <h3 style={{ marginTop: '0.5rem' }}>Protected Diagnostic Console</h3>
          <p>Restricted access for system diagnostics, event telemetry & troubleshooting.</p>
          <div className="glass-auth-badge">
            <ShieldAlert size={12} />
            <span>Superadmin • Developer • Support Only</span>
          </div>
        </div>

        <div className="glass-auth-body">
          {error && (
            <div className="glass-auth-error">
              <AlertCircle size={16} className="flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="glass-auth-form" noValidate>
            <div className="glass-input-group">
              <label htmlFor="logs-auth-identifier">Admin Username or Email</label>
              <div className="glass-input-wrapper">
                <Mail size={16} className="glass-input-icon" />
                <input
                  id="logs-auth-identifier"
                  type="text"
                  className="glass-input"
                  placeholder="e.g. dev@leadweave.local or superadmin"
                  value={identifier}
                  onChange={e => {
                    setIdentifier(e.target.value);
                    if (error) setError(null);
                  }}
                  autoFocus
                  required
                />
              </div>
            </div>

            <div className="glass-input-group">
              <label htmlFor="logs-auth-password">Password</label>
              <div className="glass-input-wrapper">
                <KeyRound size={16} className="glass-input-icon" />
                <input
                  id="logs-auth-password"
                  type="password"
                  className="glass-input"
                  placeholder="Enter your security password"
                  value={password}
                  onChange={e => {
                    setPassword(e.target.value);
                    if (error) setError(null);
                  }}
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className="glass-auth-btn"
              disabled={loading || !identifier.trim() || !password.trim()}
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Verifying Supabase Auth...</span>
                </>
              ) : (
                <>
                  <UserCheck size={16} />
                  <span>Authenticate & Unlock Console</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
