import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Eye, EyeOff, Building2, ChevronDown } from 'lucide-react';
import { API_BASE_URL } from '../services/api';
import { supabase, isSupabaseConfigured } from '../services/supabase';
import { LeadWeaveLogo } from '../components/LeadWeaveLogo';
import './Login.css';

type SupabaseConnectionStatus = 'checking' | 'connected' | 'error' | 'disconnected';

interface LoginProps {
  onLogin: (role?: string, isSupabase?: boolean) => void;
}

export function Login({ onLogin }: LoginProps) {
  const { t } = useTranslation();
  const [authMode, setAuthMode] = useState<'supabase' | 'apiKey'>(
    isSupabaseConfigured ? 'supabase' : 'apiKey'
  );
  const [supabaseStatus, setSupabaseStatus] = useState<SupabaseConnectionStatus>(
    isSupabaseConfigured ? 'checking' : 'disconnected'
  );
  const [step, setStep] = useState<1 | 2>(1);
  const [apiKey, setApiKey] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const isModBitCompany = companyName.trim().toLowerCase() === 'modbit';

  const checkSupabaseHealth = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) {
      setSupabaseStatus('disconnected');
      return;
    }
    setSupabaseStatus('checking');
    try {
      const { error: pingError } = await supabase.from('companies').select('id', { count: 'exact', head: true });
      if (pingError && (pingError.message.includes('fetch') || pingError.message.includes('network') || pingError.message.includes('Failed to fetch'))) {
        setSupabaseStatus('error');
      } else {
        setSupabaseStatus('connected');
      }
    } catch {
      setSupabaseStatus('error');
    }
  }, []);

  useEffect(() => {
    checkSupabaseHealth();
  }, [checkSupabaseHealth]);

  const handleApiKeySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim()) {
      setError(t('login.apiKeyRequired') || 'API key is required');
      return;
    }
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE_URL}/auth/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ apiKey }),
      });

      if (response.ok) {
        const data = await response.json().catch(() => ({}));
        onLogin(data.role, false);
      } else {
        const errorData = await response.json().catch(() => ({}));
        setError(errorData.message || t('login.invalidKey') || 'Invalid API Key');
      }
    } catch {
      setError(t('login.connectionError') || 'Connection error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStep1Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = companyName.trim();
    if (!trimmed) {
      setError('Please enter your company name.');
      return;
    }

    if (!supabase) {
      setError('Authentication server is not configured.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // Query the companies table to verify existence
      const { data: company, error: companyErr } = await supabase
        .from('companies')
        .select('id, name')
        .ilike('name', trimmed)
        .maybeSingle();

      if (companyErr) {
        setError(`Unable to verify company: ${companyErr.message}`);
        return;
      }

      if (!company) {
        setError(`Company "${trimmed}" not found. Please verify the company name.`);
        return;
      }

      // Preserve matched canonical casing and proceed to step 2
      setCompanyName(company.name);
      setAuthMode('supabase');
      setStep(2);
    } catch (err) {
      setError((err as Error).message || 'Failed to verify workspace.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSupabaseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) {
      setError('Supabase is not configured.');
      return;
    }
    if (!companyName.trim() || !fullName.trim() || !password.trim()) {
      setError('Please provide company name, full name, and password.');
      return;
    }

    setIsLoading(true);
    setError('');

    const slugify = (text: string) => text.toLowerCase().replace(/[^a-z0-9]/g, '');
    const pseudoEmail = `${slugify(fullName)}@${slugify(companyName)}.auth.leadweave`;

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: pseudoEmail,
        password,
      });

      if (signInError || !data.session) {
        setError(signInError?.message || 'Authentication failed. Please check your credentials.');
        return;
      }

      const token = data.session.access_token;
      const response = await fetch(`${API_BASE_URL}/auth/session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ token }),
      });

      if (response.ok) {
        const validateData = await response.json().catch(() => ({}));
        sessionStorage.setItem('leadweave_user_name', fullName.trim());
        sessionStorage.setItem('leadweave_user_email', data.session?.user?.email || pseudoEmail);
        sessionStorage.setItem('leadweave_company_name', companyName.trim());
        onLogin(validateData.role, true);
      } else {
        const errorData = await response.json().catch(() => ({}));
        setError(errorData.message || 'Failed to authorize Supabase session with gateway');
      }
    } catch (err) {
      setError((err as Error).message || 'Connection error with authentication server');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-container google-auth-wrapper">
      {/* Top Left Brand Icon */}
      <div className="login-top-left-brand" title="LeadWeave">
        <LeadWeaveLogo size={32} glow />
      </div>

      {/* AuthLink Connectivity Indicator */}
      <button
        type="button"
        className={`supabase-status-badge ${supabaseStatus}`}
        onClick={checkSupabaseHealth}
        title={
          supabaseStatus === 'connected'
            ? 'AuthLink: Connected (Click to re-test)'
            : supabaseStatus === 'checking'
            ? 'AuthLink: Checking connectivity...'
            : supabaseStatus === 'error'
            ? 'AuthLink: Offline or Unreachable (Click to retry)'
            : 'AuthLink: Not configured'
        }
        aria-label={`AuthLink status: ${supabaseStatus}`}
      >
        <span className={`status-dot ${supabaseStatus}`} />
        <span role="status" aria-live="polite" className="sr-only">Server status: {supabaseStatus}</span>
        <svg className="supabase-badge-icon" viewBox="0 0 24 24" width="13" height="13" fill="none">
          <path
            d="M21.362 9.354H12V.312a.312.312 0 0 0-.543-.21L.343 12.378a.312.312 0 0 0 .221.534H12v9.042a.312.312 0 0 0 .543.21l11.114-12.276a.312.312 0 0 0-.221-.534z"
            fill={supabaseStatus === 'connected' ? '#3ECF8E' : supabaseStatus === 'error' ? '#ef4444' : '#94a3b8'}
          />
        </svg>
        <span className="supabase-status-text">
          {supabaseStatus === 'connected'
            ? 'AuthLink'
            : supabaseStatus === 'checking'
            ? 'Checking...'
            : supabaseStatus === 'error'
            ? 'Offline'
            : 'Unconfigured'}
        </span>
      </button>

      <div className="google-auth-card">
        {/* Left branding section */}
        <div className="google-auth-left">
          <div className="google-auth-logo">
            <LeadWeaveLogo size={52} glow />
          </div>

          <h1 className="google-auth-brand-title">LeadWeave</h1>

          {step === 2 && (
            <div className="google-account-chip-container">
              <button
                type="button"
                className="google-account-chip"
                onClick={() => {
                  setStep(1);
                  setError('');
                }}
                title="Switch company workspace"
              >
                <div className="google-account-avatar">
                  <Building2 size={15} />
                </div>
                <span className="google-account-name">{companyName}</span>
                <ChevronDown size={15} className="google-chip-chevron" />
              </button>
            </div>
          )}
        </div>

        {/* Right interactive form section */}
        <div className="google-auth-right">
          {authMode === 'apiKey' && (!isSupabaseConfigured || isModBitCompany) ? (
            /* Developer API Key Mode (Default when unconfigured, or specifically for ModBit) */
            <form onSubmit={handleApiKeySubmit} className="google-auth-form" noValidate>
              <div className="google-form-fields">
                <div className="google-field-group">
                  <label htmlFor="apiKey" className="google-field-top-label">
                    {t('login.apiKey') || 'API Key'}
                  </label>
                  <div className={`google-oval-input-box ${error ? 'is-error' : ''}`}>
                    <input
                      id="apiKey"
                      type={showKey ? 'text' : 'password'}
                      value={apiKey}
                      onChange={(e) => {
                        setApiKey(e.target.value);
                        setError('');
                      }}
                      placeholder=""
                      required
                      autoFocus
                    />
                    <button
                      type="button"
                      className="google-input-visibility"
                      onClick={() => setShowKey(!showKey)}
                      tabIndex={-1}
                      aria-label={showKey ? 'Hide key' : 'Show key'}
                    >
                      {showKey ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                {error && <div className="google-error-banner">{error}</div>}
              </div>

              <div className="google-actions-row">
                {isSupabaseConfigured && isModBitCompany ? (
                  <button
                    type="button"
                    className="google-btn-text"
                    onClick={() => {
                      setAuthMode('supabase');
                      setError('');
                    }}
                  >
                    Back to User Login
                  </button>
                ) : (
                  <div />
                )}
                <button
                  type="submit"
                  className="google-btn-primary"
                  disabled={isLoading}
                >
                  {isLoading ? t('login.connecting') || 'Connecting...' : t('login.connect') || 'Next'}
                </button>
              </div>
            </form>
          ) : step === 1 ? (
            /* STEP 1: Company Workspace */
            <form onSubmit={handleStep1Submit} className="google-auth-form" noValidate>
              <div className="google-form-fields">
                <div className="google-field-group">
                  <label htmlFor="companyName" className="google-field-top-label">
                    Company Name
                  </label>
                  <div className={`google-oval-input-box ${error ? 'is-error' : ''}`}>
                    <input
                      id="companyName"
                      type="text"
                      value={companyName}
                      onChange={(e) => {
                        setCompanyName(e.target.value);
                        setError('');
                      }}
                      placeholder=""
                      required
                      autoFocus
                      autoComplete="organization"
                    />
                  </div>
                </div>

                {error && <div className="google-error-banner">{error}</div>}
              </div>

              <div className="google-actions-row">
                <div />
                <button
                  type="submit"
                  className="google-btn-primary"
                  disabled={isLoading}
                >
                  {isLoading ? 'Verifying...' : 'Next'}
                </button>
              </div>
            </form>
          ) : (
            /* STEP 2 (User Login): Full Name & Password */
            <form onSubmit={handleSupabaseSubmit} className="google-auth-form" noValidate>
              <div className="google-form-fields">
                <div className="google-field-group">
                  <label htmlFor="fullName" className="google-field-top-label">
                    Full Name
                  </label>
                  <div className={`google-oval-input-box ${error ? 'is-error' : ''}`}>
                    <input
                      id="fullName"
                      type="text"
                      value={fullName}
                      onChange={(e) => {
                        setFullName(e.target.value);
                        setError('');
                      }}
                      placeholder=""
                      required
                      autoFocus
                      autoComplete="name"
                    />
                  </div>
                </div>

                <div className="google-field-group">
                  <label htmlFor="password" className="google-field-top-label">
                    Password
                  </label>
                  <div className={`google-oval-input-box ${error ? 'is-error' : ''}`}>
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setError('');
                      }}
                      placeholder=""
                      required
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      className="google-input-visibility"
                      onClick={() => setShowPassword(!showPassword)}
                      tabIndex={-1}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                {error && <div className="google-error-banner">{error}</div>}
              </div>

              <div className="google-actions-row">
                {isModBitCompany ? (
                  <button
                    type="button"
                    className="google-btn-text"
                    onClick={() => {
                      setAuthMode('apiKey');
                      setError('');
                    }}
                  >
                    Developer API Key
                  </button>
                ) : (
                  <button
                    type="button"
                    className="google-btn-text"
                    onClick={() => {
                      setStep(1);
                      setError('');
                    }}
                  >
                    Switch company
                  </button>
                )}
                <button
                  type="submit"
                  className="google-btn-primary"
                  disabled={isLoading}
                >
                  {isLoading ? 'Signing in...' : 'Sign in'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      <div className="login-footer">
        <div className="footer-powered">
          Powered by
          <div className="footer-tech-stack">
            <img src="https://cdn.simpleicons.org/cloudflare/F38020" alt="Cloudflare" title="Cloudflare" />
            <img src="https://cdn.simpleicons.org/supabase/3ECF8E" alt="Supabase" title="Supabase" />
            <img src="https://cdn.simpleicons.org/meta/0668E1" alt="Meta" title="Meta" />
          </div>
        </div>
        <div className="footer-credits">
          Developed by <strong>ModBit Labs</strong> &amp; <strong>Shakti Analytics</strong>
        </div>
      </div>
    </div>
  );
}
