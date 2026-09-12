import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  User,
  Mail,
  Shield,
  HeadphonesIcon,
  Calendar,
  MapPin,
  Briefcase,
  Lock,
  Globe,
  CheckCircle,
  Building2,
  Copy,
  Check,
  Edit2,
  X,
  FileText,
  Users,
  Webhook as WebhookIcon,
} from 'lucide-react';
import { useRole } from '../hooks/useRole';
import { supabase, isSupabaseConfigured } from '../services/supabase';
import { TemplateManager } from '../components/profile/TemplateManager';
import { CompanyTeam } from './CompanyTeam';
import { Webhooks } from './Webhooks';
import './Profile.css';

type Tab = 'account' | 'hr' | 'team' | 'webhooks' | 'support' | 'security' | 'templates';

export function Profile() {
  const { role } = useRole();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab') as Tab | null;

  const validTabs: Tab[] = ['account', 'hr', 'team', 'webhooks', 'support', 'security', 'templates'];

  const [activeTab, setActiveTabState] = useState<Tab>(() => {
    if (tabParam && validTabs.includes(tabParam)) {
      return tabParam;
    }
    return 'account';
  });

  useEffect(() => {
    if (tabParam && validTabs.includes(tabParam)) {
      setActiveTabState(tabParam);
    }
  }, [tabParam]);

  const setActiveTab = (tab: Tab) => {
    setActiveTabState(tab);
    setSearchParams({ tab });
  };
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isTwoFactorEnabled, setIsTwoFactorEnabled] = useState(false);

  // Dynamic User State
  const [userName, setUserName] = useState<string>(() => sessionStorage.getItem('leadweave_user_name') || 'Admin User');
  const [userEmail, setUserEmail] = useState<string>(() => sessionStorage.getItem('leadweave_user_email') || 'admin@leadweave.local');
  const [companyName] = useState<string>(() => sessionStorage.getItem('leadweave_company_name') || 'Default Workspace');
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(userName);

  // Copy state feedback
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleCopy = (text: string, fieldId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleSaveName = () => {
    const trimmed = nameInput.trim();
    if (trimmed) {
      setUserName(trimmed);
      sessionStorage.setItem('leadweave_user_name', trimmed);
      localStorage.setItem('leadweave_user_name', trimmed);
      localStorage.setItem('openwa_lan_mesh_name', trimmed);
      window.dispatchEvent(new CustomEvent('leadweave:profile_updated', { detail: { userName: trimmed } }));
    }
    setIsEditingName(false);
  };

  useEffect(() => {
    async function loadSupabaseUser() {
      if (isSupabaseConfigured && supabase) {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const metaName = user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0];
            if (metaName && metaName !== 'user') {
              setUserName(metaName);
              setNameInput(metaName);
              sessionStorage.setItem('leadweave_user_name', metaName);
              localStorage.setItem('leadweave_user_name', metaName);
              localStorage.setItem('openwa_lan_mesh_name', metaName);
              window.dispatchEvent(new CustomEvent('leadweave:profile_updated', { detail: { userName: metaName } }));
            }
            if (user.email) setUserEmail(user.email);
          }
        } catch {
          // Fallback to state initialized from sessionStorage
        }
      }
    }
    loadSupabaseUser();
  }, []);

  // Compute initials dynamically
  const getInitials = (nameStr: string) => {
    const parts = nameStr.trim().split(/\s+/);
    if (parts.length >= 2 && parts[0][0] && parts[1][0]) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    if (parts[0] && parts[0].length >= 2) {
      return parts[0].slice(0, 2).toUpperCase();
    }
    return 'AU';
  };

  const userInitials = getInitials(userName);

  return (
    <div className="page-container profile-page futuristic-theme">
      {/* Page Header Space */}
      <div className="page-header">
        <h1>Profile Settings</h1>
        <p>Manage your account credentials, workspace parameters, and security settings.</p>
      </div>

      {/* Main Dual-Column Body */}
      <div className="profile-hud-grid">
        
        {/* Left Navigation Sidebar */}
        <aside className="profile-hud-sidebar">
          {/* User Identity Card */}
          <div className="profile-user-card">
            <div className="profile-avatar-node">
              <div className="profile-avatar-glowing">
                <span>{userInitials}</span>
              </div>
              <div className="avatar-status-badge">
                <span className="live-dot"></span>
                <span className="live-text">ONLINE</span>
              </div>
            </div>

            <div className="profile-user-info">
              <h3>{userName}</h3>
              <span className="cyber-chip role-chip">
                <Shield size={12} />
                {role === 'admin' ? 'Administrator' : role === 'superadmin' ? 'Superadmin' : (role || 'Viewer').toUpperCase()}
              </span>
              <div className="user-email-text">{userEmail}</div>
            </div>
          </div>

          <nav className="profile-hud-menu">
            <button
              className={`hud-menu-item ${activeTab === 'account' ? 'active' : ''}`}
              onClick={() => setActiveTab('account')}
            >
              <User size={16} />
              <span>Account Details</span>
            </button>

            <button
              className={`hud-menu-item ${activeTab === 'hr' ? 'active' : ''}`}
              onClick={() => setActiveTab('hr')}
            >
              <Building2 size={16} />
              <span>Workspace Matrix</span>
            </button>

            <button
              className={`hud-menu-item ${activeTab === 'team' ? 'active' : ''}`}
              onClick={() => setActiveTab('team')}
            >
              <Users size={16} />
              <span>Global Users &amp; Team</span>
            </button>

            <button
              className={`hud-menu-item ${activeTab === 'webhooks' ? 'active' : ''}`}
              onClick={() => setActiveTab('webhooks')}
            >
              <WebhookIcon size={16} />
              <span>Webhooks &amp; Integrations</span>
            </button>

            <button
              className={`hud-menu-item support-pill ${activeTab === 'support' ? 'active' : ''}`}
              onClick={() => setActiveTab('support')}
            >
              <HeadphonesIcon size={16} />
              <span>Support &amp; Tickets</span>
            </button>

            <button
              className={`hud-menu-item ${activeTab === 'security' ? 'active' : ''}`}
              onClick={() => setActiveTab('security')}
            >
              <Lock size={16} />
              <span>Security &amp; Cipher</span>
            </button>

            <button
              className={`hud-menu-item ${activeTab === 'templates' ? 'active' : ''}`}
              onClick={() => setActiveTab('templates')}
            >
              <FileText size={16} />
              <span>Message Templates</span>
            </button>
          </nav>
        </aside>

        {/* Right Content Pane */}
        <main className="profile-hud-pane">
          {activeTab === 'account' && (
            <div className="cyber-panel fade-in">
              <div className="cyber-panel-header">
                <h2>Account Details</h2>
                <p>Personal profile identity, workspace affiliation, and active session status.</p>
              </div>

              <div className="cyber-panel-body cyber-fields-grid">
                <div className="cyber-field-card">
                  <div className="field-label-row">
                    <label>Full Name</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {!isEditingName ? (
                        <button
                          className="copy-btn"
                          onClick={() => {
                            setNameInput(userName);
                            setIsEditingName(true);
                          }}
                          title="Edit Profile Name"
                          aria-label="Edit Profile Name"
                        >
                          <Edit2 size={13} />
                        </button>
                      ) : null}
                      <button
                        className="copy-btn"
                        onClick={() => handleCopy(userName, 'name')}
                        title="Copy Name"
                      >
                        {copiedField === 'name' ? <Check size={13} className="check-icon" /> : <Copy size={13} />}
                      </button>
                    </div>
                  </div>
                  <div className="cyber-field-content">
                    <User size={16} className="field-prefix-icon" />
                    {!isEditingName ? (
                      <span style={{ fontWeight: 600 }}>{userName}</span>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
                        <input
                          type="text"
                          aria-label="Display Name"
                          value={nameInput}
                          onChange={(e) => setNameInput(e.target.value)}
                          style={{
                            flex: 1,
                            background: 'rgba(15, 23, 42, 0.8)',
                            border: '1px solid var(--success)',
                            borderRadius: '6px',
                            color: '#fff',
                            padding: '4px 8px',
                            fontSize: '13px',
                            outline: 'none'
                          }}
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveName();
                            if (e.key === 'Escape') setIsEditingName(false);
                          }}
                        />
                        <button
                          type="button"
                          onClick={handleSaveName}
                          style={{
                            background: 'var(--success)',
                            border: 'none',
                            borderRadius: '6px',
                            color: '#fff',
                            padding: '4px 8px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center'
                          }}
                          title="Save"
                        >
                          <Check size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsEditingName(false)}
                          style={{
                            background: 'rgba(255, 255, 255, 0.1)',
                            border: 'none',
                            borderRadius: '6px',
                            color: '#cbd5e1',
                            padding: '4px 8px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center'
                          }}
                          title="Cancel"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="cyber-field-card">
                  <div className="field-label-row">
                    <label>Email Address</label>
                    <button
                      className="copy-btn"
                      onClick={() => handleCopy(userEmail, 'email')}
                      title="Copy Email"
                    >
                      {copiedField === 'email' ? <Check size={13} className="check-icon" /> : <Copy size={13} />}
                    </button>
                  </div>
                  <div className="cyber-field-content">
                    <Mail size={16} className="field-prefix-icon" />
                    <span className="email-value-text">{userEmail}</span>
                  </div>
                </div>

                <div className="cyber-field-card">
                  <div className="field-label-row">
                    <label>Company Workspace</label>
                  </div>
                  <div className="cyber-field-content">
                    <Building2 size={16} className="field-prefix-icon" />
                    <span>{companyName}</span>
                  </div>
                </div>

                <div className="cyber-field-card">
                  <div className="field-label-row">
                    <label>System Role Access</label>
                  </div>
                  <div className="cyber-field-content highlight-gold">
                    <Shield size={16} className="field-prefix-icon" />
                    <span>{role ? role.toUpperCase() : 'VIEWER'}</span>
                  </div>
                </div>

                <div className="cyber-field-card">
                  <div className="field-label-row">
                    <label>Timezone Vector</label>
                  </div>
                  <div className="cyber-field-content">
                    <Globe size={16} className="field-prefix-icon" />
                    <span>UTC / GMT (+00:00)</span>
                  </div>
                </div>

                <div className="cyber-field-card">
                  <div className="field-label-row">
                    <label>Account Status</label>
                  </div>
                  <div className="cyber-field-content highlight-green">
                    <CheckCircle size={16} className="field-prefix-icon" />
                    <span>ACTIVE &amp; VERIFIED</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'hr' && (
            <div className="cyber-panel fade-in">
              <div className="cyber-panel-header">
                <h2>Workspace &amp; HR Metrics</h2>
                <p>Workspace allocation details, department unit, and leave balance.</p>
              </div>

              <div className="cyber-panel-body cyber-fields-grid">
                <div className="cyber-field-card">
                  <div className="field-label-row">
                    <label>Assigned Tenant Workspace</label>
                  </div>
                  <div className="cyber-field-content">
                    <Building2 size={16} className="field-prefix-icon" />
                    <span>{companyName}</span>
                  </div>
                </div>

                <div className="cyber-field-card">
                  <div className="field-label-row">
                    <label>Department Unit</label>
                  </div>
                  <div className="cyber-field-content">
                    <Briefcase size={16} className="field-prefix-icon" />
                    <span>Engineering / Operations</span>
                  </div>
                </div>

                <div className="cyber-field-card">
                  <div className="field-label-row">
                    <label>Time Off Quota</label>
                  </div>
                  <div className="cyber-field-content highlight-gold">
                    <Calendar size={16} className="field-prefix-icon" />
                    <span>14 Days Remaining</span>
                  </div>
                </div>

                <div className="cyber-field-card">
                  <div className="field-label-row">
                    <label>Operations Base</label>
                  </div>
                  <div className="cyber-field-content">
                    <MapPin size={16} className="field-prefix-icon" />
                    <span>Remote (Global Distributed)</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'support' && (
            <div className="cyber-panel fade-in">
              <div className="cyber-panel-header">
                <h2>Support &amp; Helpdesk</h2>
                <p>Submit open tickets, view platform service advisories, and request help.</p>
              </div>

              <div className="cyber-panel-body">
                <div className="cyber-empty-terminal">
                  <div className="terminal-radar-wrapper">
                    <HeadphonesIcon size={36} className="radar-icon" />
                  </div>
                  <h3>No Active Support Tickets</h3>
                  <p>All system nodes are operating at optimal parameters. If you encounter service interruptions, initialize a support request below.</p>
                  <button className="cyber-action-btn">
                    Create New Ticket
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="cyber-panel fade-in">
              <div className="cyber-panel-header">
                <h2>Security &amp; Cipher Vault</h2>
                <p>Manage authentication credentials, password security, and 2FA settings.</p>
              </div>

              <div className="cyber-panel-body security-pane">
                <form className="cyber-form" onSubmit={e => e.preventDefault()}>
                  <h3>Change Password</h3>
                  
                  <div className="cyber-field-group">
                    <label>Current Password</label>
                    <div className="cyber-input-wrapper">
                      <Lock size={15} className="input-icon" />
                      <input
                        type="password"
                        placeholder="••••••••••••"
                        value={currentPassword}
                        onChange={e => setCurrentPassword(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="cyber-field-group">
                    <label>New Password</label>
                    <div className="cyber-input-wrapper">
                      <Lock size={15} className="input-icon" />
                      <input
                        type="password"
                        placeholder="••••••••••••"
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="cyber-field-group">
                    <label>Confirm New Password</label>
                    <div className="cyber-input-wrapper">
                      <Lock size={15} className="input-icon" />
                      <input
                        type="password"
                        placeholder="••••••••••••"
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                      />
                    </div>
                  </div>

                  <button type="submit" className="cyber-submit-btn" disabled={!newPassword}>
                    Update Password
                  </button>
                </form>

                <div className="cyber-divider"></div>

                {/* 2FA Security Switch */}
                <div className="cyber-tfa-card">
                  <div className="tfa-content">
                    <h4>Two-Factor Authentication (2FA)</h4>
                    <p>Requires an additional cryptographic time-based verification token during authentication cycles.</p>
                  </div>
                  <button
                    type="button"
                    className={`cyber-tfa-toggle ${isTwoFactorEnabled ? 'active' : ''}`}
                    onClick={() => setIsTwoFactorEnabled(prev => !prev)}
                  >
                    <span className="tfa-led"></span>
                    {isTwoFactorEnabled ? '2FA Enabled' : 'Enable 2FA'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'team' && (
            <div className="cyber-panel fade-in" style={{ padding: 0, background: 'transparent', border: 'none', boxShadow: 'none' }}>
              <div className="cyber-panel-body" style={{ padding: 0 }}>
                <CompanyTeam />
              </div>
            </div>
          )}

          {activeTab === 'webhooks' && (
            <div className="cyber-panel fade-in" style={{ padding: 0, background: 'transparent', border: 'none', boxShadow: 'none' }}>
              <div className="cyber-panel-body" style={{ padding: 0 }}>
                <Webhooks />
              </div>
            </div>
          )}

          {activeTab === 'templates' && (
            <div className="cyber-panel fade-in" style={{ padding: 0 }}>
              <div className="cyber-panel-body" style={{ padding: 0 }}>
                <TemplateManager />
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
