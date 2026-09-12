import React, { useState, useEffect, useCallback } from 'react';
import {
  Building2,
  Users,
  Smartphone,
  Plus,
  Search,
  CheckCircle2,
  AlertTriangle,
  Ban,
  Trash2,
  X,
  Phone,
  IndianRupee,
  ShieldCheck,
  Briefcase,
} from 'lucide-react';
import { saasStore, type SaaSCompany } from '../services/saasStore';
import { LeadWeaveLogo } from '../components/LeadWeaveLogo';
import { supabase, isSupabaseConfigured } from '../services/supabase';
import './Companies.css';

export function Companies() {
  const [companies, setCompanies] = useState<SaaSCompany[]>(saasStore.getCompanies());
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state — Company Info
  const [name, setName] = useState('');
  const [loginId, setLoginId] = useState('');
  const [companyEmail, setCompanyEmail] = useState('');
  const [supabaseStatus, setSupabaseStatus] = useState<'checking' | 'connected' | 'error' | 'disconnected'>(
    isSupabaseConfigured ? 'checking' : 'disconnected',
  );

  // Form state — Contact
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [altPhone, setAltPhone] = useState('');

  // Form state — Admin Account
  const [adminUsername, setAdminUsername] = useState('');
  const [adminEmail, setAdminEmail] = useState('');

  // Form state — Quota
  const [maxUsers, setMaxUsers] = useState(5);
  const [maxSessions, setMaxSessions] = useState(1);
  const [maxAdmins, setMaxAdmins] = useState(1);
  const [maxHr, setMaxHr] = useState(0);

  // Form state — Billing
  const [monthlyPrice, setMonthlyPrice] = useState(0);

  const checkSupabaseHealth = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) {
      setSupabaseStatus('disconnected');
      return;
    }
    setSupabaseStatus('checking');
    try {
      const { error: pingError } = await supabase.from('companies').select('id', { count: 'exact', head: true });
      if (
        pingError &&
        (pingError.message.includes('fetch') ||
          pingError.message.includes('network') ||
          pingError.message.includes('Failed to fetch'))
      ) {
        setSupabaseStatus('error');
      } else {
        setSupabaseStatus('connected');
      }
    } catch {
      setSupabaseStatus('error');
    }
  }, []);

  useEffect(() => {
    saasStore.syncWithSupabase();
    return saasStore.subscribe(() => {
      setCompanies(saasStore.getCompanies());
    });
  }, []);

  useEffect(() => {
    if (isModalOpen) {
      checkSupabaseHealth();
    }
  }, [isModalOpen, checkSupabaseHealth]);

  const filteredCompanies = companies.filter(
    c =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.loginId.toLowerCase().includes(search.toLowerCase()) ||
      c.adminEmail.toLowerCase().includes(search.toLowerCase()),
  );

  const totalCompanies = companies.length;
  const activeTenants = companies.filter(c => c.status === 'active').length;
  const totalUsers = companies.reduce((acc, c) => acc + c.activeUsersCount, 0);
  const totalNumbers = companies.reduce((acc, c) => acc + c.activeSessionsCount, 0);

  const closeModal = () => {
    setIsModalOpen(false);
    setName('');
    setLoginId('');
    setCompanyEmail('');
    setAddress('');
    setPhone('');
    setAltPhone('');
    setAdminUsername('');
    setAdminEmail('');
    setMaxUsers(5);
    setMaxSessions(1);
    setMaxAdmins(1);
    setMaxHr(0);
    setMonthlyPrice(0);
  };

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !loginId || !adminEmail || !adminUsername) return;
    setIsSubmitting(true);
    try {
      await saasStore.addCompany({
        name,
        loginId,
        address,
        phone,
        altPhone,
        maxUsers,
        maxSessions,
        maxAdmins,
        maxHr,
        monthlyPrice,
        adminEmail,
        adminUsername,
        companyEmail,
      });
      closeModal();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="companies-page">
      {/* Header */}
      <div className="companies-header">
        <div className="header-title-group">
          <h1>
            <Building2 size={28} />
            Client Companies &amp; Tenants
          </h1>
          <p>Manage SaaS client workspaces, user allocations, and WhatsApp quotas</p>
        </div>

        <button className="btn-create-company" onClick={() => setIsModalOpen(true)}>
          <Plus size={18} />
          Add Client Company
        </button>
      </div>

      {/* KPI Cards */}
      <div className="stats-cards-grid">
        <div className="stat-card">
          <div className="stat-icon-capsule">
            <Building2 size={22} />
          </div>
          <div className="stat-info">
            <span className="stat-value">{totalCompanies}</span>
            <span className="stat-label">Total Companies</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-capsule" style={{ color: '#16a34a', background: '#dcfce7' }}>
            <CheckCircle2 size={22} />
          </div>
          <div className="stat-info">
            <span className="stat-value">{activeTenants}</span>
            <span className="stat-label">Active Tenants</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-capsule" style={{ color: '#8b5cf6', background: '#ede9fe' }}>
            <Users size={22} />
          </div>
          <div className="stat-info">
            <span className="stat-value">{totalUsers}</span>
            <span className="stat-label">Active Agent Users</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-capsule" style={{ color: '#0284c7', background: '#e0f2fe' }}>
            <Smartphone size={22} />
          </div>
          <div className="stat-info">
            <span className="stat-value">{totalNumbers}</span>
            <span className="stat-label">WhatsApp Lines Linked</span>
          </div>
        </div>
      </div>

      {/* Directory Table */}
      <div className="table-container">
        <div className="table-toolbar">
          <div className="search-input-wrapper">
            <Search className="search-icon" size={16} />
            <input
              type="text"
              className="search-input"
              placeholder=""
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        <table className="companies-table">
          <thead>
            <tr>
              <th>Company Name</th>
              <th>Login ID</th>
              <th>Quota</th>
              <th>Monthly Price</th>
              <th>Status</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredCompanies.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '32px', color: '#94a3b8' }}>
                  No client companies found matching your search.
                </td>
              </tr>
            ) : (
              filteredCompanies.map(company => (
                <tr key={company.id}>
                  <td>
                    <div className="company-name-cell">
                      <span className="company-name">{company.name}</span>
                      <span className="company-slug">admin: {company.adminEmail}</span>
                      {company.phone && <span className="company-slug">📞 {company.phone}</span>}
                    </div>
                  </td>
                  <td>
                    <code
                      style={{
                        fontSize: 13,
                        background: 'rgba(255, 255, 255, 0.1)',
                        color: '#e2e8f0',
                        padding: '2px 8px',
                        borderRadius: 4,
                      }}
                    >
                      {company.loginId}
                    </code>
                  </td>
                  <td style={{ fontSize: 13 }}>
                    <div>
                      <strong>{company.activeUsersCount}</strong>/{company.maxUsers} Users
                    </div>
                    <div style={{ color: '#64748b' }}>
                      {company.maxSessions} Sessions · {company.maxAdmins} Admins · {company.maxHr} HR
                    </div>
                  </td>
                  <td>
                    <span style={{ fontWeight: 700, color: '#e2e8f0' }}>
                      ₹{company.monthlyPrice.toLocaleString('en-IN')}/mo
                    </span>
                  </td>
                  <td>
                    <span className={`status-badge ${company.status}`}>
                      {company.status === 'active' && <CheckCircle2 size={12} />}
                      {company.status === 'trial' && <AlertTriangle size={12} />}
                      {company.status === 'suspended' && <Ban size={12} />}
                      {company.status.toUpperCase()}
                    </span>
                  </td>
                  <td style={{ fontSize: 13, color: '#64748b' }}>
                    <div>Created: {company.createdAt}</div>
                    <div>Renews: {company.expiresAt}</div>
                  </td>
                  <td>
                    <div className="actions-cell">
                      <button
                        className="btn-action-icon"
                        onClick={() => saasStore.toggleCompanyStatus(company.id)}
                        title={company.status === 'active' ? 'Suspend Company' : 'Activate Company'}
                      >
                        {company.status === 'active' ? (
                          <Ban size={16} strokeWidth={2.5} color="#ffffff" />
                        ) : (
                          <CheckCircle2 size={16} strokeWidth={2.5} color="#ffffff" />
                        )}
                      </button>
                      <button
                        className="btn-action-icon danger"
                        onClick={() => {
                          if (window.confirm(`Are you sure you want to delete ${company.name}?`)) {
                            saasStore.deleteCompany(company.id);
                          }
                        }}
                        title="Delete Company"
                      >
                        <Trash2 size={16} strokeWidth={2.5} color="#ffffff" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ─── Add Company Modal ─── */}
      {isModalOpen && (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal-box company-modal-box" onClick={e => e.stopPropagation()}>
            {/* Modal Logo Header */}
            <div className="modal-logo-header">
              <LeadWeaveLogo size={28} withText glow />
              <button className="modal-close-btn" onClick={closeModal}>
                <X size={18} />
              </button>
            </div>

            {/* Modal Title Bar */}
            <div className="modal-title-bar">
              <Building2 size={20} />
              <div>
                <h2>Add New Client Company</h2>
                <p>
                  New company admin default password: <code>Welcome123!</code>
                </p>
              </div>
            </div>

            <form className="modal-form" onSubmit={handleCreateCompany}>
              <div className="modal-grid-layout">
                {/* Column 1: Company Info */}
                <div className="modal-grid-column">
                  <div className="form-section-title">
                    <Building2 size={14} />
                    Company Information
                  </div>
                  <div className="form-group">
                    <label>Company Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Apex Real Estate"
                      value={name}
                      onChange={e => {
                        setName(e.target.value);
                        if (!loginId) {
                          setLoginId(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''));
                        }
                      }}
                    />
                  </div>
                  <div className="form-group">
                    <label>
                      Login ID *
                      <span className="form-hint">
                        {' '}
                        (e.g. <code>apex</code>)
                      </span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. apex"
                      value={loginId}
                      onChange={e => setLoginId(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                    />
                  </div>
                  <div className="form-group">
                    <label>Company Email</label>
                    <input
                      type="email"
                      placeholder="info@apexcompany.com"
                      value={companyEmail}
                      onChange={e => setCompanyEmail(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label>Company Address</label>
                    <input
                      type="text"
                      placeholder="e.g. 12, MG Road, Bengaluru"
                      value={address}
                      onChange={e => setAddress(e.target.value)}
                    />
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Phone Number</label>
                      <div className="input-icon-wrapper">
                        <Phone size={14} className="input-icon" />
                        <input
                          type="tel"
                          placeholder="+91 98765 43210"
                          value={phone}
                          onChange={e => setPhone(e.target.value)}
                          style={{ paddingLeft: '32px' }}
                        />
                      </div>
                    </div>
                    <div className="form-group">
                      <label>Alternate Phone</label>
                      <div className="input-icon-wrapper">
                        <Phone size={14} className="input-icon" />
                        <input
                          type="tel"
                          placeholder="+91 91234 56789"
                          value={altPhone}
                          onChange={e => setAltPhone(e.target.value)}
                          style={{ paddingLeft: '32px' }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Column 2: Admin & Subscription Details */}
                <div className="modal-grid-column">
                  <div className="form-section-title">
                    <ShieldCheck size={14} />
                    Company Admin Account
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Admin Full Name *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Rahul Sharma"
                        value={adminUsername}
                        onChange={e => setAdminUsername(e.target.value)}
                      />
                    </div>
                    <div className="form-group">
                      <label>Admin Email *</label>
                      <input
                        type="email"
                        required
                        placeholder="admin@clientcompany.com"
                        value={adminEmail}
                        onChange={e => setAdminEmail(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="form-section-title">
                    <Users size={14} />
                    Subscription Quota
                  </div>
                  <div className="quota-grid">
                    <div className="form-group">
                      <label>Users</label>
                      <input
                        type="number"
                        min={1}
                        aria-label="Max Users"
                        value={maxUsers}
                        onChange={e => setMaxUsers(Number(e.target.value))}
                      />
                    </div>
                    <div className="form-group">
                      <label>Sessions</label>
                      <input
                        type="number"
                        min={1}
                        aria-label="Max Sessions"
                        value={maxSessions}
                        onChange={e => setMaxSessions(Number(e.target.value))}
                      />
                    </div>
                    <div className="form-group">
                      <label>Admins</label>
                      <input
                        type="number"
                        min={0}
                        aria-label="Max Admins"
                        value={maxAdmins}
                        onChange={e => setMaxAdmins(Number(e.target.value))}
                      />
                    </div>
                    <div className="form-group">
                      <label>HR</label>
                      <input
                        type="number"
                        min={0}
                        aria-label="Max HR"
                        value={maxHr}
                        onChange={e => setMaxHr(Number(e.target.value))}
                      />
                    </div>
                  </div>

                  <div className="form-section-title">
                    <Briefcase size={14} />
                    Billing
                  </div>
                  <div className="form-group">
                    <label>Monthly Subscription Price (₹)</label>
                    <div className="input-icon-wrapper">
                      <IndianRupee size={14} className="input-icon" />
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        placeholder="e.g. 4999"
                        value={monthlyPrice}
                        onChange={e => setMonthlyPrice(Number(e.target.value))}
                        style={{ paddingLeft: '32px' }}
                      />
                    </div>
                  </div>

                  <div className="form-actions-inline">
                    <button type="button" className="btn-cancel" onClick={closeModal}>
                      Cancel
                    </button>
                    <button type="submit" className="btn-submit" disabled={isSubmitting}>
                      {isSubmitting ? 'Creating…' : 'Create Company & Admin'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className={`supabase-status-badge ${supabaseStatus}`}
                  onClick={checkSupabaseHealth}
                  title={
                    supabaseStatus === 'connected'
                      ? 'DBLink: Connected (Click to re-test)'
                      : supabaseStatus === 'checking'
                        ? 'DBLink: Checking connectivity...'
                        : supabaseStatus === 'error'
                          ? 'DBLink: Offline or Unreachable (Click to retry)'
                          : 'DBLink: Not configured'
                  }
                  aria-label={`DBLink status: ${supabaseStatus}`}
                  style={{ position: 'static', transform: 'none' }}
                >
                  <span className={`status-dot ${supabaseStatus}`} />
                  <svg className="supabase-badge-icon" viewBox="0 0 24 24" width="13" height="13" fill="none">
                    <path
                      d="M21.362 9.354H12V.312a.312.312 0 0 0-.543-.21L.343 12.378a.312.312 0 0 0 .221.534H12v9.042a.312.312 0 0 0 .543.21l11.114-12.276a.312.312 0 0 0-.221-.534z"
                      fill={
                        supabaseStatus === 'connected' ? '#3ECF8E' : supabaseStatus === 'error' ? '#ef4444' : '#94a3b8'
                      }
                    />
                  </svg>
                  <span className="supabase-status-text">
                    {supabaseStatus === 'connected'
                      ? 'DBLink'
                      : supabaseStatus === 'checking'
                        ? 'Checking...'
                        : supabaseStatus === 'error'
                          ? 'Offline'
                          : 'Unconfigured'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
